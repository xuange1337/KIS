import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrganizationSummary, UserRole } from '@crm/shared';
import { Repository } from 'typeorm';
import { OrganizationMember } from './organization-member.entity';

/**
 * Участие пользователей в организациях.
 *
 * Единственное место, где роль связывается с организацией: раньше она
 * лежала в учётной записи, и «роль» означала «роль везде».
 */
@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(OrganizationMember)
    private readonly repo: Repository<OrganizationMember>,
  ) {}

  /** Участие в конкретной организации; null, если его нет. */
  find(
    userId: number,
    organizationId: number,
  ): Promise<OrganizationMember | null> {
    return this.repo.findOne({ where: { userId, organizationId } });
  }

  /**
   * Организации пользователя в порядке подключения.
   *
   * Первая считается основной: при входе сеанс открывается в ней,
   * пока пользователь не переключится.
   */
  async listForUser(userId: number): Promise<OrganizationSummary[]> {
    const memberships = await this.repo.find({
      where: { userId },
      relations: { organization: true },
      order: { membershipId: 'ASC' },
    });
    return memberships
      .filter((membership) => membership.organization?.isActive)
      .map((membership) => ({
        organizationId: membership.organizationId,
        name: membership.organization.name,
        role: membership.role,
      }));
  }

  /** Участники организации. */
  listForOrganization(organizationId: number): Promise<OrganizationMember[]> {
    return this.repo.find({
      where: { organizationId },
      relations: { user: true },
      order: { membershipId: 'ASC' },
    });
  }

  async add(
    userId: number,
    organizationId: number,
    role: UserRole,
  ): Promise<OrganizationMember> {
    return this.repo.save(this.repo.create({ userId, organizationId, role }));
  }

  async setRole(
    userId: number,
    organizationId: number,
    role: UserRole,
  ): Promise<void> {
    await this.repo.update({ userId, organizationId }, { role });
  }

  async remove(userId: number, organizationId: number): Promise<void> {
    await this.repo.delete({ userId, organizationId });
  }

  /** Сколько в организации действующих администраторов, кроме указанного. */
  countOtherAdmins(
    organizationId: number,
    exceptUserId: number,
  ): Promise<number> {
    return this.repo
      .createQueryBuilder('member')
      .innerJoin('member.user', 'user')
      .where('member.organization_id = :organizationId', { organizationId })
      .andWhere('member.role = :role', { role: UserRole.ADMIN })
      .andWhere('member.user_id <> :exceptUserId', { exceptUserId })
      .andWhere('user.is_active = true')
      .getCount();
  }

  /** Участие, без которого работать нельзя: отсутствует — доступа нет. */
  async require(
    userId: number,
    organizationId: number,
  ): Promise<OrganizationMember> {
    const membership = await this.find(userId, organizationId);
    if (!membership) {
      throw new ForbiddenException('Нет доступа к этой организации');
    }
    return membership;
  }
}
