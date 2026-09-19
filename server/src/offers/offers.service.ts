import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated } from '@crm/shared';
import { Repository } from 'typeorm';
import { Offer } from './offer.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { DealsService } from '../deals/deals.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { applyOwnerScope } from '../common/helpers/owner-scope';
import { applyTenantScope } from '../common/helpers/tenant-scope';
import { paginate } from '../common/helpers/paginate';

const SORTABLE = ['date', 'totalAmount', 'number', 'status'];

/**
 * Модуль коммерческих предложений (ТЗ п. 1.2.5).
 * Права наследуются от сделки — проверка идёт через DealsService.
 */
@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer)
    private readonly repo: Repository<Offer>,
    private readonly dealsService: DealsService,
  ) {}

  async findAll(
    query: QueryOffersDto,
    user: AuthUser,
  ): Promise<Paginated<Offer>> {
    const qb = this.repo
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.deal', 'deal')
      .leftJoinAndSelect('deal.client', 'client');

    applyTenantScope(qb, user, 'offer');
    // У КП нет своего владельца, поэтому скоуп накладывается на сделку
    applyOwnerScope(qb, user, 'deal');

    if (query.q) {
      qb.andWhere('(offer.number ILIKE :q OR deal.title ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }
    if (query.status) {
      qb.andWhere('offer.status = :status', { status: query.status });
    }
    if (query.dealId) {
      qb.andWhere('offer.dealId = :dealId', { dealId: query.dealId });
    }

    return paginate(qb, query, 'offer', SORTABLE);
  }

  async findByDeal(dealId: number, user: AuthUser): Promise<Offer[]> {
    await this.dealsService.findOne(dealId, user);
    return this.repo.find({
      where: { dealId, organizationId: user.organizationId },
      order: { date: 'DESC' },
    });
  }

  async findOne(offerId: number, user: AuthUser): Promise<Offer> {
    const offer = await this.repo.findOne({
      where: { offerId, organizationId: user.organizationId },
      relations: { deal: true },
    });
    if (!offer) {
      throw new NotFoundException('Коммерческое предложение не найдено');
    }
    await this.dealsService.findOne(offer.dealId, user);
    return offer;
  }

  async create(dto: CreateOfferDto, user: AuthUser): Promise<Offer> {
    await this.dealsService.findOne(dto.dealId, user);
    const saved = await this.repo.save(
      this.repo.create({ ...dto, organizationId: user.organizationId }),
    );
    return this.findOne(saved.offerId, user);
  }

  async update(
    offerId: number,
    dto: UpdateOfferDto,
    user: AuthUser,
  ): Promise<Offer> {
    const offer = await this.findOne(offerId, user);
    Object.assign(offer, dto);
    await this.repo.save(offer);
    return this.findOne(offerId, user);
  }

  async remove(offerId: number, user: AuthUser): Promise<{ success: true }> {
    const offer = await this.findOne(offerId, user);
    await this.repo.remove(offer);
    return { success: true };
  }
}
