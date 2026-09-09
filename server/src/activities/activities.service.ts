import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActivityStatus, Paginated } from '@crm/shared';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Activity } from './activity.entity';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { CompleteActivityDto } from './dto/complete-activity.dto';
import { QueryActivitiesDto } from './dto/query-activities.dto';
import { ClientsService } from '../clients/clients.service';
import { DealsService } from '../deals/deals.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  applyOwnerScope,
  canAccess,
  canSeeAll,
} from '../common/helpers/owner-scope';
import { paginate } from '../common/helpers/paginate';

const SORTABLE = ['plannedAt', 'status', 'type', 'subject'];

/** Верхняя граница выборки календаря — защита от запроса «всех активностей». */
const CALENDAR_MAX_ITEMS = 500;

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly repo: Repository<Activity>,
    private readonly clientsService: ClientsService,
    private readonly dealsService: DealsService,
  ) {}

  async findAll(
    query: QueryActivitiesDto,
    user: AuthUser,
  ): Promise<Paginated<Activity>> {
    const qb = this.buildScopedQuery(query, user);
    return paginate(qb, query, 'activity', SORTABLE);
  }

  /**
   * Выборка для календаря/планировщика (ТЗ п. 2.5).
   * Возвращает плоский список за период без постраничной разбивки —
   * календарь рисует сразу весь диапазон.
   */
  async findForCalendar(
    query: QueryActivitiesDto,
    user: AuthUser,
  ): Promise<Activity[]> {
    if (!query.from || !query.to) {
      throw new BadRequestException('Укажите период выборки (from и to)');
    }
    return this.buildScopedQuery(query, user)
      .orderBy('activity.plannedAt', 'ASC')
      .take(CALENDAR_MAX_ITEMS)
      .getMany();
  }

  /** Просроченные активности: запланированы, но срок уже прошёл (ТЗ п. 2.4). */
  async findOverdue(user: AuthUser, limit = 100): Promise<Activity[]> {
    const qb = this.repo
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.client', 'client')
      .leftJoinAndSelect('activity.deal', 'deal')
      .leftJoinAndSelect('activity.owner', 'owner')
      .where('activity.status = :planned', {
        planned: ActivityStatus.PLANNED,
      })
      .andWhere('activity.plannedAt < NOW()');

    applyOwnerScope(qb, user, 'activity');

    return qb.orderBy('activity.plannedAt', 'ASC').take(limit).getMany();
  }

  async findOne(activityId: number, user: AuthUser): Promise<Activity> {
    const activity = await this.repo.findOne({
      where: { activityId },
      relations: { client: true, deal: true, owner: true },
    });
    if (!activity) {
      throw new NotFoundException('Активность не найдена');
    }
    if (!canAccess(user, activity.ownerUserId)) {
      throw new ForbiddenException('Активность закреплена за другим менеджером');
    }
    return activity;
  }

  async create(dto: CreateActivityDto, user: AuthUser): Promise<Activity> {
    await this.clientsService.findOne(dto.clientId, user);
    await this.assertDealAllowed(dto.dealId, dto.clientId, user);
    const activity = this.repo.create({
      ...dto,
      plannedAt: new Date(dto.plannedAt),
      status: dto.status ?? ActivityStatus.PLANNED,
      ownerUserId: canSeeAll(user)
        ? (dto.ownerUserId ?? user.userId)
        : user.userId,
    });
    const saved = await this.repo.save(activity);
    return this.findOne(saved.activityId, user);
  }

  async update(
    activityId: number,
    dto: UpdateActivityDto,
    user: AuthUser,
  ): Promise<Activity> {
    const activity = await this.findOne(activityId, user);
    const { ownerUserId, plannedAt, dealId, ...rest } = dto;

    if (dealId !== undefined) {
      await this.assertDealAllowed(dealId, activity.clientId, user);
    }

    /**
     * Изменения применяются точечным UPDATE, а не save() загруженной сущности.
     * findOne() подгружает связь deal, и при сохранении TypeORM берёт dealId
     * из объекта связи, а не из скалярного поля: смена и снятие привязки
     * к сделке терялись молча, при том что API отвечал 200.
     */
    const patch: QueryDeepPartialEntity<Activity> = { ...rest };
    if (plannedAt !== undefined) {
      patch.plannedAt = new Date(plannedAt);
    }
    if (dealId !== undefined) {
      patch.dealId = dealId;
    }
    if (ownerUserId !== undefined && canSeeAll(user)) {
      patch.ownerUserId = ownerUserId;
    }

    if (Object.keys(patch).length > 0) {
      await this.repo.update({ activityId }, patch);
    }
    return this.findOne(activityId, user);
  }

  /** Отметка о выполнении: фиксирует результат и время (ТЗ п. 1.2.4). */
  async complete(
    activityId: number,
    dto: CompleteActivityDto,
    user: AuthUser,
  ): Promise<Activity> {
    const activity = await this.findOne(activityId, user);
    if (activity.status === ActivityStatus.DONE) {
      throw new BadRequestException('Активность уже выполнена');
    }
    activity.status = ActivityStatus.DONE;
    activity.doneAt = new Date();
    activity.result = dto.result;
    if (dto.comment !== undefined) {
      activity.comment = dto.comment;
    }
    await this.repo.save(activity);
    return this.findOne(activityId, user);
  }

  async remove(activityId: number, user: AuthUser): Promise<{ success: true }> {
    const activity = await this.findOne(activityId, user);
    await this.repo.remove(activity);
    return { success: true };
  }

  /**
   * Проверяет право привязать активность к сделке.
   *
   * Без этой проверки менеджер, создавая активность со своим клиентом,
   * мог указать чужой dealId: сделка не проверялась, а ответ подгружал
   * связь deal целиком — то есть карточка чужой сделки утекала в ответ,
   * а перебором dealId выгружалась вся таблица.
   */
  private async assertDealAllowed(
    dealId: number | null | undefined,
    clientId: number,
    user: AuthUser,
  ): Promise<void> {
    if (dealId === null || dealId === undefined) {
      return;
    }
    // findOne бросит 403, если сделка закреплена за другим менеджером
    const deal = await this.dealsService.findOne(dealId, user);
    if (deal.clientId !== clientId) {
      throw new BadRequestException(
        'Сделка относится к другому клиенту: активность нельзя привязать к ней',
      );
    }
  }

  /** Общая часть выборок списка и календаря: связи, права и фильтры. */
  private buildScopedQuery(
    query: QueryActivitiesDto,
    user: AuthUser,
  ): SelectQueryBuilder<Activity> {
    const qb = this.repo
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.client', 'client')
      .leftJoinAndSelect('activity.deal', 'deal')
      .leftJoinAndSelect('activity.owner', 'owner');

    applyOwnerScope(qb, user, 'activity');

    if (query.q) {
      qb.andWhere('(activity.subject ILIKE :q OR client.name ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }
    if (query.type) {
      qb.andWhere('activity.type = :type', { type: query.type });
    }
    if (query.status) {
      qb.andWhere('activity.status = :status', { status: query.status });
    }
    if (query.clientId) {
      qb.andWhere('activity.clientId = :clientId', {
        clientId: query.clientId,
      });
    }
    if (query.dealId) {
      qb.andWhere('activity.dealId = :dealId', { dealId: query.dealId });
    }
    if (query.ownerUserId) {
      qb.andWhere('activity.ownerUserId = :filterOwner', {
        filterOwner: query.ownerUserId,
      });
    }
    if (query.from) {
      qb.andWhere('activity.plannedAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('activity.plannedAt <= :to', { to: query.to });
    }

    return qb;
  }
}
