import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '@crm/shared';
import { configuration } from '../config/configuration';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: number;
  login: string;
  role: UserRole;
  sid?: string;
  jti?: string;
}

/** Проверяет access-токен и кладёт пользователя в request.user. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configuration().jwt.accessSecret,
    });
  }

  /**
   * Пользователь перечитывается из БД, чтобы отзыв доступа
   * (деактивация или смена роли) действовал до истечения токена.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.usersService.findOne(payload.sub).catch(() => null);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Учётная запись недоступна');
    }
    return {
      userId: user.userId,
      login: user.login,
      fullName: user.fullName,
      role: user.role,
      sessionId: payload.sid,
    };
  }
}
