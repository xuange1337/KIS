import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated } from '@crm/shared';
import { In, Repository } from 'typeorm';
import { Client } from './client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { BulkClientAction, BulkClientsDto } from './dto/bulk-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  applyOwnerScope,
  canAccess,
  canSeeAll,
} from '../common/helpers/owner-scope';
import { applyTenantScope } from '../common/helpers/tenant-scope';
import { UsersService } from '../users/users.service';
import { paginate } from '../common/helpers/paginate';
import { assertVersionMatches } from '../common/helpers/optimistic-lock';

/** Поля, по которым разрешена сортировка списка (первое — по умолчанию). */
const SORTABLE = ['createdAt', 'name', 'status', 'industry'];

/** Код ошибки PostgreSQL при нарушении внешнего ключа. */
const FOREIGN_KEY_VIOLATION = '23503';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly repo: Repository<Client>,
    private readonly usersService: UsersService,
  ) {}

  /** Список клиентов с поиском, фильтрами и разграничением по ролям. */
  async findAll(
    query: QueryClientsDto,
    user: AuthUser,
  ): Promise<Paginated<Client>> {
    const qb = this.repo
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.owner', 'owner');

    applyTenantScope(qb, user, 'client');
    applyOwnerScope(qb, user, 'client');

    if (query.q) {
      // Поиск по наименованию и ИНН — основной сценарий менеджера
      qb.andWhere('(client.name ILIKE :q OR client.inn ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }
    if (query.status) {
      qb.andWhere('client.status = :status', { status: query.status });
    }
    if (query.source) {
      qb.andWhere('client.source = :source', { source: query.source });
    }
    if (query.industry) {
      qb.andWhere('client.industry = :industry', { industry: query.industry });
    }
    if (query.ownerUserId) {
      qb.andWhere('client.ownerUserId = :filterOwner', {
        filterOwner: query.ownerUserId,
      });
    }

    return paginate(qb, query, 'client', SORTABLE);
  }

  /** Карточка клиента со связанными контактами (ТЗ п. 2.5). */
  async findOne(clientId: number, user: AuthUser): Promise<Client> {
    const client = await this.repo.findOne({
      // Организация в условии выборки, а не проверкой после неё: запись
      // соседней организации не должна отличаться от несуществующей,
      // иначе перебором идентификаторов виден её состав
      where: { clientId, organizationId: user.organizationId },
      relations: { owner: true, contacts: true },
    });
    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }
    if (!canAccess(user, client.ownerUserId)) {
      throw new ForbiddenException('Клиент закреплён за другим менеджером');
    }
    return client;
  }

  async create(dto: CreateClientDto, user: AuthUser): Promise<Client> {
    // Проверяется только то значение, которое будет применено: у менеджера
    // поле игнорируется, и ошибка на него сбивала бы с толку
    if (canSeeAll(user)) {
      await this.assertOwnerInTenant(dto.ownerUserId, user);
    }
    const client = this.repo.create({
      ...dto,
      organizationId: user.organizationId,
      // Менеджер всегда становится владельцем создаваемой карточки,
      // назначить другого ответственного может только руководитель
      ownerUserId: canSeeAll(user)
        ? (dto.ownerUserId ?? user.userId)
        : user.userId,
    });
    const saved = await this.repo.save(client);
    return this.repo.findOneOrFail({
      where: { clientId: saved.clientId },
      relations: { owner: true },
    });
  }

  async update(
    clientId: number,
    dto: UpdateClientDto,
    user: AuthUser,
  ): Promise<Client> {
    const client = await this.findOne(clientId, user);
    const { ownerUserId, version, ...rest } = dto;
    assertVersionMatches(client.version, version, 'Карточка клиента');
    Object.assign(client, rest);
    if (ownerUserId !== undefined && canSeeAll(user)) {
      await this.assertOwnerInTenant(ownerUserId, user);
      client.ownerUserId = ownerUserId;
    }
    await this.repo.save(client);
    return this.findOne(clientId, user);
  }

  /**
   * Удаление карточки клиента.
   *
   * Контакты и активности связаны каскадом, поэтому удаление клиента
   * молча уносило всю историю коммуникаций. Теперь операция сначала
   * сообщает, что именно будет потеряно, и выполняется только при явном
   * подтверждении (force).
   */
  async remove(
    clientId: number,
    user: AuthUser,
    force = false,
  ): Promise<{ success: true }> {
    const client = await this.findOne(clientId, user);

    const dependents = await this.countDependents(clientId);
    if (dependents.deals > 0) {
      // Сделки связаны с ON DELETE RESTRICT: удалить клиента нельзя
      // в принципе, подтверждение здесь не поможет
      throw new ConflictException(
        `По клиенту есть сделки (${dependents.deals}). ` +
          `Удалите их или переведите клиента в архив`,
      );
    }
    if (!force && (dependents.contacts > 0 || dependents.activities > 0)) {
      throw new ConflictException({
        message:
          'Вместе с клиентом будут удалены связанные записи. ' +
          'Повторите удаление с подтверждением или переведите клиента в архив',
        dependents,
      });
    }

    try {
      await this.repo.remove(client);
    } catch (error) {
      // Страховка на случай гонки: сделку могли завести между проверкой
      // и удалением
      if (
        (error as { code?: string }).code === FOREIGN_KEY_VIOLATION ||
        (error as { driverError?: { code?: string } }).driverError?.code ===
          FOREIGN_KEY_VIOLATION
      ) {
        throw new ConflictException(
          'По клиенту есть сделки. Удалите их или переведите клиента в архив',
        );
      }
      throw error;
    }
    return { success: true };
  }

  /**
   * Массовая правка выбранных карточек.
   *
   * Передача десятка клиентов новому сотруднику по одной карточке —
   * десять открытий формы и десять сохранений; при передаче дел
   * уходящего менеджера счёт идёт на сотни.
   *
   * Операция сначала проверяет доступ ко всем выбранным записям и
   * только потом меняет их: частичный результат здесь хуже отказа —
   * пользователь видит «изменено 7 из 12» и не знает, какие пять и
   * почему остались прежними.
   */
  async bulkUpdate(
    dto: BulkClientsDto,
    user: AuthUser,
  ): Promise<{ updated: number }> {
    const ids = [...new Set(dto.clientIds)];

    const qb = this.repo
      .createQueryBuilder('client')
      .where('client.clientId IN (:...ids)', { ids });
    applyTenantScope(qb, user, 'client');
    applyOwnerScope(qb, user, 'client');
    const accessible = await qb.getMany();

    if (accessible.length !== ids.length) {
      const visible = new Set(accessible.map((client) => client.clientId));
      const missing = ids.filter((id) => !visible.has(id));
      throw new ForbiddenException({
        message:
          'Часть выбранных карточек недоступна: операция не выполнена ни над одной',
        clientIds: missing,
      });
    }

    if (dto.action === BulkClientAction.ASSIGN_OWNER) {
      if (!canSeeAll(user)) {
        throw new ForbiddenException(
          'Назначать ответственного может руководитель или администратор',
        );
      }
      await this.assertOwnerInTenant(dto.ownerUserId, user);
      await this.repo.update(
        { clientId: In(ids) },
        { ownerUserId: dto.ownerUserId },
      );
      return { updated: ids.length };
    }

    await this.repo.update({ clientId: In(ids) }, { status: dto.status });
    return { updated: ids.length };
  }

  /**
   * Ответственный должен работать в той же организации.
   *
   * Внешний ключ проверяет только существование пользователя, поэтому без
   * этой проверки руководитель мог назначить ответственным сотрудника
   * соседней организации: запись пропадала из его списков и становилась
   * видна тому, кто к ней отношения не имеет.
   */
  private async assertOwnerInTenant(
    ownerUserId: number | null | undefined,
    user: AuthUser,
  ): Promise<void> {
    if (ownerUserId === null || ownerUserId === undefined) return;
    const exists = await this.usersService.existsInOrganization(
      ownerUserId,
      user.organizationId,
    );
    if (!exists) {
      throw new BadRequestException(
        'Ответственный не найден в вашей организации',
      );
    }
  }

  /** Сколько записей будет затронуто удалением клиента. */
  private async countDependents(
    clientId: number,
  ): Promise<{ contacts: number; deals: number; activities: number }> {
    const [contacts, deals, activities] = await Promise.all([
      this.repo.manager.count('contacts', { where: { clientId } } as never),
      this.repo.manager.count('deals', { where: { clientId } } as never),
      this.repo.manager.count('activities', { where: { clientId } } as never),
    ]);
    return { contacts, deals, activities };
  }
}
