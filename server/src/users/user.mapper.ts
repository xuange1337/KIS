import { UserDto } from '@crm/shared';
import { User } from './user.entity';

/** Приводит сущность к DTO, гарантированно отбрасывая хеш пароля. */
export const toUserDto = (user: User): UserDto => ({
  userId: user.userId,
  login: user.login,
  fullName: user.fullName,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt?.toISOString(),
});

export const toUserDtoOrNull = (
  user: User | null | undefined,
): UserDto | null => (user ? toUserDto(user) : null);
