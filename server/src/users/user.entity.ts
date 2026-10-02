import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Учётная запись (Приложение А, таблица Users).
 *
 * Организация и роль хранятся не здесь, а в `organization_members`:
 * один человек может работать в нескольких организациях с разными
 * правами. Здесь остаётся то, что относится к самому человеку: как он
 * входит, как его зовут и не заблокирован ли он целиком.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  userId: number;

  @Index('idx_users_login', { unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  login: string;

  /** Хеш пароля (bcrypt). Наружу никогда не отдаётся. */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash: string;

  @Column({ name: 'full_name', type: 'varchar', length: 160 })
  fullName: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
