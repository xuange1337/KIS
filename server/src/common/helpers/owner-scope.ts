import { UserRole } from '@crm/shared';
import { SelectQueryBuilder } from 'typeorm';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Разграничение видимости записей по ролям (ТЗ п. 1.1).
 *
 * Менеджер работает только со своими записями, руководитель и администратор
 * видят данные всего отдела. Хелпер используется всеми модулями, где есть
 * поле owner_user_id, — условие не дублируется по сервисам.
 */
export function applyOwnerScope<T extends object>(
  qb: SelectQueryBuilder<T>,
  user: AuthUser,
  alias: string,
  column = 'ownerUserId',
): SelectQueryBuilder<T> {
  if (canSeeAll(user)) {
    return qb;
  }
  return qb.andWhere(`${alias}.${column} = :scopedOwnerId`, {
    scopedOwnerId: user.userId,
  });
}

/** Видит ли пользователь данные всего отдела. */
export function canSeeAll(user: AuthUser): boolean {
  return user.role === UserRole.HEAD || user.role === UserRole.ADMIN;
}

/**
 * Проверка доступа к уже загруженной записи.
 * Возвращает false, если менеджер пытается открыть чужую запись.
 */
export function canAccess(
  user: AuthUser,
  ownerUserId: number | null | undefined,
): boolean {
  return canSeeAll(user) || ownerUserId === user.userId;
}
