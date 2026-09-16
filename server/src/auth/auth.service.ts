import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditAction, LoginResponse, SessionDto, UserDto } from '@crm/shared';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { toUserDto } from '../users/user.mapper';
import { User } from '../users/user.entity';
import { AuditLog } from '../common/audit-log.entity';
import { configuration } from '../config/configuration';
import { JwtPayload } from './jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { RefreshSession } from './refresh-session.entity';

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly config = configuration();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(RefreshSession)
    private readonly sessionRepo: Repository<RefreshSession>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cleanupSessions();
    this.cleanupTimer = setInterval(() => void this.cleanupSessions(), 6 * 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

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

    return { ...(await this.createSession(user)), user: toUserDto(user) };
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

    if (!payload.sid) {
      throw new UnauthorizedException('Сессия истекла, войдите заново');
    }

    const tokenHash = this.hashToken(refreshToken);
    const rotated = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RefreshSession);
      const session = await repo.findOne({
        where: { sessionId: payload.sid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        return null;
      }
      if (!this.hashesEqual(session.tokenHash, tokenHash)) {
        session.revokedAt = new Date();
        await repo.save(session);
        return null;
      }
      const user = await manager.getRepository(User).findOne({
        where: { userId: payload.sub },
      });
      if (!user || !user.isActive || user.userId !== session.userId) {
        session.revokedAt = new Date();
        await repo.save(session);
        return null;
      }
      const tokens = this.issueTokens(user, session.sessionId);
      const decoded = this.jwtService.decode(tokens.refreshToken) as { exp: number };
      session.tokenHash = this.hashToken(tokens.refreshToken);
      session.expiresAt = new Date(decoded.exp * 1000);
      session.lastUsedAt = new Date();
      await repo.save(session);
      return { tokens, user };
    });

    if (!rotated) {
      throw new UnauthorizedException('Учётная запись недоступна');
    }
    return { ...rotated.tokens, user: toUserDto(rotated.user) };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.jwt.refreshSecret,
      });
      if (payload.sid) {
        await this.sessionRepo.update(
          { sessionId: payload.sid, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
      }
    } catch {
      return;
    }
  }

  async listSessions(userId: number, currentSessionId?: string): Promise<SessionDto[]> {
    const sessions = await this.sessionRepo.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastUsedAt: 'DESC' },
    });
    return sessions
      .filter((session) => session.expiresAt > new Date())
      .map((session) => ({
        sessionId: session.sessionId,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        isCurrent: session.sessionId === currentSessionId,
      }));
  }

  async revokeSession(userId: number, sessionId: string): Promise<void> {
    await this.sessionRepo.update(
      { userId, sessionId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllSessions(userId: number): Promise<void> {
    await this.sessionRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async profile(userId: number): Promise<UserDto> {
    return toUserDto(await this.usersService.findOne(userId));
  }

  private async createSession(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = randomUUID();
    const tokens = this.issueTokens(user, sessionId);
    const decoded = this.jwtService.decode(tokens.refreshToken) as { exp: number };
    await this.sessionRepo.save({
      sessionId,
      userId: user.userId,
      tokenHash: this.hashToken(tokens.refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
      revokedAt: null,
      lastUsedAt: new Date(),
    });
    return tokens;
  }

  private issueTokens(
    user: User,
    sessionId: string,
  ): { accessToken: string; refreshToken: string } {
    const payload: JwtPayload = {
      sub: user.userId,
      login: user.login,
      role: user.role,
      sid: sessionId,
    };
    return {
      accessToken: this.jwtService.sign(payload, {
        secret: this.config.jwt.accessSecret,
        expiresIn: this.config.jwt.accessTtl,
      }),
      refreshToken: this.jwtService.sign({
        ...payload,
        jti: randomUUID(),
      }, {
        secret: this.config.jwt.refreshSecret,
        expiresIn: this.config.jwt.refreshTtl,
      }),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashesEqual(left: string, right: string): boolean {
    return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
  }

  private async cleanupSessions(): Promise<void> {
    const revokedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await this.sessionRepo
      .createQueryBuilder()
      .delete()
      .from(RefreshSession)
      .where('expires_at < now()')
      .orWhere('revoked_at < :revokedCutoff', { revokedCutoff })
      .execute();
  }
}
