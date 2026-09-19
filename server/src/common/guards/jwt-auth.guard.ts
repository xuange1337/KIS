import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Глобальный guard: все маршруты требуют access-токена,
 * кроме помеченных декоратором @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic ? true : super.canActivate(context);
  }

  /**
   * Сообщение об отсутствии токена задаётся явно: Passport отдаёт своё
   * английское «Unauthorized», и оно одно выбивалось из русскоязычных
   * ответов API, попадая прямо в интерфейс.
   */
  handleRequest<TUser>(
    error: unknown,
    user: TUser,
    _info: unknown,
    _context: ExecutionContext,
  ): TUser {
    if (error) throw error;
    if (!user) {
      throw new UnauthorizedException('Требуется авторизация');
    }
    return user;
  }
}
