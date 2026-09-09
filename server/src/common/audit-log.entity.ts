import { AuditAction } from '@crm/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Журнал действий пользователей (ТЗ п. 1.1 — журналирование действий). */
@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_audit_user')
  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  /** Имя сущности: clients, deals, activities и т.д. */
  @Column({ type: 'varchar', length: 64 })
  entity: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 64, nullable: true })
  entityId: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Index('idx_audit_created')
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
