import { ActivityStatus, ActivityType } from '@crm/shared';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { Deal } from '../deals/deal.entity';
import { User } from '../users/user.entity';

/** Активность: звонок / встреча / письмо (Приложение А, таблица Activities). */
@Entity('activities')
@Index('idx_activities_planning', ['plannedAt', 'ownerUserId', 'status'])
export class Activity {
  @PrimaryGeneratedColumn({ name: 'activity_id' })
  activityId: number;

  /** Организация-владелец записи: граница изоляции данных. */
  @Index('idx_activities_organization')
  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'client_id', type: 'int' })
  clientId: number;

  @ManyToOne(() => Client, (client) => client.activities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  /** Активность может быть привязана к сделке, но это не обязательно. */
  @Column({ name: 'deal_id', type: 'int', nullable: true })
  dealId: number | null;

  @ManyToOne(() => Deal, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deal_id' })
  deal: Deal | null;

  @Column({ type: 'enum', enum: ActivityType })
  type: ActivityType;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ name: 'planned_at', type: 'timestamptz' })
  plannedAt: Date;

  @Column({ name: 'done_at', type: 'timestamptz', nullable: true })
  doneAt: Date | null;

  @Column({
    type: 'enum',
    enum: ActivityStatus,
    default: ActivityStatus.PLANNED,
  })
  status: ActivityStatus;

  @Column({ type: 'text', nullable: true })
  result: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'owner_user_id', type: 'int', nullable: true })
  ownerUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;
}
