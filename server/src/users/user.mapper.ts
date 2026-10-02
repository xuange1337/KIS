import { UserDto, UserRole } from '@crm/shared';
import { User } from './user.entity';

/**
 * Приводит сущность к DTO, гарантированно отбрасывая хеш пароля.
 *
 * Роль передаётся отдельно: она принадлежит не учётной записи, а
 * участию в организации, и у одного человека в разных организациях
 * может быть разной.
 */
export const toUserDto = (user: User, role: UserRole): UserDto => ({
  userId: user.userId,
  login: user.login,
  fullName: user.fullName,
  role,
  isActive: user.isActive,
  createdAt: user.createdAt?.toISOString(),
});

export const toUserDtoOrNull = (
  user: User | null | undefined,
  role: UserRole,
): UserDto | null => (user ? toUserDto(user, role) : null);
