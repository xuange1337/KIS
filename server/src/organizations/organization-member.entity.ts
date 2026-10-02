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
 * Участие пользователя в организации.
 *
 * Роль переехала сюда из учётной записи. Пока роль лежала в `users`,
 * человек мог состоять ровно в одной организации — а это обычная
 * ситуация для партнёра или внешнего консультанта, который ведёт
 * несколько заказчиков, и обязательная для самостоятельного
 * подключения: заводящий организацию становится в ней администратором,
 * оставаясь рядовым сотрудником в своей.
 */
@Entity('organization_members')
@Index('idx_members_organization_user', ['organizationId', 'userId'], {
  unique: true,
})
export class OrganizationMember {
  @PrimaryGeneratedColumn({ name: 'membership_id' })
  membershipId: number;

  @Index('idx_members_organization')
  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Index('idx_members_user')
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Роль действует в пределах этой организации, а не везде. */
  @Column({ type: 'enum', enum: UserRole, default: UserRole.MANAGER })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
