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
      mergeMap((result) => from(this.write(request, user, entity, action, result))
        .pipe(mergeMap(() => [result]))),
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
    const body = { ...(request.body ?? {}) };
    // Пароли в журнал не попадают
    delete body.password;
    delete body.passwordHash;
    return {
      method: request.method,
      path: request.url,
      ...(Object.keys(body).length > 0 ? { body } : {}),
      ...(Object.keys(request.query ?? {}).length > 0
        ? { query: request.query }
        : {}),
    };
  }
}
