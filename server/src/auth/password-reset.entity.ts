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
 * Одноразовая ссылка для установки нового пароля.
 *
 * Восстановления пароля в системе не было вовсе: забывший пароль
 * сотрудник ждал, пока администратор придумает и продиктует ему новый —
 * то есть пароль оказывался известен двоим, а иногда и переписке в
 * мессенджере.
 *
 * Почтовой рассылки в развёртывании может не быть, поэтому ссылку
 * выдаёт администратор и передаёт лично; сам он нового пароля не знает.
 */
@Entity('password_resets')
export class PasswordReset {
  @PrimaryGeneratedColumn({ name: 'password_reset_id' })
  passwordResetId: number;

  @Index('idx_password_resets_user')
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * SHA-256 от токена: в базе хранится отпечаток, а не сам токен.
   * Утечка таблицы не должна давать возможности войти.
   */
  @Index('idx_password_resets_token', { unique: true })
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /** Момент использования: ссылка одноразовая. */
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  /** Кто выдал ссылку — для журнала разбора инцидентов. */
  @Column({ name: 'issued_by', type: 'int', nullable: true })
  issuedBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
