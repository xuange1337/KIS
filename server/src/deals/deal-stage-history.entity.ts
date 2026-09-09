import { DealStage } from '@crm/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Deal } from './deal.entity';
import { User } from '../users/user.entity';

/**
 * История смены стадий сделки.
 * Закрывает требование «история изменений» (ТЗ п. 1.2.3, п. 2.3).
 */
@Entity('deal_stage_history')
export class DealStageHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_stage_history_deal')
  @Column({ name: 'deal_id', type: 'int' })
  dealId: number;

  @ManyToOne(() => Deal, (deal) => deal.stageHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deal_id' })
  deal: Deal;

  /** null — запись о создании сделки. */
  @Column({ name: 'from_stage', type: 'enum', enum: DealStage, nullable: true })
  fromStage: DealStage | null;

  @Column({ name: 'to_stage', type: 'enum', enum: DealStage })
  toStage: DealStage;

  @Column({ name: 'changed_by', type: 'int', nullable: true })
  changedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changed_by' })
  changedByUser: User | null;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz' })
  changedAt: Date;
}
