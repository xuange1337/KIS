import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Запись, отмеченная пользователем звёздочкой. */
@Entity('favorites')
@Index('uq_favorites_user_entity', ['userId', 'entityType', 'entityId'], {
  unique: true,
})
export class Favorite {
  @PrimaryGeneratedColumn({ name: 'favorite_id' })
  favoriteId: number;

  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  /** client или deal. */
  @Column({ name: 'entity_type', type: 'varchar', length: 16 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'int' })
  entityId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
