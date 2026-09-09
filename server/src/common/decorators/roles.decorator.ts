import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@crm/shared';

export const ROLES_KEY = 'roles';

/** Ограничивает маршрут перечисленными ролями. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
