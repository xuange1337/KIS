import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Notification } from './notification.entity';

export interface NewNotification {
  organizationId: number;
  userId: number;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  dedupeKey: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Создаёт уведомление; повтор того же события молча игнорируется. */
  async notify(item: NewNotification): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({
        organizationId: item.organizationId,
        userId: item.userId,
        type: item.type,
        title: item.title.slice(0, 255),
        body: item.body?.slice(0, 500) ?? null,
        link: item.link ?? null,
        dedupeKey: item.dedupeKey,
      })
      .orIgnore()
      .execute();
  }

  /**
   * Напоминания по активностям пользователя: просроченные и назначенные
   * на ближайшие сутки. Создаются при обращении к центру уведомлений, а
   * не отдельной задачей: пока пользователь не заходит, напоминать некому,
   * а запрос ничего не создаёт повторно благодаря ключу события.
   */
  private async syncReminders(user: AuthUser): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO notifications
         (organization_id, user_id, type, title, body, link, dedupe_key)
       SELECT a.organization_id, a.owner_user_id,
              CASE WHEN a.planned_at < now() THEN 'overdue_activity' ELSE 'due_activity' END,
              CASE WHEN a.planned_at < now() THEN 'Просрочена активность' ELSE 'Скоро активность' END,
              a.subject,
              CASE WHEN a.deal_id IS NOT NULL THEN '/deals/' || a.deal_id
                   ELSE '/clients/' || a.client_id END,
              CASE WHEN a.planned_at < now() THEN 'overdue:' ELSE 'due:' END || a.activity_id
         FROM activities a
        WHERE a.organization_id = $1
          AND a.owner_user_id = $2
          AND a.status = 'planned'
          AND a.planned_at < now() + interval '24 hours'
       ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
      [user.organizationId, user.userId],
    );
    // Напоминание «скоро» теряет смысл, когда активность выполнена или
    // отменена, — такие уведомления считаются прочитанными сами
    await this.dataSource.query(
      `UPDATE notifications n SET read_at = now()
         FROM activities a
        WHERE n.user_id = $1 AND n.read_at IS NULL
          AND n.type IN ('overdue_activity', 'due_activity')
          AND a.activity_id = split_part(n.dedupe_key, ':', 2)::int
          AND a.status <> 'planned'`,
      [user.userId],
    );
  }

  async list(user: AuthUser, onlyUnread: boolean, limit = 30) {
    await this.syncReminders(user);
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId AND n.organizationId = :org', {
        userId: user.userId,
        org: user.organizationId,
      })
      .orderBy('n.createdAt', 'DESC')
      .addOrderBy('n.notificationId', 'DESC')
      .limit(Math.min(Math.max(limit, 1), 100));
    if (onlyUnread) qb.andWhere('n.readAt IS NULL');
    return qb.getMany();
  }

  async unreadCount(user: AuthUser): Promise<{ count: number }> {
    await this.syncReminders(user);
    const count = await this.repo
      .createQueryBuilder('n')
      .where(
        'n.userId = :userId AND n.organizationId = :org AND n.readAt IS NULL',
        { userId: user.userId, org: user.organizationId },
      )
      .getCount();
    return { count };
  }

  async markRead(id: number, user: AuthUser): Promise<{ success: true }> {
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ readAt: () => 'now()' })
      .where(
        'notification_id = :id AND user_id = :userId AND organization_id = :org',
        { id, userId: user.userId, org: user.organizationId },
      )
      .execute();
    if (!result.affected) throw new NotFoundException('Уведомление не найдено');
    return { success: true };
  }

  async markAllRead(user: AuthUser): Promise<{ updated: number }> {
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ readAt: () => 'now()' })
      .where(
        'user_id = :userId AND organization_id = :org AND read_at IS NULL',
        { userId: user.userId, org: user.organizationId },
      )
      .execute();
    return { updated: result.affected ?? 0 };
  }
}
