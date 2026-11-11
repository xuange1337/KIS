import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { configuration } from '../config/configuration';
import { User } from '../users/user.entity';
import { Client } from '../clients/client.entity';
import { Contact } from '../contacts/contact.entity';
import { Deal } from '../deals/deal.entity';
import { DealStageHistory } from '../deals/deal-stage-history.entity';
import { DealItem } from '../deals/deal-item.entity';
import { Activity } from '../activities/activity.entity';
import { Offer } from '../offers/offer.entity';
import { Product } from '../products/product.entity';
import { OfferItem } from '../offers/offer-item.entity';
import { SavedFilter } from '../personal/saved-filter.entity';
import { Favorite } from '../personal/favorite.entity';
import { Tag } from '../tags/tag.entity';
import { ClientTag } from '../tags/client-tag.entity';
import { Notification } from '../notifications/notification.entity';
import { AuditLog } from '../common/audit-log.entity';
import { RefreshSession } from '../auth/refresh-session.entity';
import { IdempotencyKey } from '../common/idempotency/idempotency-key.entity';
import { ExportJob } from '../reports/jobs/export-job.entity';
import { PasswordReset } from '../auth/password-reset.entity';
import { EmailVerification } from '../auth/email-verification.entity';
import { Organization } from '../organizations/organization.entity';
import { OrganizationMember } from '../organizations/organization-member.entity';
import { OrganizationInvitation } from '../organizations/organization-invitation.entity';

export const ENTITIES = [
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  User,
  Client,
  Contact,
  Deal,
  DealStageHistory,
  DealItem,
  Activity,
  Offer,
  Product,
  OfferItem,
  SavedFilter,
  Favorite,
  Tag,
  ClientTag,
  Notification,
  AuditLog,
  RefreshSession,
  IdempotencyKey,
  ExportJob,
  PasswordReset,
  EmailVerification,
];

/**
 * Деловой часовой пояс подключения.
 *
 * В нём вычисляются границы периодов в отчётах, группировка по месяцам
 * и признак просроченной активности. Задаётся на самом соединении, а не
 * только переменной окружения контейнера: драйвер pg её не применяет,
 * и запросы выполнялись бы в UTC, расходясь с тем, что видит пользователь.
 */
const SESSION_TIME_ZONE = process.env.TZ ?? 'Europe/Moscow';

export const buildDataSourceOptions = (): DataSourceOptions => {
  const config = configuration();
  return {
    type: 'postgres',
    extra: { options: `-c timezone=${SESSION_TIME_ZONE}` },
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    username: config.database.user,
    password: config.database.password,
    entities: ENTITIES,
    migrations: [__dirname + '/migrations/*.{ts,js}'],
    // Схема меняется только миграциями — synchronize опасен для учебных данных
    synchronize: false,
    // При старте контейнера миграции применяются автоматически
    migrationsRun: config.nodeEnv === 'production',
    logging: config.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
  };
};

/** Экземпляр для CLI typeorm (генерация и прогон миграций). */
export default new DataSource(buildDataSourceOptions());
