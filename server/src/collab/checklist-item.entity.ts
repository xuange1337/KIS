import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Пункт чек-листа записи: подзадача, которую нужно отметить выполненной. */
@Entity('checklist_items')
@Index('idx_checklist_entity', ['entityType', 'entityId', 'position'])
export class ChecklistItem {
  @PrimaryGeneratedColumn({ name: 'item_id' })
  itemId: number;

  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @Column({ name: 'entity_type', type: 'varchar', length: 16 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'int' })
  entityId: number;

  @Column({ type: 'varchar', length: 255 })
  text: string;

  @Column({ name: 'is_done', type: 'boolean', default: false })
  isDone: boolean;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ name: 'done_at', type: 'timestamptz', nullable: true })
  doneAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
