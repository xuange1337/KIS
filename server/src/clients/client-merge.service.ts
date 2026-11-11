import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DuplicateGroupDto, MergeClientsResult } from '@crm/shared';
import { DataSource, EntityManager, In } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { canAccess, canSeeAll } from '../common/helpers/owner-scope';
import { Client } from './client.entity';
import { Contact } from '../contacts/contact.entity';
import { Deal } from '../deals/deal.entity';
import { Activity } from '../activities/activity.entity';
import {
  findDuplicateGroups,
  normalizeEmail,
  normalizePhone,
} from './duplicates';

/** Поля карточки, которые при слиянии берутся у дубля, если у основной пусты. */
const FILLABLE = ['inn', 'industry', 'source', 'address'] as const;

@Injectable()
export class ClientMergeService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Группы возможных дублей среди клиентов, видимых пользователю. */
  async findDuplicates(user: AuthUser): Promise<DuplicateGroupDto[]> {
    const qb = this.dataSource
      .getRepository(Client)
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.owner', 'owner')
      .leftJoinAndSelect('client.contacts', 'contact')
      .where('client.organizationId = :org', { org: user.organizationId })
      .orderBy('client.clientId', 'ASC');
    if (!canSeeAll(user))
      qb.andWhere('client.ownerUserId = :me', { me: user.userId });
    const clients = await qb.getMany();

    const dealCounts = await this.countBy(
      Deal,
      'dealId',
      clients.map((c) => c.clientId),
    );
    const byId = new Map(clients.map((c) => [c.clientId, c]));
    const raw = findDuplicateGroups(
      clients.map((client) => ({
        clientId: client.clientId,
        name: client.name,
        inn: client.inn,
        emails: client.contacts
          .map((c) => (c.email ? normalizeEmail(c.email) : null))
          .filter((v): v is string => v !== null),
        phones: client.contacts
          .map((c) => (c.phone ? normalizePhone(c.phone) : null))
          .filter((v): v is string => v !== null),
      })),
    );
    return raw.map((group) => ({
      key: group.clientIds[0],
      reasons: group.reasons,
      clients: group.clientIds.map((id) => {
        const client = byId.get(id) as Client;
        return {
          clientId: id,
          name: client.name,
          inn: client.inn,
          status: client.status,
          ownerName: client.owner?.fullName ?? null,
          contactsCount: client.contacts.length,
          dealsCount: dealCounts.get(id) ?? 0,
          createdAt: client.createdAt.toISOString(),
        };
      }),
    }));
  }

  private async countBy(
    entity: typeof Deal,
    column: string,
    clientIds: number[],
  ): Promise<Map<number, number>> {
    if (!clientIds.length) return new Map();
    const rows = await this.dataSource
      .getRepository(entity)
      .createQueryBuilder('e')
      .select('e.clientId', 'clientId')
      .addSelect(`COUNT(e.${column})`, 'count')
      .where('e.clientId IN (:...ids)', { ids: clientIds })
      .groupBy('e.clientId')
      .getRawMany<{ clientId: number; count: string }>();
    return new Map(rows.map((r) => [Number(r.clientId), Number(r.count)]));
  }

  /**
   * Объединяет клиентов: контакты, сделки и активности переносятся на
   * основную карточку, пустые поля основной заполняются данными дублей,
   * сами дубли удаляются. Всё в одной транзакции: либо слияние целиком,
   * либо ничего.
   */
  async merge(
    targetId: number,
    sourceIds: number[],
    user: AuthUser,
  ): Promise<MergeClientsResult> {
    const sources = [...new Set(sourceIds)].filter((id) => id !== targetId);
    if (!sources.length)
      throw new BadRequestException('Не выбраны карточки для объединения');
    return this.dataSource.transaction(async (manager) => {
      const all = await this.lockClients(manager, [targetId, ...sources], user);
      const target = all.find((c) => c.clientId === targetId) as Client;
      const duplicates = all.filter((c) => c.clientId !== targetId);

      const patch: Partial<Client> = {};
      for (const field of FILLABLE) {
        if (target[field]) continue;
        const donor = duplicates.find((d) => d[field]);
        if (donor) Object.assign(patch, { [field]: donor[field] });
      }
      if (Object.keys(patch).length)
        await manager.update(Client, { clientId: targetId }, patch);

      const movedContacts = await this.move(
        manager,
        Contact,
        targetId,
        sources,
      );
      const movedDeals = await this.move(manager, Deal, targetId, sources);
      const movedActivities = await this.move(
        manager,
        Activity,
        targetId,
        sources,
      );
      await manager.delete(Client, {
        clientId: In(sources),
        organizationId: user.organizationId,
      });
      return {
        clientId: targetId,
        mergedCount: sources.length,
        movedContacts,
        movedDeals,
        movedActivities,
      };
    });
  }

  private async lockClients(
    manager: EntityManager,
    ids: number[],
    user: AuthUser,
  ): Promise<Client[]> {
    const clients = await manager
      .getRepository(Client)
      .createQueryBuilder('client')
      .setLock('pessimistic_write')
      .where('client.clientId IN (:...ids)', { ids })
      .andWhere('client.organizationId = :org', { org: user.organizationId })
      .getMany();
    if (clients.length !== ids.length)
      throw new NotFoundException('Клиент не найден');
    if (clients.some((c) => !canAccess(user, c.ownerUserId)))
      throw new ForbiddenException('Клиент закреплён за другим менеджером');
    return clients;
  }

  private async move(
    manager: EntityManager,
    entity: typeof Contact | typeof Deal | typeof Activity,
    targetId: number,
    sources: number[],
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder()
      .update(entity as typeof Contact)
      .set({ clientId: targetId })
      .where('clientId IN (:...sources)', { sources })
      .execute();
    return result.affected ?? 0;
  }
}
