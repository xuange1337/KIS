import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated } from '@crm/shared';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Offer } from './offer.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { DealsService } from '../deals/deals.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { applyOwnerScope } from '../common/helpers/owner-scope';
import { applyTenantScope } from '../common/helpers/tenant-scope';
import { paginate } from '../common/helpers/paginate';
import { OfferItem } from './offer-item.entity';
import { Product } from '../products/product.entity';
import { Deal } from '../deals/deal.entity';
import { canAccess } from '../common/helpers/owner-scope';
import { ReplaceOfferItemsDto } from './dto/replace-offer-items.dto';
import { assertTotalFits, centsToMoney, lineTotalCents } from './item-money';

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
    private readonly dataSource: DataSource,
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
      relations: { items: true },
      order: { date: 'DESC', offerId: 'DESC', items: { itemId: 'ASC' } },
    });
  }

  async findOne(offerId: number, user: AuthUser): Promise<Offer> {
    const offer = await this.repo.findOne({
      where: { offerId, organizationId: user.organizationId },
      relations: { deal: true, items: true },
      order: { items: { itemId: 'ASC' } },
    });
    if (!offer) {
      throw new NotFoundException('Коммерческое предложение не найдено');
    }
    await this.dealsService.findOne(offer.dealId, user);
    return offer;
  }

  async create(dto: CreateOfferDto, user: AuthUser): Promise<Offer> {
    const deal = await this.dealsService.findOne(dto.dealId, user);
    const saved = await this.repo.save(
      this.repo.create({
        ...dto,
        currency: deal.currency,
        organizationId: user.organizationId,
      }),
    );
    return this.findOne(saved.offerId, user);
  }

  async update(
    offerId: number,
    dto: UpdateOfferDto,
    user: AuthUser,
  ): Promise<Offer> {
    await this.dataSource.transaction(async (manager) => {
      const offer = await this.lockOffer(manager, offerId, user);
      if (dto.version !== undefined && dto.version !== offer.version)
        throw new ConflictException(
          'Предложение уже изменено. Обновите данные',
        );
      const hasItems = await manager
        .getRepository(OfferItem)
        .existsBy({ offerId });
      if (
        hasItems &&
        dto.totalAmount !== undefined &&
        dto.totalAmount !== offer.totalAmount
      )
        throw new BadRequestException(
          'Сумма рассчитывается по позициям. Измените состав предложения',
        );
      const { version: _version, ...changes } = dto;
      Object.assign(offer, changes);
      offer.version += 1;
      await manager.save(offer);
    });
    return this.findOne(offerId, user);
  }

  async replaceItems(
    offerId: number,
    dto: ReplaceOfferItemsDto,
    user: AuthUser,
  ): Promise<Offer> {
    await this.dataSource.transaction(async (manager) => {
      const offer = await this.lockOffer(manager, offerId, user);
      if (dto.version !== offer.version)
        throw new ConflictException(
          'Предложение уже изменено. Обновите данные',
        );
      const itemRepo = manager.getRepository(OfferItem);
      const previous = await itemRepo.findBy({
        offerId,
        organizationId: user.organizationId,
      });
      const previousById = new Map(previous.map((item) => [item.itemId, item]));
      const usedIds = new Set<number>();
      const items: OfferItem[] = [];
      let totalCents = 0n;
      for (const input of dto.items) {
        const existing =
          input.itemId === undefined
            ? undefined
            : previousById.get(input.itemId);
        if (
          input.itemId !== undefined &&
          (!existing ||
            existing.productId !== input.productId ||
            usedIds.has(input.itemId))
        )
          throw new BadRequestException('Некорректная позиция предложения');
        if (input.itemId !== undefined) usedIds.add(input.itemId);
        const source =
          existing ??
          (await manager.getRepository(Product).findOneBy({
            productId: input.productId,
            organizationId: user.organizationId,
            isActive: true,
          }));
        if (!source)
          throw new NotFoundException('Активная позиция каталога не найдена');
        if (source instanceof Product && source.currency !== offer.currency)
          throw new BadRequestException(
            'Валюта позиции не совпадает с валютой предложения',
          );
        const unitPrice =
          input.unitPrice ??
          (existing ? existing.unitPrice : (source as Product).price);
        const lineCents = lineTotalCents(unitPrice, input.quantity);
        totalCents += lineCents;
        assertTotalFits(totalCents);
        items.push(
          itemRepo.create({
            organizationId: user.organizationId,
            offerId,
            productId: input.productId,
            sku: source.sku,
            name: source.name,
            unit: source.unit,
            quantity: input.quantity,
            unitPrice,
            totalAmount: centsToMoney(lineCents),
          }),
        );
      }
      await itemRepo.delete({ offerId, organizationId: user.organizationId });
      if (items.length) await itemRepo.save(items);
      offer.totalAmount = centsToMoney(totalCents);
      offer.version += 1;
      await manager.save(offer);
    });
    return this.findOne(offerId, user);
  }

  private async lockOffer(
    manager: EntityManager,
    offerId: number,
    user: AuthUser,
  ): Promise<Offer> {
    const offer = await manager.getRepository(Offer).findOne({
      where: { offerId, organizationId: user.organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!offer)
      throw new NotFoundException('Коммерческое предложение не найдено');
    const deal = await manager
      .getRepository(Deal)
      .findOneBy({ dealId: offer.dealId, organizationId: user.organizationId });
    if (!deal) throw new NotFoundException('Сделка не найдена');
    if (!canAccess(user, deal.ownerUserId))
      throw new ForbiddenException('Сделка закреплена за другим менеджером');
    return offer;
  }

  async remove(offerId: number, user: AuthUser): Promise<{ success: true }> {
    const offer = await this.findOne(offerId, user);
    await this.repo.remove(offer);
    return { success: true };
  }
}
