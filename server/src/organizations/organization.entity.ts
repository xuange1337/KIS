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

  @Index('idx_organizations_name', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Организация выключается целиком, без удаления данных. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
