import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@crm/shared';

export const AUDIT_ENTITY_KEY = 'auditEntity';
export const AUDIT_ACTION_KEY = 'auditAction';

/**
 * Указывает, к какой сущности относятся мутации контроллера,
 * — используется AuditInterceptor при записи в журнал действий.
 */
export const AuditEntity = (entity: string) =>
  SetMetadata(AUDIT_ENTITY_KEY, entity);

/**
 * Явно задаёт действие для маршрута, которое нельзя вывести из HTTP-метода.
 * Нужно для выгрузок: они выполняются через GET, но должны попадать
 * в журнал наравне с изменениями данных (ТЗ п. 1.1).
 */
export const Audit = (action: AuditAction) =>
  SetMetadata(AUDIT_ACTION_KEY, action);
