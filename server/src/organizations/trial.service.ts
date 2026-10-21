import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { OrganizationStatus, UserRole } from '@crm/shared';
import { Repository } from 'typeorm';
import { AppConfig } from '../config/configuration';
import { MailService } from '../mail/mail.service';
import { trialReminderMail } from '../mail/mail.templates';
import { Organization } from './organization.entity';
import { OrganizationMember } from './organization-member.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

/** За сколько дней до конца предупреждать; 0 — день окончания. */
const REMINDER_THRESHOLDS = [7, 3, 1];

/**
 * Напоминания об окончании пробного периода.
 *
 * Задание идемпотентно: у организации хранится порог, по которому уже
 * отправлено письмо, поэтому повторный запуск или перезапуск процесса
 * не шлёт одно и то же. Доступ окончание пробного периода не меняет —
 * состояние вычисляется отдельно, письмо лишь предупреждает человека.
 */
@Injectable()
export class TrialService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrialService.name);
  private timer?: NodeJS.Timeout;
  private startTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly members: Repository<OrganizationMember>,
    private readonly mail: MailService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return;
    }
    const run = () =>
      void this.sendReminders().catch((error: Error) =>
        this.logger.error(`Напоминания о пробном периоде: ${error.message}`),
      );
    this.startTimer = setTimeout(run, 60_000);
    this.timer = setInterval(run, 60 * 60 * 1000);
    this.startTimer.unref();
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.startTimer) clearTimeout(this.startTimer);
    if (this.timer) clearInterval(this.timer);
  }

  /** Порог, по которому сейчас нужно предупредить; null — рано. */
  static thresholdFor(trialEndsAt: Date, now: Date): number | null {
    const left = trialEndsAt.getTime() - now.getTime();
    if (left <= 0) {
      return 0;
    }
    const days = Math.ceil(left / DAY_MS);
    const threshold = [...REMINDER_THRESHOLDS]
      .sort((a, b) => a - b)
      .find((value) => days <= value);
    return threshold ?? null;
  }

  /** @returns сколько организаций получили напоминание. */
  async sendReminders(now: Date = new Date()): Promise<number> {
    const trials = await this.organizations.find({
      where: { status: OrganizationStatus.TRIAL, isActive: true },
    });
    let notified = 0;
    for (const organization of trials) {
      if (!organization.trialEndsAt) continue;
      const threshold = TrialService.thresholdFor(
        organization.trialEndsAt,
        now,
      );
      if (threshold === null) continue;
      if (
        organization.trialNotifiedDays !== null &&
        organization.trialNotifiedDays <= threshold
      ) {
        continue;
      }

      const admins = await this.members.find({
        where: {
          organizationId: organization.organizationId,
          role: UserRole.ADMIN,
        },
        relations: { user: true },
      });
      for (const { user } of admins) {
        if (!user.isActive || !user.email || !user.emailVerifiedAt) continue;
        await this.mail.send(
          trialReminderMail({
            to: user.email,
            organizationName: organization.name,
            daysLeft: threshold,
            trialEndsAt: organization.trialEndsAt.toISOString(),
            url: this.config.get('appUrl', { infer: true }),
          }),
        );
      }
      await this.organizations.update(
        { organizationId: organization.organizationId },
        { trialNotifiedDays: threshold },
      );
      notified += 1;
    }
    return notified;
  }
}
