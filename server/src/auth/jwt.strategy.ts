import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '@crm/shared';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { configuration } from '../config/configuration';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { RefreshSession } from './refresh-session.entity';
import { currentRequestContext } from '../common/logging/request-context';

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
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(RefreshSession)
    private readonly sessionRepo: Repository<RefreshSession>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configuration().jwt.accessSecret,
    });
  }

  /**
   * Пользователь перечитывается из БД, чтобы отзыв доступа
   * (деактивация или смена роли) действовал до истечения токена.
   *
   * Вместе с пользователем проверяется и сессия, к которой привязан токен.
   * Без этой проверки выход, «завершить все сессии», смена пароля и
   * блокировка отзывали только refresh-токен, а выданный access-токен
   * продолжал открывать API до конца своего срока (по умолчанию 15 минут) —
   * то есть кнопка «завершить сессию» не завершала доступ.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sid) {
      throw new UnauthorizedException('Сессия недействительна, войдите заново');
    }
    const session = await this.sessionRepo.findOne({
      where: {
        sessionId: payload.sid,
        userId: payload.sub,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      select: { sessionId: true },
    });
    if (!session) {
      throw new UnauthorizedException('Сессия завершена, войдите заново');
    }

    const user = await this.usersService.findOne(payload.sub).catch(() => null);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Учётная запись недоступна');
    }
    // Пользователь попадает в контекст запроса: без него строки лога
    // одного инцидента нельзя связать с учётной записью
    const context = currentRequestContext();
    if (context) {
      context.userId = user.userId;
    }

    return {
      userId: user.userId,
      // Организация берётся из БД, а не из токена: перевод пользователя
      // в другую организацию должен действовать сразу, а подделанное
      // значение в токене не должно открывать чужие данные
      organizationId: user.organizationId,
      login: user.login,
      fullName: user.fullName,
      role: user.role,
      sessionId: payload.sid,
    };
  }
}
