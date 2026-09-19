import { AuditAction } from '@crm/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';

/** Журнал действий пользователей (ТЗ п. 1.1 — журналирование действий). */
@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Организация-владелец записи.
   *
   * Допускает NULL: неудачный вход записывается до того, как известна
   * учётная запись, и такую запись нельзя отнести ни к какой организации,
   * но терять её нельзя — именно по ней видно подбор пароля.
   */
  @Index('idx_audit_log_organization')
  @Column({ name: 'organization_id', type: 'int', nullable: true })
  organizationId: number | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

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
