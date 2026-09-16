import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@crm/shared';

/** Данные пользователя, извлечённые из access-токена. */
export interface AuthUser {
  userId: number;
  login: string;
  fullName: string;
  role: UserRole;
  sessionId?: string;
}

/** Достаёт пользователя, помещённый в запрос JwtStrategy. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
