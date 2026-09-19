import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditAction } from '@crm/shared';
import { Observable, from, mergeMap } from 'rxjs';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit-log.entity';
import {
  AUDIT_ACTION_KEY,
  AUDIT_ENTITY_KEY,
} from '../decorators/audit.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

/** Поля, которые в журнал не попадают вовсе. */
const SECRET_FIELDS = new Set([
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'token',
  'refreshToken',
  'accessToken',
]);

/**
 * Поля со свободным текстом: фиксируется только факт изменения.
 * Содержимое остаётся в самой записи, читать его следует там,
 * с учётом прав доступа, а не в журнале.
 */
const PERSONAL_TEXT_FIELDS = new Set([
  'comment',
  'result',
  'address',
  'email',
  'phone',
  'inn',
  'fileRef',
]);

const MASKED = '[скрыто]';

/** Предел длины строкового значения в журнале, символов. */
const MAX_VALUE_LENGTH = 256;

const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

/**
 * Пишет в журнал успешные изменяющие запросы и выгрузки отчётов (ТЗ п. 1.1).
 *
 * Действие определяется по HTTP-методу либо задаётся явно декоратором
 * @Audit() — так в журнал попадают выгрузки, выполняемые через GET.
 * Сущность берётся из @AuditEntity() на контроллере; без него запись не ведётся.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const explicitAction = this.reflector.getAllAndOverride<AuditAction>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    const action = explicitAction ?? METHOD_TO_ACTION[request.method];
    const entity = this.reflector.getAllAndOverride<string>(AUDIT_ENTITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!action || !entity) {
      return next.handle();
    }

    const user: AuthUser | undefined = request.user;

    return next.handle().pipe(
      // Запись дожидается завершения до отдачи ответа: иначе сбой вставки
      // остаётся незамеченным, а сама вставка может пережить закрытие
      // приложения и оборваться на разорванном соединении
      mergeMap((result) =>
        from(this.write(request, user, entity, action, result)).pipe(
          mergeMap(() => [result]),
        ),
      ),
    );
  }

  private async write(
    request: any,
    user: AuthUser | undefined,
    entity: string,
    action: AuditAction,
    result: unknown,
  ): Promise<void> {
    try {
      await this.auditRepo.save({
        // Организация берётся из пользователя: запись журнала принадлежит
        // той же организации, что и действие, и не видна соседней
        organizationId: user?.organizationId ?? null,
        userId: user?.userId ?? null,
        entity,
        entityId: this.resolveEntityId(request, result),
        action,
        payload: this.buildPayload(request),
      });
    } catch (error) {
      // Журнал не должен ронять основной запрос: пользователь получит
      // результат, а сбой журналирования попадёт в логи сервера
      this.logger.error(
        `Не удалось записать действие в журнал: ${String(error)}`,
      );
    }
  }

  private resolveEntityId(request: any, result: unknown): string | null {
    if (request.params?.id) {
      return String(request.params.id);
    }
    // У выгрузки идентификатор — имя отчёта в пути
    if (request.params?.report) {
      return String(request.params.report);
    }
    if (result && typeof result === 'object') {
      const record = result as Record<string, unknown>;
      const idKey = Object.keys(record).find((key) => key.endsWith('Id'));
      if (idKey) return String(record[idKey]);
    }
    return null;
  }

  private buildPayload(request: any): Record<string, unknown> {
    const body = this.maskSensitive(request.body);
    const query = this.maskSensitive(request.query);
    return {
      method: request.method,
      path: this.maskPath(request.url),
      ...(Object.keys(body).length > 0 ? { body } : {}),
      ...(Object.keys(query).length > 0 ? { query } : {}),
    };
  }

  /**
   * Маскирует чувствительные поля и обрезает длинные значения.
   *
   * Журнал хранится дольше самих данных и выгружается для разбора инцидентов,
   * поэтому в него не должны попадать ни секреты, ни свободный текст с
   * персональными данными: комментарий к активности или результат звонка
   * могут содержать что угодно, вплоть до паспортных данных клиента.
   * Сохраняется факт изменения поля, а не его содержимое.
   */
  private maskSensitive(source: unknown): Record<string, unknown> {
    if (!source || typeof source !== 'object') {
      return {};
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      source as Record<string, unknown>,
    )) {
      if (SECRET_FIELDS.has(key)) {
        continue;
      }
      if (PERSONAL_TEXT_FIELDS.has(key)) {
        result[key] = MASKED;
        continue;
      }
      if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
        result[key] = `${value.slice(0, MAX_VALUE_LENGTH)}…`;
        continue;
      }
      if (value !== null && typeof value === 'object') {
        result[key] = MASKED;
        continue;
      }
      result[key] = value;
    }
    return result;
  }

  /** Из пути убирается строка запроса: она уже разобрана и замаскирована. */
  private maskPath(url: unknown): string {
    return typeof url === 'string' ? url.split('?')[0] : '';
  }
}
