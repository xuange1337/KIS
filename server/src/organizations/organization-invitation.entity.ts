import { UserRole } from '@crm/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from '../users/user.entity';

/**
 * Приглашение в организацию по одноразовой ссылке.
 *
 * До него единственным способом завести сотрудника было придумать ему
 * логин и пароль и продиктовать их — пароль знали двое, а в переписке
 * он оставался навсегда. По приглашению человек заводит себя сам:
 * администратор задаёт только роль.
 */
@Entity('organization_invitations')
export class OrganizationInvitation {
  @PrimaryGeneratedColumn({ name: 'invitation_id' })
  invitationId: number;

  @Index('idx_invitations_organization')
  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /** Роль, с которой приглашённый войдёт в организацию. */
  @Column({ type: 'enum', enum: UserRole, default: UserRole.MANAGER })
  role: UserRole;

  /**
   * SHA-256 от токена: в базе отпечаток, а не сам токен.
   * Утечка таблицы не должна давать возможности вступить в организацию.
   */
  @Index('idx_invitations_token', { unique: true })
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  /** Для кого приглашение — подсказка администратору, не проверка. */
  @Column({ name: 'full_name', type: 'varchar', length: 160, nullable: true })
  fullName: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ name: 'invited_by', type: 'int', nullable: true })
  invitedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invited_by' })
  inviter: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
