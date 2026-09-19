import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DEAL_STAGE_PROBABILITY,
  DealStage,
  Paginated,
  isClosedStage,
} from '@crm/shared';
import { DataSource, Repository } from 'typeorm';
import { Deal } from './deal.entity';
import { DealStageHistory } from './deal-stage-history.entity';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { QueryDealsDto } from './dto/query-deals.dto';
import { ClientsService } from '../clients/clients.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  applyOwnerScope,
  canAccess,
  canSeeAll,
} from '../common/helpers/owner-scope';
import { applyTenantScope } from '../common/helpers/tenant-scope';
import { UsersService } from '../users/users.service';
import { paginate } from '../common/helpers/paginate';

const SORTABLE = ['createdAt', 'amount', 'plannedClose', 'title', 'stage'];

@Injectable()
export class DealsService {
  constructor(
    @InjectRepository(Deal)
    private readonly repo: Repository<Deal>,
    @InjectRepository(DealStageHistory)
    private readonly historyRepo: Repository<DealStageHistory>,
    private readonly clientsService: ClientsService,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: QueryDealsDto,
    user: AuthUser,
  ): Promise<Paginated<Deal>> {
    const qb = this.repo
      .createQueryBuilder('deal')
      .leftJoinAndSelect('deal.client', 'client')
      .leftJoinAndSelect('deal.owner', 'owner');

    applyTenantScope(qb, user, 'deal');
    applyOwnerScope(qb, user, 'deal');

    if (query.q) {
      qb.andWhere('(deal.title ILIKE :q OR client.name ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }
    if (query.stage) {
      qb.andWhere('deal.stage = :stage', { stage: query.stage });
    }
    if (query.clientId) {
      qb.andWhere('deal.clientId = :clientId', { clientId: query.clientId });
    }
    if (query.ownerUserId) {
      qb.andWhere('deal.ownerUserId = :filterOwner', {
        filterOwner: query.ownerUserId,
      });
    }
    if (query.from) {
      qb.andWhere('deal.plannedClose >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('deal.plannedClose <= :to', { to: query.to });
    }
    if (query.amountFrom !== undefined) {
      qb.andWhere('deal.amount >= :amountFrom', {
        amountFrom: query.amountFrom,
      });
    }
    if (query.amountTo !== undefined) {
      qb.andWhere('deal.amount <= :amountTo', { amountTo: query.amountTo });
    }

    return paginate(qb, query, 'deal', SORTABLE);
  }

  async findOne(dealId: number, user: AuthUser): Promise<Deal> {
    const deal = await this.repo.findOne({
      // Организация в условии выборки: чужая сделка неотличима от
      // несуществующей, иначе перебор идентификаторов раскрывает состав
      where: { dealId, organizationId: user.organizationId },
      relations: { client: true, owner: true },
    });
    if (!deal) {
      throw new NotFoundException('Сделка не найдена');
    }
    if (!canAccess(user, deal.ownerUserId)) {
      throw new ForbiddenException('Сделка закреплена за другим менеджером');
    }
    return deal;
  }

  /** История смены стадий по сделке (ТЗ п. 1.2.3). */
  async findHistory(
    dealId: number,
    user: AuthUser,
  ): Promise<DealStageHistory[]> {
    await this.findOne(dealId, user);
    return this.historyRepo.find({
      where: { dealId },
      relations: { changedByUser: true },
      order: { changedAt: 'ASC' },
    });
  }

  async create(dto: CreateDealDto, user: AuthUser): Promise<Deal> {
    // Сделку можно завести только по доступному клиенту
    await this.clientsService.findOne(dto.clientId, user);
    // Проверяется только то значение, которое будет применено
    if (canSeeAll(user)) {
      await this.assertOwnerInTenant(dto.ownerUserId, user);
    }
    const stage = dto.stage ?? DealStage.NEW;

    return this.dataSource.transaction(async (manager) => {
      const deal = manager.getRepository(Deal).create({
        ...dto,
        organizationId: user.organizationId,
        stage,
        probability: dto.probability ?? DEAL_STAGE_PROBABILITY[stage],
        closedAt: isClosedStage(stage) ? new Date() : null,
        ownerUserId: canSeeAll(user)
          ? (dto.ownerUserId ?? user.userId)
          : user.userId,
      });
      const saved = await manager.getRepository(Deal).save(deal);

      // Первая запись истории фиксирует стадию, с которой сделка заведена
      await manager.getRepository(DealStageHistory).save({
        organizationId: user.organizationId,
        dealId: saved.dealId,
        fromStage: null,
        toStage: stage,
        changedBy: user.userId,
      });

      return manager.getRepository(Deal).findOneOrFail({
        where: { dealId: saved.dealId },
        relations: { client: true, owner: true },
      });
    });
  }

  async update(
    dealId: number,
    dto: UpdateDealDto,
    user: AuthUser,
  ): Promise<Deal> {
    const deal = await this.findOne(dealId, user);
    const { ownerUserId, ...rest } = dto;
    Object.assign(deal, rest);
    if (ownerUserId !== undefined && canSeeAll(user)) {
      await this.assertOwnerInTenant(ownerUserId, user);
      deal.ownerUserId = ownerUserId;
    }
    await this.repo.save(deal);
    return this.findOne(dealId, user);
  }

  /**
   * Смена стадии: обновление сделки и запись в историю выполняются
   * в одной транзакции, иначе история разъедется с текущим состоянием.
   */
  async changeStage(
    dealId: number,
    stage: DealStage,
    user: AuthUser,
  ): Promise<Deal> {
    // Права проверяются до транзакции: чужую сделку блокировать незачем
    await this.findOne(dealId, user);

    return this.dataSource.transaction(async (manager) => {
      /**
       * Строка блокируется на запись, и текущая стадия читается уже внутри
       * транзакции. Иначе два параллельных перевода (двойной клик в канбане,
       * два открытых окна) читали одну и ту же исходную стадию, оба проходили
       * проверку и писали в историю по записи — история переставала отражать
       * действительную последовательность переходов.
       */
      const deal = await manager.getRepository(Deal).findOneOrFail({
        where: { dealId },
        lock: { mode: 'pessimistic_write' },
      });

      if (deal.stage === stage) {
        throw new BadRequestException('Сделка уже находится на этой стадии');
      }
      const fromStage = deal.stage;

      deal.stage = stage;
      deal.probability = DEAL_STAGE_PROBABILITY[stage];
      // Переход на терминальную стадию фиксирует дату закрытия,
      // возврат в работу — снимает её
      deal.closedAt = isClosedStage(stage) ? new Date() : null;
      await manager.getRepository(Deal).save(deal);

      await manager.getRepository(DealStageHistory).save({
        organizationId: user.organizationId,
        dealId,
        fromStage,
        toStage: stage,
        changedBy: user.userId,
      });

      return manager.getRepository(Deal).findOneOrFail({
        where: { dealId },
        relations: { client: true, owner: true },
      });
    });
  }

  /**
   * Удаление сделки.
   *
   * По каскаду уносятся коммерческие предложения, активности и вся история
   * стадий — то есть ровно те данные, ради которых история и ведётся.
   * Поэтому сначала сообщаем состав потерь и удаляем только при явном
   * подтверждении (force).
   */
  async remove(
    dealId: number,
    user: AuthUser,
    force = false,
  ): Promise<{ success: true }> {
    const deal = await this.findOne(dealId, user);

    if (!force) {
      const dependents = await this.countDependents(dealId);
      if (dependents.offers > 0 || dependents.activities > 0) {
        throw new ConflictException({
          message:
            'Вместе со сделкой будут удалены связанные записи и история стадий. ' +
            'Повторите удаление с подтверждением',
          dependents,
        });
      }
    }

    await this.repo.remove(deal);
    return { success: true };
  }

  /** Ответственный должен работать в той же организации. */
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

  /** Сколько записей будет затронуто удалением сделки. */
  private async countDependents(
    dealId: number,
  ): Promise<{ offers: number; activities: number; stageHistory: number }> {
    const [offers, activities, stageHistory] = await Promise.all([
      this.repo.manager.count('commercial_offers', {
        where: { dealId },
      } as never),
      this.repo.manager.count('activities', { where: { dealId } } as never),
      this.historyRepo.count({ where: { dealId } }),
    ]);
    return { offers, activities, stageHistory };
  }
}
