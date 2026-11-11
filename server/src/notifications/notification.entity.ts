import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Уведомление в центре уведомлений пользователя. */
@Entity('notifications')
@Index('uq_notifications_user_key', ['userId', 'dedupeKey'], { unique: true })
export class Notification {
  @PrimaryGeneratedColumn({ name: 'notification_id' })
  notificationId: number;

  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  /** overdue_activity, due_activity, assigned_client, assigned_deal, comment. */
  @Column({ type: 'varchar', length: 32 })
  type: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  body: string | null;

  /** Внутренний адрес, куда ведёт уведомление. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  link: string | null;

  /** Защита от повторов: одно и то же событие создаёт одно уведомление. */
  @Column({ name: 'dedupe_key', type: 'varchar', length: 120 })
  dedupeKey: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
