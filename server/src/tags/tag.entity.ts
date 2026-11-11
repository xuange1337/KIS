import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Цветная метка для клиентов: «VIP», «Тендер», «Партнёр». */
@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn({ name: 'tag_id' })
  tagId: number;

  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @Column({ type: 'varchar', length: 40 })
  name: string;

  /** Цвет в формате #RRGGBB. */
  @Column({ type: 'varchar', length: 7, default: '#6B7280' })
  color: string;
}
