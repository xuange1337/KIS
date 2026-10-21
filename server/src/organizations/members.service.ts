import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MemberDto, UserRole } from '@crm/shared';
import * as bcrypt from 'bcryptjs';
import { DataSource, IsNull, Repository } from 'typeorm';
import { RefreshSession } from '../auth/refresh-session.entity';
import { User } from '../users/user.entity';
import { Organization } from './organization.entity';
import { OrganizationMember } from './organization-member.entity';

/**
 * Состав организации: роли, исключение, выход, передача владения.
 *
 * Инварианты, которые держит этот сервис:
 *  - у организации всегда есть владелец, и он администратор;
 *  - владельца нельзя ни понизить, ни исключить, ни он не может выйти —
 *    сначала владение передаётся;
 *  - исключённому немедленно закрываются сеансы в этой организации.
 */
@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(OrganizationMember)
    private readonly members: Repository<OrganizationMember>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(RefreshSession)
    private readonly sessions: Repository<RefreshSession>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async list(organizationId: number): Promise<MemberDto[]> {
    const organization = await this.organizations.findOne({
      where: { organizationId },
    });
    const rows = await this.members.find({
      where: { organizationId },
      relations: { user: true },
      order: { membershipId: 'ASC' },
    });
    return rows.map((member) => ({
      userId: member.userId,
      login: member.user.login,
      fullName: member.user.fullName,
      email: member.user.email,
      role: member.role,
      isOwner: organization?.ownerUserId === member.userId,
      isActive: member.user.isActive,
      joinedAt: member.createdAt.toISOString(),
    }));
  }

  private async ownerOf(organizationId: number): Promise<number | null> {
    const organization = await this.organizations.findOne({
      where: { organizationId },
      select: { organizationId: true, ownerUserId: true },
    });
    return organization?.ownerUserId ?? null;
  }

  private async requireMember(
    organizationId: number,
    userId: number,
  ): Promise<OrganizationMember> {
    // Чужой сотрудник не существует для администратора, а не «запрещён»
    const member = await this.members.findOne({
      where: { organizationId, userId },
    });
    if (!member) {
      throw new NotFoundException('Участник не найден');
    }
    return member;
  }

  private revokeSessions(organizationId: number, userId: number) {
    return this.sessions.update(
      { userId, organizationId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async setRole(
    organizationId: number,
    userId: number,
    role: UserRole,
    actorUserId: number,
  ): Promise<void> {
    const member = await this.requireMember(organizationId, userId);
    if (member.role === role) {
      return;
    }
    if (role !== UserRole.ADMIN) {
      if ((await this.ownerOf(organizationId)) === userId) {
        throw new ConflictException(
          'Владелец остаётся администратором. Передайте владение другому участнику',
        );
      }
      if (userId === actorUserId) {
        throw new BadRequestException(
          'Нельзя снять права администратора с самого себя: поручите это другому администратору',
        );
      }
    }
    await this.members.update({ organizationId, userId }, { role });
  }

  async remove(
    organizationId: number,
    userId: number,
    actorUserId: number,
  ): Promise<void> {
    if (userId === actorUserId) {
      throw new BadRequestException(
        'Чтобы покинуть организацию, воспользуйтесь выходом',
      );
    }
    await this.requireMember(organizationId, userId);
    await this.detach(organizationId, userId);
  }

  async leave(organizationId: number, userId: number): Promise<void> {
    await this.requireMember(organizationId, userId);
    await this.detach(organizationId, userId);
  }

  private async detach(organizationId: number, userId: number): Promise<void> {
    if ((await this.ownerOf(organizationId)) === userId) {
      throw new ConflictException(
        'Владелец не может покинуть организацию. Передайте владение другому администратору или закройте организацию',
      );
    }
    await this.members.delete({ organizationId, userId });
    await this.revokeSessions(organizationId, userId);
  }

  /**
   * Передача владения.
   *
   * Подтверждается паролем владельца: передача необратима без согласия
   * нового владельца, и оставленный без присмотра сеанс не должен
   * позволять её совершить. Новый владелец становится администратором.
   */
  async transferOwnership(
    organizationId: number,
    ownerUserId: number,
    targetUserId: number,
    password: string,
  ): Promise<void> {
    if ((await this.ownerOf(organizationId)) !== ownerUserId) {
      throw new ForbiddenException('Передать владение может только владелец');
    }
    await this.assertPassword(ownerUserId, password);
    if (targetUserId === ownerUserId) {
      throw new BadRequestException('Вы уже владелец');
    }
    const target = await this.requireMember(organizationId, targetUserId);
    const user = await this.users.findOne({ where: { userId: targetUserId } });
    if (!user?.isActive) {
      throw new ConflictException('Нельзя передать владение заблокированному');
    }
    await this.dataSource.transaction(async (manager) => {
      if (target.role !== UserRole.ADMIN) {
        await manager
          .getRepository(OrganizationMember)
          .update(
            { organizationId, userId: targetUserId },
            { role: UserRole.ADMIN },
          );
      }
      await manager
        .getRepository(Organization)
        .update({ organizationId }, { ownerUserId: targetUserId });
    });
  }

  /** Проверка пароля действующего пользователя для опасных действий. */
  async assertPassword(userId: number, password: string): Promise<void> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.user_id = :userId', { userId })
      .getOne();
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ForbiddenException('Неверный пароль');
    }
  }
}
