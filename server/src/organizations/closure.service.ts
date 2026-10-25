import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CLOSED_RETENTION_DAYS,
  OrganizationStatus,
  UserRole,
} from '@crm/shared';
import { DataSource, Repository } from 'typeorm';
import { AppConfig } from '../config/configuration';
import { MailService } from '../mail/mail.service';
import { jobRuns } from '../metrics/metrics.registry';
import { organizationClosedMail } from '../mail/mail.templates';
import { MembersService } from './members.service';
import { Organization } from './organization.entity';
import { OrganizationMember } from './organization-member.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Таблицы с данными организации, попадающие в выгрузку.
 *
 * Журнал действий, сеансы, ключи идемпотентности и приглашения
 * намеренно исключены: это служебные данные сервиса, а не данные
 * заказчика.
 */
const EXPORT_TABLES = [
  'clients',
  'contacts',
  'deals',
  'deal_stage_history',
  'activities',
  'products',
  'commercial_offers',
  'offer_items',
] as const;

/**
 * Закрытие организации, выгрузка её данных и окончательное удаление.
 *
 * Закрытие обратимо в течение CLOSED_RETENTION_DAYS: организация
 * остаётся доступной для чтения и выгрузки, а владелец может её вернуть.
 * По истечении срока данные удаляются заданием.
 */
@Injectable()
export class ClosureService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClosureService.name);
  private timer?: NodeJS.Timeout;
  private startTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly members: Repository<OrganizationMember>,
    private readonly dataSource: DataSource,
    private readonly membersService: MembersService,
    private readonly mail: MailService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return;
    }
    const run = () =>
      void this.purgeClosed()
        .then(() => jobRuns.inc({ job: 'purge_closed', result: 'ok' }))
        .catch((error: Error) => {
          jobRuns.inc({ job: 'purge_closed', result: 'failed' });
          this.logger.error(`Удаление закрытых организаций: ${error.message}`);
        });
    this.startTimer = setTimeout(run, 2 * 60_000);
    this.timer = setInterval(run, 6 * 60 * 60 * 1000);
    this.startTimer.unref();
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.startTimer) clearTimeout(this.startTimer);
    if (this.timer) clearInterval(this.timer);
  }

  private async requireOwner(
    organizationId: number,
    userId: number,
  ): Promise<Organization> {
    const organization = await this.organizations.findOneOrFail({
      where: { organizationId },
    });
    if (organization.ownerUserId !== userId) {
      throw new ForbiddenException('Это действие доступно только владельцу');
    }
    return organization;
  }

  /** Все данные организации одним документом. */
  async exportData(organizationId: number): Promise<Record<string, unknown>> {
    const organization = await this.organizations.findOneOrFail({
      where: { organizationId },
    });
    const data: Record<string, unknown> = {
      format: 'crm-organization-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      organization: {
        name: organization.name,
        createdAt: organization.createdAt.toISOString(),
        status: organization.status,
      },
    };
    const members = await this.members.find({
      where: { organizationId },
      relations: { user: true },
      order: { membershipId: 'ASC' },
    });
    data.members = members.map((member) => ({
      login: member.user.login,
      fullName: member.user.fullName,
      email: member.user.email,
      role: member.role,
      isActive: member.user.isActive,
    }));
    for (const table of EXPORT_TABLES) {
      // Имя таблицы берётся из константы выше, не из запроса
      data[table] = await this.dataSource.query(
        `SELECT * FROM "${table}" WHERE organization_id = $1 ORDER BY 1`,
        [organizationId],
      );
    }
    return data;
  }

  /**
   * Закрытие организации владельцем.
   *
   * Подтверждается паролем и точным названием организации: действие
   * громкое, и случайный клик по соседней кнопке не должен его вызвать.
   */
  async close(
    organizationId: number,
    userId: number,
    password: string,
    confirmName: string,
  ): Promise<void> {
    const organization = await this.requireOwner(organizationId, userId);
    if (organization.status === OrganizationStatus.CLOSED) {
      throw new ConflictException('Организация уже закрыта');
    }
    if (confirmName.trim() !== organization.name) {
      throw new BadRequestException(
        'Название для подтверждения не совпадает с названием организации',
      );
    }
    await this.membersService.assertPassword(userId, password);

    const closedAt = new Date();
    await this.organizations.update(
      { organizationId },
      { status: OrganizationStatus.CLOSED, closedAt },
    );

    const purgeAt = new Date(
      closedAt.getTime() + CLOSED_RETENTION_DAYS * DAY_MS,
    );
    const admins = await this.members.find({
      where: { organizationId, role: UserRole.ADMIN },
      relations: { user: true },
    });
    for (const { user } of admins) {
      if (!user.isActive || !user.email || !user.emailVerifiedAt) continue;
      await this.mail.send(
        organizationClosedMail({
          to: user.email,
          organizationName: organization.name,
          purgeAt: purgeAt.toISOString(),
          url: this.config.get('appUrl', { infer: true }),
        }),
      );
    }
  }

  /** Возврат закрытой организации, пока данные не удалены. */
  async reopen(organizationId: number, userId: number): Promise<void> {
    const organization = await this.requireOwner(organizationId, userId);
    if (organization.status !== OrganizationStatus.CLOSED) {
      throw new ConflictException('Организация не закрыта');
    }
    // Был пробный период — возвращается он (истёкший остаётся чтением)
    await this.organizations.update(
      { organizationId },
      {
        status: organization.trialEndsAt
          ? OrganizationStatus.TRIAL
          : OrganizationStatus.ACTIVE,
        closedAt: null,
        trialNotifiedDays: null,
      },
    );
  }

  /**
   * Безвозвратное удаление организаций, закрытых дольше срока хранения.
   *
   * Таблиц с организацией много и порядок удаления определяют внешние
   * ключи. Вместо жёстко прописанного порядка таблицы удаляются по
   * кругу: те, что пока держат другие записи, откладываются до
   * следующего прохода. Если проход не удалил ни одной таблицы, значит
   * зависимость неразрешима, и вся транзакция откатывается — частично
   * удалённая организация хуже и нетронутой, и удалённой.
   *
   * @returns сколько организаций удалено.
   */
  async purgeClosed(now: Date = new Date()): Promise<number> {
    const threshold = new Date(now.getTime() - CLOSED_RETENTION_DAYS * DAY_MS);
    const expired = await this.organizations
      .createQueryBuilder('organization')
      .where('organization.status = :status', {
        status: OrganizationStatus.CLOSED,
      })
      .andWhere('organization.closed_at <= :threshold', { threshold })
      .getMany();

    let purged = 0;
    for (const organization of expired) {
      try {
        await this.purge(organization.organizationId);
        purged += 1;
        this.logger.log(`Организация ${organization.organizationId} удалена`);
      } catch (error) {
        this.logger.error(
          `Не удалось удалить организацию ${organization.organizationId}: ${(error as Error).message}`,
        );
      }
    }
    return purged;
  }

  private async purge(organizationId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const tables: { table_name: string }[] = await manager.query(
        `SELECT table_name FROM information_schema.columns
          WHERE column_name = 'organization_id'
            AND table_schema = 'public'
            AND table_name <> 'organizations'`,
      );
      const memberRows: { user_id: number }[] = await manager.query(
        `SELECT user_id FROM organization_members WHERE organization_id = $1`,
        [organizationId],
      );

      let pending = tables.map((row) => row.table_name);
      while (pending.length > 0) {
        const failed: string[] = [];
        for (const table of pending) {
          await manager.query('SAVEPOINT purge_table');
          try {
            await manager.query(
              `DELETE FROM "${table}" WHERE organization_id = $1`,
              [organizationId],
            );
            await manager.query('RELEASE SAVEPOINT purge_table');
          } catch {
            await manager.query('ROLLBACK TO SAVEPOINT purge_table');
            failed.push(table);
          }
        }
        if (failed.length === pending.length) {
          throw new Error(
            `не разрешены зависимости таблиц: ${failed.join(', ')}`,
          );
        }
        pending = failed;
      }

      await manager.query(
        `DELETE FROM organizations WHERE organization_id = $1`,
        [organizationId],
      );
      // Учётные записи, которым больше некуда входить
      const userIds = memberRows.map((row) => row.user_id);
      if (userIds.length > 0) {
        await manager.query(
          `DELETE FROM users u WHERE u.user_id = ANY($1)
             AND NOT EXISTS (
               SELECT 1 FROM organization_members m WHERE m.user_id = u.user_id
             )`,
          [userIds],
        );
      }
    });
  }
}
