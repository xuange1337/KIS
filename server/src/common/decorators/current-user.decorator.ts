import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OrganizationStatus, UserRole } from '@crm/shared';

/** Данные пользователя, извлечённые из access-токена. */
export interface AuthUser {
  userId: number;
  /** Организация пользователя: граница видимости всех данных. */
  organizationId: number;
  login: string;
  fullName: string;
  role: UserRole;
  sessionId?: string;
  /** Действующее состояние организации сеанса. */
  organizationStatus?: OrganizationStatus;
}

/** Достаёт пользователя, помещённый в запрос JwtStrategy. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
