import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Observable, from, mergeMap, of } from 'rxjs';
import { LessThan, QueryFailedError, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AuthUser } from '../decorators/current-user.decorator';
import { IdempotencyKey } from './idempotency-key.entity';

/** Заголовок ключа идемпотентности. */
export const IDEMPOTENCY_HEADER = 'idempotency-key';

/** Максимальная длина ключа: значение приходит снаружи. */
const MAX_KEY_LENGTH = 128;

/** Срок хранения ключей. Повтор имеет смысл в пределах суток. */
const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Код нарушения уникальности в PostgreSQL. */
const UNIQUE_VIOLATION = '23505';

/**
 * Идемпотентность операций создания.
 *
 * Клиент отправляет запрос, ответ теряется по дороге (обрыв связи,
 * таймаут прокси), клиент повторяет — и появляется вторая сделка или
 * второе коммерческое предложение. Заметить это можно только глазами,
 * а чинить руками.
 *
 * С заголовком Idempotency-Key повтор возвращает результат первой
 * попытки. Ключ сначала вставляется в таблицу с уникальным индексом:
 * именно вставка, а не проверка «есть ли запись», делает механизм
 * устойчивым к одновременным повторам — второй запрос натыкается на
 * нарушение уникальности и не выполняет операцию.
 *
 * Заголовок необязателен: без него поведение прежнее.
 */
@Injectable()
export class IdempotencyInterceptor
  implements NestInterceptor, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cleanup();
    this.cleanupTimer = setInterval(() => void this.cleanup(), RETENTION_MS);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const key = request.get?.(IDEMPOTENCY_HEADER);
    const user: AuthUser | undefined = request.user;

    if (
      request.method !== 'POST' ||
      typeof key !== 'string' ||
      key.length === 0 ||
      !user
    ) {
      return next.handle();
    }
    if (key.length > MAX_KEY_LENGTH) {
      throw new ConflictException(
        `Ключ идемпотентности длиннее ${MAX_KEY_LENGTH} символов`,
      );
    }

    const endpoint = `${request.method} ${String(request.path ?? request.url).split('?')[0]}`;
    const requestHash = createHash('sha256')
      .update(JSON.stringify(request.body ?? {}))
      .digest('hex');

    return from(this.reserve(key, user, endpoint, requestHash)).pipe(
      mergeMap((stored) => {
        if (stored) {
          return of(stored);
        }
        return next
          .handle()
          .pipe(
            mergeMap((result) =>
              from(this.complete(key, user, result)).pipe(
                mergeMap(() => of(result)),
              ),
            ),
          );
      }),
    );
  }

  /**
   * Занимает ключ. Возвращает сохранённый ответ, если операция уже
   * выполнялась, и null, если выполнять её нужно сейчас.
   */
  private async reserve(
    key: string,
    user: AuthUser,
    endpoint: string,
    requestHash: string,
  ): Promise<unknown | null> {
    try {
      await this.repo.insert({
        key,
        userId: user.userId,
        organizationId: user.organizationId,
        endpoint,
        requestHash,
        statusCode: null,
        response: null,
      });
      return null;
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
    }

    const existing = await this.repo.findOne({
      where: { key, userId: user.userId },
    });
    if (!existing) {
      // Запись исчезла между вставкой и чтением — это возможно только
      // при одновременной очистке; выполняем операцию как обычно
      return null;
    }
    if (
      existing.endpoint !== endpoint ||
      existing.requestHash !== requestHash
    ) {
      throw new ConflictException(
        'Этот ключ идемпотентности уже использован для другого запроса',
      );
    }
    if (existing.statusCode === null) {
      throw new ConflictException(
        'Запрос с этим ключом ещё выполняется. Повторите позже',
      );
    }
    return existing.response;
  }

  private async complete(
    key: string,
    user: AuthUser,
    result: unknown,
  ): Promise<void> {
    try {
      await this.repo.update({ key, userId: user.userId }, {
        statusCode: 201,
        // Тело ответа кладётся в jsonb как есть; глубокий частичный тип
        // TypeORM разбирает его по полям и не принимает произвольный
        // объект, поэтому приведение здесь одно и на месте
        response: result,
      } as QueryDeepPartialEntity<IdempotencyKey>);
    } catch (error) {
      // Операция уже выполнена: ронять из-за журнала повторов нельзя,
      // но повтор тогда не найдёт ответа и выполнится заново
      this.logger.error(
        `Не удалось сохранить результат по ключу: ${String(error)}`,
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const code =
      (error as unknown as { code?: string }).code ??
      (error.driverError as { code?: string } | undefined)?.code;
    return code === UNIQUE_VIOLATION;
  }

  private async cleanup(): Promise<void> {
    try {
      await this.repo.delete({
        createdAt: LessThan(new Date(Date.now() - RETENTION_MS)),
      });
    } catch (error) {
      this.logger.error(`Не удалось очистить ключи: ${String(error)}`);
    }
  }
}
