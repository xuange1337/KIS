import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@crm/shared';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RefreshSession } from '../auth/refresh-session.entity';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    @InjectRepository(RefreshSession)
    private readonly sessionRepo: Repository<RefreshSession>,
  ) {}

  findAll(organizationId: number): Promise<User[]> {
    return this.repo.find({
      where: { organizationId },
      order: { fullName: 'ASC' },
    });
  }

  /**
   * Пользователь по идентификатору.
   *
   * `organizationId` не задаётся только там, где организация ещё не
   * известна: при проверке токена сама запись пользователя и определяет
   * организацию. Во всех остальных местах он обязателен, иначе
   * администратор соседней организации правил бы чужие учётные записи.
   */
  async findOne(userId: number, organizationId?: number): Promise<User> {
    const user = await this.repo.findOne({
      where:
        organizationId === undefined ? { userId } : { userId, organizationId },
    });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return user;
  }

  /** Есть ли такой пользователь в этой организации. */
  async existsInOrganization(
    userId: number,
    organizationId: number,
  ): Promise<boolean> {
    return this.repo.exists({ where: { userId, organizationId } });
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

  async create(dto: CreateUserDto, organizationId: number): Promise<User> {
    await this.assertLoginFree(dto.login);
    const user = this.repo.create({
      organizationId,
      login: dto.login,
      fullName: dto.fullName,
      role: dto.role,
      isActive: dto.isActive ?? true,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
    });
    return this.repo.save(user);
  }

  async update(
    userId: number,
    dto: UpdateUserDto,
    organizationId: number,
    actorUserId?: number,
  ): Promise<User> {
    const user = await this.findOne(userId, organizationId);
    const losesAdmin =
      user.role === UserRole.ADMIN &&
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
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
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
    if (user.role === UserRole.ADMIN) {
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
    const otherAdmins = await this.repo.count({
      where: {
        organizationId,
        role: UserRole.ADMIN,
        isActive: true,
        userId: Not(userId),
      },
    });
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
