import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { canAccess } from '../common/helpers/owner-scope';
import {
  assertTotalFits,
  centsToMoney,
  lineTotalCents,
} from '../offers/item-money';
import { Product } from '../products/product.entity';
import { Deal } from './deal.entity';
import { DealItem } from './deal-item.entity';
import { ReplaceDealItemsDto } from './dto/replace-deal-items.dto';

@Injectable()
export class DealItemsService {
  constructor(
    @InjectRepository(DealItem) private readonly repo: Repository<DealItem>,
    @InjectRepository(Deal) private readonly deals: Repository<Deal>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(dealId: number, user: AuthUser): Promise<DealItem[]> {
    const deal = await this.deals.findOneBy({
      dealId,
      organizationId: user.organizationId,
    });
    if (!deal) throw new NotFoundException('Сделка не найдена');
    if (!canAccess(user, deal.ownerUserId))
      throw new ForbiddenException('Сделка закреплена за другим менеджером');
    return this.repo.find({
      where: { dealId, organizationId: user.organizationId },
      order: { itemId: 'ASC' },
    });
  }

  /**
   * Заменяет состав сделки. Сумма сделки становится суммой позиций:
   * ручной ввод суммы после этого закрыт, иначе два источника одной
   * цифры расходились бы.
   */
  async replace(
    dealId: number,
    dto: ReplaceDealItemsDto,
    user: AuthUser,
  ): Promise<DealItem[]> {
    await this.dataSource.transaction(async (manager) => {
      const deal = await manager.getRepository(Deal).findOne({
        where: { dealId, organizationId: user.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!deal) throw new NotFoundException('Сделка не найдена');
      if (!canAccess(user, deal.ownerUserId))
        throw new ForbiddenException('Сделка закреплена за другим менеджером');
      if (dto.version !== deal.version)
        throw new ConflictException('Сделка уже изменена. Обновите данные');

      const itemRepo = manager.getRepository(DealItem);
      const previous = await itemRepo.findBy({
        dealId,
        organizationId: user.organizationId,
      });
      const previousById = new Map(previous.map((item) => [item.itemId, item]));
      const usedIds = new Set<number>();
      const items: DealItem[] = [];
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
          throw new BadRequestException('Некорректная позиция сделки');
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
        if (source instanceof Product && source.currency !== deal.currency)
          throw new BadRequestException(
            'Валюта позиции не совпадает с валютой сделки',
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
            dealId,
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
      await itemRepo.delete({ dealId, organizationId: user.organizationId });
      if (items.length) await itemRepo.save(items);
      // Пустой состав возвращает сделку к ручной сумме, но саму сумму не
      // трогает: менеджер увидит последнюю рассчитанную и сможет поправить
      if (items.length) deal.amount = centsToMoney(totalCents);
      // VersionColumn увеличит версию при сохранении сам
      await manager.save(deal);
    });
    return this.list(dealId, user);
  }

  hasItems(dealId: number, organizationId: number): Promise<boolean> {
    return this.repo.existsBy({ dealId, organizationId });
  }
}
