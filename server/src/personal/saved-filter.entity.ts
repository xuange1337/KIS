import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Личный набор фильтров списка: «мои горячие лиды», «крупные сделки». */
@Entity('saved_filters')
@Index('uq_saved_filters_user_entity_name', ['userId', 'entity', 'name'], {
  unique: true,
})
export class SavedFilter {
  @PrimaryGeneratedColumn({ name: 'saved_filter_id' })
  savedFilterId: number;

  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  /** Список, к которому относится набор: clients или deals. */
  @Column({ type: 'varchar', length: 16 })
  entity: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'jsonb' })
  filters: Record<string, string | number | boolean>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
