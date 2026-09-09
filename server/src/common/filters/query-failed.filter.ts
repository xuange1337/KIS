import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

/** Коды ошибок PostgreSQL, которым соответствует ошибка ввода, а не сбой. */
const USER_ERRORS: Record<string, { status: number; message: string }> = {
  '23503': {
    status: HttpStatus.CONFLICT,
    message: 'Запись связана с другими данными и не может быть изменена или удалена',
  },
  '23505': {
    status: HttpStatus.CONFLICT,
    message: 'Запись с такими данными уже существует',
  },
  '23514': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Значение поля выходит за допустимые границы',
  },
  '22003': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Числовое значение слишком велико',
  },
  '22001': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Значение поля слишком длинное',
  },
};

/**
 * Переводит ошибки СУБД в осмысленные ответы.
 *
 * Без этого нарушение ограничения БД (переполнение numeric, внешний ключ,
 * CHECK) отдавалось как «Внутренняя ошибка сервера», и пользователь не мог
 * понять, что именно во вводе неверно.
 */
@Catch(QueryFailedError)
export class QueryFailedFilter implements ExceptionFilter {
  private readonly logger = new Logger(QueryFailedFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    // Код лежит либо на самой ошибке, либо в обёрнутой ошибке драйвера
    const code =
      (exception as unknown as { code?: string }).code ??
      (exception.driverError as { code?: string } | undefined)?.code;

    const known = code ? USER_ERRORS[code] : undefined;
    if (!known) {
      this.logger.error(
        `Необработанная ошибка СУБД (${code ?? 'без кода'}): ${exception.message}`,
      );
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Внутренняя ошибка сервера',
      });
      return;
    }

    response.status(known.status).json({
      statusCode: known.status,
      message: known.message,
    });
  }
}
