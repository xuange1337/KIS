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
import { deleteRecordSatellites } from '../common/helpers/record-cleanup';
import { UsersService } from '../users/users.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    private readonly notifications: NotificationsService,
    private readonly customFields: CustomFieldsService,
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
    if (query.tagId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM client_tags ct WHERE ct.client_id = client.client_id
          AND ct.tag_id = :tagId AND ct.organization_id = :tagOrg)`,
        { tagId: query.tagId, tagOrg: user.organizationId },
      );
    }
    if (query.favorite) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM favorites f WHERE f.entity_type = 'client'
          AND f.entity_id = client.clientId AND f.user_id = :favUser)`,
        { favUser: user.userId },
      );
    }
    if (query.ownerUserId) {
      qb.andWhere('client.ownerUserId = :filterOwner', {
        filterOwner: query.ownerUserId,
      });
    }

    const page = await paginate(qb, query, 'client', SORTABLE);
    await this.attachTags(page.items, user.organizationId);
    return page;
  }

  /** Метки клиентов страницы одним запросом: список показывает их в строке. */
  private async attachTags(
    clients: Client[],
    organizationId: number,
  ): Promise<void> {
    if (!clients.length) return;
    const rows: Array<{
      clientId: number;
      tagId: number;
      name: string;
      color: string;
    }> = await this.repo.query(
      `SELECT ct.client_id AS "clientId", t.tag_id AS "tagId", t.name, t.color
         FROM client_tags ct JOIN tags t ON t.tag_id = ct.tag_id
        WHERE ct.client_id = ANY($1) AND ct.organization_id = $2
        ORDER BY lower(t.name)`,
      [clients.map((c) => c.clientId), organizationId],
    );
    for (const client of clients) {
      Object.assign(client, {
        tags: rows
          .filter((row) => row.clientId === client.clientId)
          .map(({ tagId, name, color }) => ({ tagId, name, color })),
      });
    }
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
      customFields: await this.customFields.normalize(
        'client',
        user.organizationId,
        dto.customFields,
      ),
      organizationId: user.organizationId,
      // Менеджер всегда становится владельцем создаваемой карточки,
      // назначить другого ответственного может только руководитель
      ownerUserId: canSeeAll(user)
        ? (dto.ownerUserId ?? user.userId)
        : user.userId,
    });
    const saved = await this.repo.save(client);
    await this.notifyAssigned(saved, user);
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
    const { ownerUserId, version, customFields, ...rest } = dto;
    assertVersionMatches(client.version, version, 'Карточка клиента');
    Object.assign(client, rest);
    client.customFields = await this.customFields.normalize(
      'client',
      user.organizationId,
      customFields,
      client.customFields,
    );
    if (ownerUserId !== undefined && canSeeAll(user)) {
      await this.assertOwnerInTenant(ownerUserId, user);
      const changed = client.ownerUserId !== ownerUserId;
      client.ownerUserId = ownerUserId;
      await this.repo.save(client);
      if (changed) await this.notifyAssigned(client, user);
      return this.findOne(clientId, user);
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
      await deleteRecordSatellites(this.repo.manager, 'client', clientId);
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
      if (dto.ownerUserId !== undefined && dto.ownerUserId !== user.userId)
        await this.notifications.notify({
          organizationId: user.organizationId,
          userId: dto.ownerUserId,
          type: 'assigned_client',
          title: `Вам назначено клиентов: ${ids.length}`,
          link: '/clients',
          dedupeKey: `assigned-bulk:${Date.now()}:${ids[0]}`,
        });
      return { updated: ids.length };
    }

    await this.repo.update({ clientId: In(ids) }, { status: dto.status });
    return { updated: ids.length };
  }

  /** Сообщает новому ответственному, что клиент теперь за ним. */
  private async notifyAssigned(client: Client, actor: AuthUser) {
    if (!client.ownerUserId || client.ownerUserId === actor.userId) return;
    await this.notifications.notify({
      organizationId: client.organizationId,
      userId: client.ownerUserId,
      type: 'assigned_client',
      title: 'Вам назначен клиент',
      body: client.name,
      link: `/clients/${client.clientId}`,
      dedupeKey: `assigned-client:${client.clientId}:${client.version}`,
    });
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
