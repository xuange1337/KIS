import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@crm/shared';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RefreshSession } from '../auth/refresh-session.entity';
import { MembershipsService } from '../organizations/memberships.service';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    @InjectRepository(RefreshSession)
    private readonly sessionRepo: Repository<RefreshSession>,
    private readonly memberships: MembershipsService,
  ) {}

  /** Сотрудники организации вместе с их ролью в ней. */
  async findAll(
    organizationId: number,
  ): Promise<{ user: User; role: UserRole }[]> {
    const members = await this.memberships.listForOrganization(organizationId);
    return members
      .map((member) => ({ user: member.user, role: member.role }))
      .sort((left, right) =>
        left.user.fullName.localeCompare(right.user.fullName),
      );
  }

  /**
   * Пользователь по идентификатору.
   *
   * `organizationId` не задаётся только там, где организация ещё не
   * известна — например, когда человек запрашивает сам себя. Во всех
   * остальных местах он обязателен, иначе администратор соседней
   * организации правил бы чужие учётные записи.
   */
  async findOne(userId: number, organizationId?: number): Promise<User> {
    const user = await this.repo.findOne({ where: { userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    if (organizationId !== undefined) {
      // Сотрудник чужой организации не существует для администратора,
      // а не «запрещён»: иначе перебором виден состав чужого отдела
      const membership = await this.memberships.find(userId, organizationId);
      if (!membership) {
        throw new NotFoundException('Пользователь не найден');
      }
    }
    return user;
  }

  /** Роль пользователя в организации. */
  async roleIn(userId: number, organizationId: number): Promise<UserRole> {
    const membership = await this.memberships.find(userId, organizationId);
    if (!membership) {
      throw new NotFoundException('Пользователь не найден');
    }
    return membership.role;
  }

  /** Есть ли такой пользователь в этой организации. */
  async existsInOrganization(
    userId: number,
    organizationId: number,
  ): Promise<boolean> {
    return Boolean(await this.memberships.find(userId, organizationId));
  }

  /**
   * Ищет пользователя вместе с хешем пароля — только для авторизации.
   * Логин уникален во всей системе: вход общий для всех организаций,
   * и по одному логину не должно находиться двух учётных записей.
   */
  findByLoginWithPassword(login: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.login = :login', { login })
      .getOne();
  }

  /** Пользователь вместе с хешем пароля — для проверки текущего пароля. */
  findByIdWithPassword(userId: number): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.user_id = :userId', { userId })
      .getOne();
  }

  /** Устанавливает новый пароль без прочих правок учётной записи. */
  async setPassword(userId: number, password: string): Promise<void> {
    await this.repo.update(
      { userId },
      { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    );
  }

  async create(dto: CreateUserDto, organizationId: number): Promise<User> {
    await this.assertLoginFree(dto.login);
    const user = await this.repo.save(
      this.repo.create({
        login: dto.login,
        fullName: dto.fullName,
        isActive: dto.isActive ?? true,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      }),
    );
    await this.memberships.add(user.userId, organizationId, dto.role);
    return user;
  }

  async update(
    userId: number,
    dto: UpdateUserDto,
    organizationId: number,
    actorUserId?: number,
  ): Promise<User> {
    const user = await this.findOne(userId, organizationId);
    const currentRole = await this.roleIn(userId, organizationId);
    const losesAdmin =
      currentRole === UserRole.ADMIN &&
      ((dto.role !== undefined && dto.role !== UserRole.ADMIN) ||
        dto.isActive === false);
    if (losesAdmin) {
      this.assertNotSelfLockout(userId, actorUserId);
      await this.assertNotLastAdmin(userId, organizationId);
    }
    if (dto.login && dto.login !== user.login) {
      await this.assertLoginFree(dto.login);
      user.login = dto.login;
    }
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.role !== undefined) {
      await this.memberships.setRole(userId, organizationId, dto.role);
    }
    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }
    const saved = await this.repo.save(user);
    if (dto.password || dto.isActive === false) {
      await this.revokeSessions(userId);
    }
    return saved;
  }

  private async revokeSessions(userId: number): Promise<void> {
    await this.sessionRepo
      .createQueryBuilder()
      .update(RefreshSession)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  /**
   * Пользователи не удаляются физически: на них ссылаются сделки,
   * активности и журнал действий. Вместо удаления — деактивация.
   */
  async deactivate(
    userId: number,
    organizationId: number,
    actorUserId?: number,
  ): Promise<User> {
    const user = await this.findOne(userId, organizationId);
    if ((await this.roleIn(userId, organizationId)) === UserRole.ADMIN) {
      this.assertNotSelfLockout(userId, actorUserId);
      await this.assertNotLastAdmin(userId, organizationId);
    }
    if (!user.isActive) {
      return user;
    }
    user.isActive = false;
    const saved = await this.repo.save(user);
    await this.revokeSessions(userId);
    return saved;
  }

  /**
   * Администратор не снимает права с самого себя.
   *
   * Иначе достаточно одного неверного клика в списке пользователей, чтобы
   * выполняющий операцию потерял доступ прямо в процессе: сессии
   * отзываются тут же, восстановления пароля в системе нет, и вернуть
   * права можно только правкой БД руками.
   */
  private assertNotSelfLockout(userId: number, actorUserId?: number): void {
    if (actorUserId !== undefined && actorUserId === userId) {
      throw new BadRequestException(
        'Нельзя снять права администратора с самого себя: ' +
          'поручите это другому администратору',
      );
    }
  }

  /**
   * В системе всегда остаётся хотя бы один действующий администратор.
   *
   * Управление пользователями закрыто ролью admin, и без такой проверки
   * блокировка последнего администратора делает организацию
   * неуправляемой: ни завести пользователя, ни вернуть роль через
   * интерфейс уже нельзя. Проверка считается внутри организации.
   */
  private async assertNotLastAdmin(
    userId: number,
    organizationId: number,
  ): Promise<void> {
    const otherAdmins = await this.memberships.countOtherAdmins(
      organizationId,
      userId,
    );
    if (otherAdmins === 0) {
      throw new ConflictException(
        'Это последний действующий администратор. ' +
          'Назначьте другого администратора, прежде чем блокировать этого',
      );
    }
  }

  private async assertLoginFree(login: string): Promise<void> {
    const exists = await this.repo.exists({ where: { login } });
    if (exists) {
      throw new ConflictException(
        'Пользователь с таким логином уже существует',
      );
    }
  }
}
