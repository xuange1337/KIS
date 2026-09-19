import { SelectQueryBuilder } from 'typeorm';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Ограничение выборки организацией пользователя.
 *
 * Применяется до любых других условий и во всех модулях без исключения.
 * Разграничение по ролям (owner-scope) отвечает за то, кто внутри отдела
 * видит запись; принадлежность организации отвечает за то, существует ли
 * запись для этого пользователя вообще. Их нельзя смешивать: руководитель
 * и администратор видят «весь отдел», но только свой.
 */
export function applyTenantScope<T extends object>(
  qb: SelectQueryBuilder<T>,
  user: AuthUser,
  alias: string,
): SelectQueryBuilder<T> {
  return qb.andWhere(`${alias}.organizationId = :tenantOrganizationId`, {
    tenantOrganizationId: user.organizationId,
  });
}

/**
 * Принадлежит ли уже загруженная запись организации пользователя.
 * Ответ «нет» означает, что записи для него не существует, — и наружу
 * отдаётся 404, а не 403: иначе перебором идентификаторов выяснялось бы,
 * какие записи есть у соседней организации.
 */
export function belongsToTenant(
  user: AuthUser,
  organizationId: number | null | undefined,
): boolean {
  return organizationId === user.organizationId;
}
