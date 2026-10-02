import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  InvitationDto,
  InvitationPreview,
  OrganizationDto,
  UserRole,
} from '@crm/shared';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { Organization } from './organization.entity';
import { OrganizationMember } from './organization-member.entity';
import { OrganizationInvitation } from './organization-invitation.entity';
import { User } from '../users/user.entity';

/** Сколько живёт приглашение. */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const BCRYPT_ROUNDS = 10;

/**
 * Организация и приглашения в неё.
 *
 * До этого организация заводилась запросом в базу, а сотрудник —
 * администратором с придуманным паролем. И то и другое означало, что
 * подключение нового заказчика требует разработчика.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly repo: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepo: Repository<OrganizationMember>,
    @InjectRepository(OrganizationInvitation)
    private readonly invitationRepo: Repository<OrganizationInvitation>,
    private readonly dataSource: DataSource,
  ) {}

  async findOne(organizationId: number): Promise<OrganizationDto> {
    const organization = await this.repo.findOne({ where: { organizationId } });
    if (!organization) {
      throw new NotFoundException('Организация не найдена');
    }
    const memberCount = await this.memberRepo.count({
      where: { organizationId },
    });
    return {
      organizationId: organization.organizationId,
      name: organization.name,
      isActive: organization.isActive,
      createdAt: organization.createdAt.toISOString(),
      memberCount,
    };
  }

  async rename(organizationId: number, name: string): Promise<OrganizationDto> {
    const taken = await this.repo
      .createQueryBuilder('organization')
      .where('LOWER(organization.name) = LOWER(:name)', { name })
      .andWhere('organization.organization_id <> :organizationId', {
        organizationId,
      })
      .getExists();
    if (taken) {
      throw new ConflictException('Организация с таким названием уже есть');
    }
    await this.repo.update({ organizationId }, { name });
    return this.findOne(organizationId);
  }

  /** Приглашения организации, новые первыми. */
  async listInvitations(organizationId: number): Promise<InvitationDto[]> {
    const invitations = await this.invitationRepo.find({
      where: { organizationId },
      order: { invitationId: 'DESC' },
      take: 20,
    });
    return invitations.map((invitation) => ({
      invitationId: invitation.invitationId,
      role: invitation.role,
      fullName: invitation.fullName,
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      usedAt: invitation.usedAt ? invitation.usedAt.toISOString() : null,
    }));
  }

  /**
   * Выдача приглашения.
   *
   * Токен возвращается один раз и больше нигде не хранится в открытом
   * виде: в базе лежит отпечаток.
   */
  async invite(
    organizationId: number,
    role: UserRole,
    fullName: string | null,
    invitedBy: number,
  ): Promise<{ token: string; expiresAt: string }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    await this.invitationRepo.save({
      organizationId,
      role,
      fullName,
      tokenHash: this.hash(token),
      expiresAt,
      usedAt: null,
      invitedBy,
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }

  /** Отзыв невостребованного приглашения. */
  async revokeInvitation(
    organizationId: number,
    invitationId: number,
  ): Promise<void> {
    const result = await this.invitationRepo.update(
      { invitationId, organizationId, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    if (!result.affected) {
      throw new NotFoundException(
        'Приглашение не найдено или уже использовано',
      );
    }
  }

  /** Что показать приглашённому до того, как он принял приглашение. */
  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await this.findUsable(token);
    const organization = await this.repo.findOneOrFail({
      where: { organizationId: invitation.organizationId },
    });
    return {
      organizationName: organization.name,
      role: invitation.role,
      fullName: invitation.fullName,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /**
   * Принятие приглашения новым человеком: заводится учётная запись.
   *
   * Приглашение гасится в той же транзакции, что и создание участия:
   * иначе два одновременных перехода по одной ссылке завели бы двух
   * сотрудников вместо одного.
   */
  async acceptAsNewUser(
    token: string,
    login: string,
    password: string,
    fullName: string,
  ): Promise<{ organizationId: number }> {
    const exists = await this.dataSource
      .getRepository(User)
      .exists({ where: { login } });
    if (exists) {
      throw new ConflictException(
        'Такой логин уже занят. Войдите под ним и примите приглашение повторно',
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.claim(manager, token);
      const user = await manager.getRepository(User).save(
        manager.getRepository(User).create({
          login,
          fullName,
          isActive: true,
          passwordHash,
        }),
      );
      await manager.getRepository(OrganizationMember).save({
        organizationId: invitation.organizationId,
        userId: user.userId,
        role: invitation.role,
      });
      return { organizationId: invitation.organizationId };
    });
  }

  /** Принятие приглашения уже работающим в системе человеком. */
  async acceptAsExistingUser(
    token: string,
    userId: number,
  ): Promise<{ organizationId: number }> {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.claim(manager, token);
      const members = manager.getRepository(OrganizationMember);
      const already = await members.findOne({
        where: { organizationId: invitation.organizationId, userId },
      });
      if (already) {
        throw new ConflictException('Вы уже работаете в этой организации');
      }
      await members.save({
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      });
      return { organizationId: invitation.organizationId };
    });
  }

  /** Находит пригодное приглашение; иначе — отказ с общим сообщением. */
  private async findUsable(token: string): Promise<OrganizationInvitation> {
    const invitation = await this.invitationRepo.findOne({
      where: { tokenHash: this.hash(token) },
    });
    if (
      !invitation ||
      invitation.usedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new BadRequestException(
        'Приглашение недействительно или уже использовано',
      );
    }
    return invitation;
  }

  /** Гасит приглашение внутри транзакции и возвращает его. */
  private async claim(
    manager: EntityManager,
    token: string,
  ): Promise<OrganizationInvitation> {
    const repo = manager.getRepository(OrganizationInvitation);
    const invitation = await repo.findOne({
      where: { tokenHash: this.hash(token) },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      !invitation ||
      invitation.usedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new BadRequestException(
        'Приглашение недействительно или уже использовано',
      );
    }
    invitation.usedAt = new Date();
    await repo.save(invitation);
    return invitation;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
