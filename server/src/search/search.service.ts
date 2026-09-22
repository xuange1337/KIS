import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GlobalSearchResult, SearchHit } from '@crm/shared';
import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { Deal } from '../deals/deal.entity';
import { Activity } from '../activities/activity.entity';
import { Offer } from '../offers/offer.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { applyOwnerScope } from '../common/helpers/owner-scope';
import { applyTenantScope } from '../common/helpers/tenant-scope';

/** Сколько совпадений отдаётся по каждому разделу. */
const PER_GROUP = 5;

/**
 * Поиск по всем разделам сразу.
 *
 * До него найти запись можно было, только зная, где искать: клиент — в
 * клиентах, сделка — в сделках. Менеджер, которому звонят и называют
 * фамилию или номер предложения, перебирал разделы руками.
 *
 * Поиск идёт по тем же правилам видимости, что и списки: организация
 * ограничивает выборку, роль — записи внутри неё. Иначе строка поиска
 * стала бы обходным путём к чужим данным.
 */
@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepo: Repository<Client>,
    @InjectRepository(Deal)
    private readonly dealsRepo: Repository<Deal>,
    @InjectRepository(Activity)
    private readonly activitiesRepo: Repository<Activity>,
    @InjectRepository(Offer)
    private readonly offersRepo: Repository<Offer>,
  ) {}

  async search(query: string, user: AuthUser): Promise<GlobalSearchResult> {
    const term = `%${query.trim()}%`;

    const [clients, deals, activities, offers] = await Promise.all([
      this.findClients(term, user),
      this.findDeals(term, user),
      this.findActivities(term, user),
      this.findOffers(term, user),
    ]);

    return { clients, deals, activities, offers };
  }

  private async findClients(
    term: string,
    user: AuthUser,
  ): Promise<SearchHit[]> {
    const qb = this.clientsRepo
      .createQueryBuilder('client')
      .where('(client.name ILIKE :term OR client.inn ILIKE :term)', { term });
    applyTenantScope(qb, user, 'client');
    applyOwnerScope(qb, user, 'client');

    const rows = await qb
      .orderBy('client.name', 'ASC')
      .take(PER_GROUP)
      .getMany();
    return rows.map((client) => ({
      id: client.clientId,
      title: client.name,
      subtitle: client.inn ? `ИНН ${client.inn}` : (client.industry ?? ''),
      url: `/clients/${client.clientId}`,
    }));
  }

  private async findDeals(term: string, user: AuthUser): Promise<SearchHit[]> {
    const qb = this.dealsRepo
      .createQueryBuilder('deal')
      .innerJoin('deal.client', 'client')
      .addSelect('client.name')
      .where('(deal.title ILIKE :term OR client.name ILIKE :term)', { term });
    applyTenantScope(qb, user, 'deal');
    applyOwnerScope(qb, user, 'deal');

    const rows = await qb
      .orderBy('deal.createdAt', 'DESC')
      .take(PER_GROUP)
      .getMany();
    return rows.map((deal) => ({
      id: deal.dealId,
      title: deal.title,
      subtitle: deal.client?.name ?? '',
      url: `/deals/${deal.dealId}`,
    }));
  }

  private async findActivities(
    term: string,
    user: AuthUser,
  ): Promise<SearchHit[]> {
    const qb = this.activitiesRepo
      .createQueryBuilder('activity')
      .innerJoin('activity.client', 'client')
      .addSelect('client.name')
      .where('(activity.subject ILIKE :term OR client.name ILIKE :term)', {
        term,
      });
    applyTenantScope(qb, user, 'activity');
    applyOwnerScope(qb, user, 'activity');

    const rows = await qb
      .orderBy('activity.plannedAt', 'DESC')
      .take(PER_GROUP)
      .getMany();
    return rows.map((activity) => ({
      id: activity.activityId,
      title: activity.subject,
      subtitle: activity.client?.name ?? '',
      // У активности нет своей страницы: открывается карточка клиента
      url: `/clients/${activity.clientId}`,
    }));
  }

  private async findOffers(term: string, user: AuthUser): Promise<SearchHit[]> {
    const qb = this.offersRepo
      .createQueryBuilder('offer')
      .innerJoin('offer.deal', 'deal')
      .addSelect('deal.title')
      .where('(offer.number ILIKE :term OR deal.title ILIKE :term)', { term });
    applyTenantScope(qb, user, 'offer');
    // У КП нет своего владельца: права наследуются от сделки
    applyOwnerScope(qb, user, 'deal');

    const rows = await qb
      .orderBy('offer.date', 'DESC')
      .take(PER_GROUP)
      .getMany();
    return rows.map((offer) => ({
      id: offer.offerId,
      title: `КП ${offer.number}`,
      subtitle: offer.deal?.title ?? '',
      url: `/deals/${offer.dealId}`,
    }));
  }
}
