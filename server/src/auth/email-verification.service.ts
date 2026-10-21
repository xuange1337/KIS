import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AppConfig } from '../config/configuration';
import { MailService } from '../mail/mail.service';
import { emailVerificationMail } from '../mail/mail.templates';
import { User } from '../users/user.entity';
import { EmailVerification } from './email-verification.entity';

/** Срок действия ссылки подтверждения. */
const VERIFICATION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** Приведение адреса к виду, в котором он хранится и сравнивается. */
export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

/**
 * Подтверждение адреса электронной почты.
 *
 * Адрес считается принадлежащим человеку, только когда он перешёл по
 * ссылке из письма. До этого адрес можно указать, но нельзя ни
 * восстановить по нему пароль, ни приглашать сотрудников, ни занять
 * им место в уникальном индексе.
 */
@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(EmailVerification)
    private readonly repo: Repository<EmailVerification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly mail: MailService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Подтверждённый владелец адреса, если он есть. */
  findVerifiedOwner(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .where('lower(user.email) = :email', { email: normalizeEmail(email) })
      .andWhere('user.email_verified_at IS NOT NULL')
      .getOne();
  }

  /**
   * Выпускает ссылку и отправляет письмо.
   *
   * Прежние неиспользованные ссылки гасятся: действующей остаётся одна.
   *
   * @returns true, если письмо передано почтовому серверу.
   */
  async issue(userId: number, email: string): Promise<boolean> {
    await this.repo.update(
      { userId, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    await this.repo.save({
      userId,
      email,
      tokenHash: this.hash(token),
      expiresAt,
      usedAt: null,
    });
    return this.mail.send(
      emailVerificationMail({
        to: email,
        url: `${this.config.get('appUrl', { infer: true })}/verify-email?token=${token}`,
        expiresAt: expiresAt.toISOString(),
      }),
    );
  }

  /** Указывает или меняет адрес пользователя и запрашивает подтверждение. */
  async setEmail(
    userId: number,
    rawEmail: string,
  ): Promise<{ email: string; sent: boolean }> {
    const email = normalizeEmail(rawEmail);
    const owner = await this.findVerifiedOwner(email);
    if (owner && owner.userId !== userId) {
      throw new ConflictException('Этот адрес уже используется');
    }
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    // Тот же уже подтверждённый адрес менять не нужно
    if (
      user.emailVerifiedAt &&
      user.email &&
      normalizeEmail(user.email) === email
    ) {
      return { email, sent: false };
    }
    await this.userRepo.update({ userId }, { email, emailVerifiedAt: null });
    return { email, sent: await this.issue(userId, email) };
  }

  /** Повторная отправка письма для ещё не подтверждённого адреса. */
  async resend(userId: number): Promise<{ sent: boolean }> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user?.email) {
      throw new BadRequestException('Адрес электронной почты не указан');
    }
    if (user.emailVerifiedAt) {
      throw new BadRequestException('Адрес уже подтверждён');
    }
    return { sent: await this.issue(userId, user.email) };
  }

  /**
   * Подтверждение по ссылке.
   *
   * Ссылка гасится в той же транзакции, что и подтверждение: две
   * одновременных проверки не должны подтвердить адрес дважды.
   */
  async verify(token: string): Promise<{ email: string }> {
    const invalid = new BadRequestException(
      'Ссылка недействительна или устарела',
    );
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EmailVerification);
      const record = await repo.findOne({
        where: { tokenHash: this.hash(token) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!record || record.usedAt || record.expiresAt <= new Date()) {
        throw invalid;
      }
      const users = manager.getRepository(User);
      const user = await users.findOne({ where: { userId: record.userId } });
      // Адрес в профиле успели сменить: эта ссылка относится к прежнему
      if (!user || !user.email || normalizeEmail(user.email) !== record.email) {
        throw invalid;
      }
      const owner = await users
        .createQueryBuilder('user')
        .where('lower(user.email) = :email', { email: record.email })
        .andWhere('user.email_verified_at IS NOT NULL')
        .andWhere('user.user_id <> :userId', { userId: user.userId })
        .getOne();
      if (owner) {
        throw new ConflictException(
          'Этот адрес уже подтверждён другой учётной записью',
        );
      }
      record.usedAt = new Date();
      await repo.save(record);
      await users.update(
        { userId: user.userId },
        { emailVerifiedAt: new Date() },
      );
      return { email: record.email };
    });
  }
}
