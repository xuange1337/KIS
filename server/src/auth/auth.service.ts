import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditAction, LoginResponse, UserDto } from '@crm/shared';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { toUserDto } from '../users/user.mapper';
import { User } from '../users/user.entity';
import { AuditLog } from '../common/audit-log.entity';
import { configuration } from '../config/configuration';
import { JwtPayload } from './jwt.strategy';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly config = configuration();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /** Проверяет учётные данные и выдаёт пару токенов. */
  async login(dto: LoginDto): Promise<LoginResponse & { refreshToken: string }> {
    const user = await this.usersService.findByLoginWithPassword(dto.login);
    // Одинаковое сообщение для неверного логина и пароля — не подсказываем,
    // какая часть пары неверна
    const invalid = new UnauthorizedException('Неверный логин или пароль');
    if (!user) throw invalid;

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw invalid;
    if (!user.isActive) {
      throw new UnauthorizedException('Учётная запись заблокирована');
    }

    await this.auditRepo
      .save({
        userId: user.userId,
        entity: 'auth',
        entityId: String(user.userId),
        action: AuditAction.LOGIN,
        payload: { login: user.login },
      })
      .catch(() => undefined);

    return { ...this.issueTokens(user), user: toUserDto(user) };
  }

  /** Обновляет access-токен по refresh-токену из httpOnly cookie. */
  async refresh(refreshToken: string | undefined): Promise<LoginResponse & { refreshToken: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Сессия не найдена, войдите заново');
    }
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.jwt.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Сессия истекла, войдите заново');
    }

    const user = await this.usersService.findOne(payload.sub).catch(() => null);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Учётная запись недоступна');
    }
    return { ...this.issueTokens(user), user: toUserDto(user) };
  }

  async profile(userId: number): Promise<UserDto> {
    return toUserDto(await this.usersService.findOne(userId));
  }

  private issueTokens(user: User): { accessToken: string; refreshToken: string } {
    const payload: JwtPayload = {
      sub: user.userId,
      login: user.login,
      role: user.role,
    };
    return {
      accessToken: this.jwtService.sign(payload, {
        secret: this.config.jwt.accessSecret,
        expiresIn: this.config.jwt.accessTtl,
      }),
      refreshToken: this.jwtService.sign(payload, {
        secret: this.config.jwt.refreshSecret,
        expiresIn: this.config.jwt.refreshTtl,
      }),
    };
  }
}
