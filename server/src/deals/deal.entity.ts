import { Currency, DealStage } from '@crm/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  VersionColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { DealStageHistory } from './deal-stage-history.entity';
import { numericTransformer } from '../common/helpers/numeric.transformer';

/** Сделка (Приложение А, таблица Deals). */
@Entity('deals')
@Index('idx_deals_stage_owner', ['stage', 'ownerUserId'])
export class Deal {
  @PrimaryGeneratedColumn({ name: 'deal_id' })
  dealId: number;

  /** Организация-владелец записи: граница изоляции данных. */
  @Index('idx_deals_organization')
  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'client_id', type: 'int' })
  clientId: number;

  @ManyToOne(() => Client, (client) => client.deals, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'enum', enum: DealStage, default: DealStage.NEW })
  stage: DealStage;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.RUB })
  currency: Currency;

  /** Вероятность закрытия, %. */
  @Column({ type: 'smallint', default: 0 })
  probability: number;

  @Column({ name: 'planned_close', type: 'date', nullable: true })
  plannedClose: string | null;

  @Column({ name: 'owner_user_id', type: 'int', nullable: true })
  ownerUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  /** Заполняется при переходе на терминальную стадию (выиграна/проиграна). */
  @Index('idx_deals_closed_at')
  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  /**
   * Версия записи: увеличивается при каждом сохранении.
   * Нужна, чтобы одновременная правка двумя людьми не затиралась молча.
   */
  @VersionColumn({ type: 'int', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => DealStageHistory, (history) => history.deal)
  stageHistory: DealStageHistory[];
}
