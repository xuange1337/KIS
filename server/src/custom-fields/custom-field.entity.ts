import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Описание пользовательского поля карточки клиента или сделки. */
@Entity('custom_field_definitions')
export class CustomFieldDefinition {
  @PrimaryGeneratedColumn({ name: 'field_id' })
  fieldId: number;

  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  /** client или deal. */
  @Column({ type: 'varchar', length: 16 })
  entity: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** text, number, date, boolean, select. */
  @Column({ type: 'varchar', length: 16 })
  type: string;

  /** Допустимые значения списка; для остальных типов пусто. */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  options: string[];

  @Column({ type: 'int', default: 0 })
  position: number;
}
