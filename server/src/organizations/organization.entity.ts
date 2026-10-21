import { OrganizationStatus } from '@crm/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Организация — граница изоляции данных.
 *
 * До её появления все клиенты, сделки и активности принадлежали одной
 * безымянной базе: продать систему второму заказчику можно было только
 * отдельным развёртыванием. Каждая бизнес-запись теперь принадлежит
 * организации, и запрос за её пределы не возвращает ничего.
 */
@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn({ name: 'organization_id' })
  organizationId: number;

  @Index('idx_organizations_name')
  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Организация выключается целиком, без удаления данных. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Состояние как клиента сервиса; см. OrganizationStatus. */
  @Column({
    type: 'varchar',
    length: 16,
    default: OrganizationStatus.ACTIVE,
  })
  status: OrganizationStatus;

  /** Конец пробного периода; задан только у организаций на пробном. */
  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  /**
   * За сколько дней до конца пробного периода отправлено последнее
   * напоминание. Нужен, чтобы ежечасное задание не слало одно и то же.
   */
  @Column({ name: 'trial_notified_days', type: 'smallint', nullable: true })
  trialNotifiedDays: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
