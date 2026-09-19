import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { OptimisticLockVersionMismatchError, QueryFailedError } from 'typeorm';
import { currentRequestId } from '../logging/request-context';
import { describeDatabaseError } from './database-errors';

/** Машиночитаемые коды ответов об ошибке. */
const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
};

/** Сообщения по типам ошибок разбора тела запроса. */
const BODY_ERRORS: Record<string, string> = {
  'entity.too.large': 'Размер запроса превышает допустимый предел',
  'entity.parse.failed': 'Тело запроса не является корректным JSON',
  'encoding.unsupported': 'Неподдерживаемая кодировка тела запроса',
  'request.aborted': 'Запрос прерван до завершения передачи',
};

/**
 * Единый формат ответа об ошибке.
 *
 * Раньше формат зависел от того, кто бросил исключение: где-то
 * `{ statusCode, message }`, где-то только `{ message, dependents }`,
 * а необработанная ошибка вообще отдавалась стандартной страницей Express.
 * Клиент и интеграции не могли разобрать ответ одним способом, а в
 * поддержке не за что было зацепиться: в ответе не было идентификатора,
 * по которому запрос ищется в логах.
 *
 * Поля прежних ответов сохраняются: `message` остаётся строкой или массивом
 * строк (ошибки валидации), дополнительные поля исключения — например
 * `dependents` у отказа удалить связанную запись — отдаются как прежде.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const requestId = currentRequestId();

    const { status, body, closeConnection } = this.describe(exception);

    /**
     * Соединение закрывается принудительно.
     *
     * Запрос отклонён, не дочитав тело: клиент продолжает слать данные,
     * и сокет остаётся занятым. Без явного закрытия такие соединения
     * копятся, а остановка процесса ждёт их до таймаута — в тестах это
     * видно как зависший `app.close()`, в эксплуатации как утечка сокетов.
     */
    if (closeConnection) {
      response.setHeader('Connection', 'close');
      response.on('finish', () => request.socket?.destroy());
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.path} → ${status}: ${this.reason(exception)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      code: STATUS_CODES[status] ?? 'ERROR',
      ...body,
      path: request.path,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  private describe(exception: unknown): {
    status: number;
    body: Record<string, unknown>;
    closeConnection?: boolean;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { status, body: { message: payload } };
      }
      const {
        statusCode: _ignored,
        error: _error,
        ...rest
      } = payload as Record<string, unknown>;
      return { status, body: rest };
    }

    /**
     * Гонка на уровне СУБД: запись изменилась между чтением и записью.
     * TypeORM сообщает об этом отдельной ошибкой; без обработки она
     * выглядела бы как внутренний сбой, хотя это обычный конфликт правок.
     */
    if (exception instanceof OptimisticLockVersionMismatchError) {
      return {
        status: HttpStatus.CONFLICT,
        body: {
          message:
            'Запись изменена другим пользователем, пока вы её редактировали. ' +
            'Обновите данные и повторите правку',
        },
      };
    }

    if (exception instanceof QueryFailedError) {
      const known = describeDatabaseError(exception);
      if (known) {
        return { status: known.status, body: { message: known.message } };
      }
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: { message: 'Внутренняя ошибка сервера' },
      };
    }

    /**
     * Ошибки разбора тела запроса приходят от body-parser обычным Error
     * со статусом в поле status: без этой ветки превышение предела и
     * битый JSON отдавались как «Внутренняя ошибка сервера», хотя это
     * ошибка запроса и клиент может её исправить.
     */
    const bodyError = exception as { status?: number; type?: string };
    if (
      typeof bodyError.status === 'number' &&
      bodyError.status >= 400 &&
      bodyError.status < 500 &&
      typeof bodyError.type === 'string'
    ) {
      return {
        status: bodyError.status,
        body: { message: BODY_ERRORS[bodyError.type] ?? 'Некорректный запрос' },
        closeConnection: true,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      // Текст исключения наружу не отдаётся: в нём бывают имена таблиц,
      // фрагменты запросов и пути файлов
      body: { message: 'Внутренняя ошибка сервера' },
    };
  }

  private reason(exception: unknown): string {
    if (exception instanceof Error) {
      return `${exception.name}: ${exception.message}`;
    }
    return String(exception);
  }
}
