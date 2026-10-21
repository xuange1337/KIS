import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Одноразовая ссылка подтверждения адреса.
 *
 * Адрес хранится в самой записи: пока ссылка не использована, человек
 * мог успеть сменить адрес в профиле, и старая ссылка не должна
 * подтверждать новый.
 */
@Entity('email_verifications')
export class EmailVerification {
  @PrimaryGeneratedColumn({ name: 'verification_id' })
  verificationId: number;

  @Index('idx_email_verifications_user')
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  /** SHA-256 от токена: утечка таблицы не должна подтверждать адреса. */
  @Index('idx_email_verifications_token', { unique: true })
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
