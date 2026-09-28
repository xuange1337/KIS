import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditAction, LoginResponse, SessionDto, UserDto } from '@crm/shared';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { toUserDto } from '../users/user.mapper';
import { User } from '../users/user.entity';
import { AuditLog } from '../common/audit-log.entity';
import { configuration } from '../config/configuration';
import { JwtPayload } from './jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { RefreshSession } from './refresh-session.entity';
import { PasswordReset } from './password-reset.entity';
import { ChangePasswordDto, ResetPasswordDto } from './dto/password.dto';

/**
 * Хеш заведомо недостижимого пароля: используется, когда логина не
 * существует, чтобы проверка занимала столько же времени, сколько обычная.
 * Пароль — случайная строка, сгенерированная при старте процесса, поэтому
 * совпасть с ним нельзя даже теоретически.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  randomBytes(32).toString('hex'),
  10,
);

/**
 * Срок жизни ссылки на установку пароля.
 *
 * Сутки: ссылку передают лично или пересылают, и требовать перехода за
 * час значит гарантировать вторую просьбу к администратору.
 */
const RESET_TTL_MS = 24 * 60 * 60 * 1000;

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
    @InjectRepository(PasswordReset)
    private readonly resetRepo: Repository<PasswordReset>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cleanupSessions();
    this.cleanupTimer = setInterval(
      () => void this.cleanupSessions(),
      6 * 60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  /** Проверяет учётные данные и выдаёт пару токенов. */
  async login(
    dto: LoginDto,
  ): Promise<LoginResponse & { refreshToken: string }> {
    const user = await this.usersService.findByLoginWithPassword(dto.login);
    // Одинаковое сообщение для неверного логина и пароля — не подсказываем,
    // какая часть пары неверна
    const invalid = new UnauthorizedException('Неверный логин или пароль');

    /**
     * Хеш сверяется и для несуществующего логина.
     *
     * Ранний выход экономил ~80 мс bcrypt, и по времени ответа несуществующий
     * логин отличался от существующего с неверным паролем: перебором
     * словаря логинов собирался список действующих учётных записей,
     * а дальше подбор шёл только по ним.
     */
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches) throw invalid;
    if (!user.isActive) {
      throw new UnauthorizedException('Учётная запись заблокирована');
    }

    await this.auditRepo
      .save({
        organizationId: user.organizationId,
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
  async refresh(
    refreshToken: string | undefined,
  ): Promise<LoginResponse & { refreshToken: string }> {
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
        /**
         * Предъявлен старый токен этой сессии: либо он был украден, либо
         * украден текущий, а старый предъявляет законный владелец. Отличить
         * одно от другого нельзя, поэтому отзывается не только эта сессия,
         * но и все остальные сессии пользователя: у злоумышленника могла
         * остаться ещё одна пара токенов, выпущенная тем же украденным
         * токеном раньше.
         */
        await repo
          .createQueryBuilder()
          .update(RefreshSession)
          .set({ revokedAt: new Date() })
          .where('user_id = :userId', { userId: session.userId })
          .andWhere('revoked_at IS NULL')
          .execute();
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
      const decoded = this.jwtService.decode(tokens.refreshToken) as {
        exp: number;
      };
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
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret: this.config.jwt.refreshSecret,
        },
      );
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

  async listSessions(
    userId: number,
    currentSessionId?: string,
  ): Promise<SessionDto[]> {
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

  /**
   * Смена собственного пароля.
   *
   * Все сессии, кроме текущей, отзываются: пароль меняют в том числе
   * потому, что подозревают чужой доступ, и оставлять открытыми старые
   * входы значит не решить ровно ту задачу, ради которой его меняют.
   */
  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
    currentSessionId: string | undefined,
  ): Promise<void> {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedException('Учётная запись недоступна');
    }
    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Текущий пароль указан неверно');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Новый пароль совпадает с текущим');
    }

    await this.usersService.setPassword(userId, dto.newPassword);
    await this.revokeOtherSessions(userId, currentSessionId);
  }

  /**
   * Выдача одноразовой ссылки на установку пароля.
   *
   * Возвращается один раз и больше нигде не хранится в открытом виде:
   * в базе лежит только отпечаток. Прежние невыданные ссылки гасятся —
   * иначе у одной учётной записи копились бы действующие входы.
   */
  async issuePasswordReset(
    userId: number,
    issuedBy: number,
  ): Promise<{ token: string; expiresAt: string }> {
    await this.resetRepo.update(
      { userId, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await this.resetRepo.save({
      userId,
      tokenHash: this.hashToken(token),
      expiresAt,
      usedAt: null,
      issuedBy,
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Установка пароля по одноразовой ссылке.
   *
   * Ссылка гасится в той же транзакции, что и смена пароля: иначе два
   * одновременных перехода по одной ссылке установили бы разные пароли,
   * и владелец учётной записи не знал бы ни одного из них.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const invalid = new BadRequestException(
      'Ссылка недействительна или уже использована. Запросите новую',
    );
    const tokenHash = this.hashToken(dto.token);

    const userId = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PasswordReset);
      const reset = await repo.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });
      if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
        return null;
      }
      reset.usedAt = new Date();
      await repo.save(reset);
      return reset.userId;
    });

    if (!userId) throw invalid;

    await this.usersService.setPassword(userId, dto.newPassword);
    // Все сессии закрываются: ссылкой пользуются, когда доступ потерян
    // или скомпрометирован
    await this.revokeAllSessions(userId);
  }

  async profile(userId: number): Promise<UserDto> {
    // Организация здесь не передаётся: пользователь запрашивает сам себя
    return toUserDto(await this.usersService.findOne(userId));
  }

  /** Закрывает все сессии пользователя, кроме указанной. */
  private async revokeOtherSessions(
    userId: number,
    keepSessionId: string | undefined,
  ): Promise<void> {
    const qb = this.sessionRepo
      .createQueryBuilder()
      .update(RefreshSession)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL');
    if (keepSessionId) {
      qb.andWhere('session_id <> :keepSessionId', { keepSessionId });
    }
    await qb.execute();
  }

  private async createSession(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = randomUUID();
    const tokens = this.issueTokens(user, sessionId);
    const decoded = this.jwtService.decode(tokens.refreshToken) as {
      exp: number;
    };
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
      refreshToken: this.jwtService.sign(
        {
          ...payload,
          jti: randomUUID(),
        },
        {
          secret: this.config.jwt.refreshSecret,
          expiresIn: this.config.jwt.refreshTtl,
        },
      ),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashesEqual(left: string, right: string): boolean {
    return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
  }

  private async cleanupSessions(): Promise<void> {
    await this.resetRepo
      .createQueryBuilder()
      .delete()
      .from(PasswordReset)
      .where('expires_at < now()')
      .execute()
      .catch(() => undefined);
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
