import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActivityRecurrence, ActivityStatus, Paginated } from '@crm/shared';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
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
import { applyTenantScope } from '../common/helpers/tenant-scope';
import { UsersService } from '../users/users.service';
import { paginate } from '../common/helpers/paginate';
import { nextOccurrence } from './recurrence';

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
    private readonly usersService: UsersService,
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

    applyTenantScope(qb, user, 'activity');
    applyOwnerScope(qb, user, 'activity');

    return qb.orderBy('activity.plannedAt', 'ASC').take(limit).getMany();
  }

  async findOne(activityId: number, user: AuthUser): Promise<Activity> {
    const activity = await this.repo.findOne({
      where: { activityId, organizationId: user.organizationId },
      relations: { client: true, deal: true, owner: true },
    });
    if (!activity) {
      throw new NotFoundException('Активность не найдена');
    }
    if (!canAccess(user, activity.ownerUserId)) {
      throw new ForbiddenException(
        'Активность закреплена за другим менеджером',
      );
    }
    return activity;
  }

  async create(dto: CreateActivityDto, user: AuthUser): Promise<Activity> {
    await this.clientsService.findOne(dto.clientId, user);
    await this.assertDealAllowed(dto.dealId, dto.clientId, user);
    // Проверяется только то значение, которое будет применено
    if (canSeeAll(user)) {
      await this.assertOwnerInTenant(dto.ownerUserId, user);
    }
    const plannedAt = new Date(dto.plannedAt);
    const recurrenceUntil = dto.recurrenceUntil
      ? new Date(dto.recurrenceUntil)
      : null;
    this.assertRecurrence(dto.recurrence ?? null, recurrenceUntil, plannedAt);
    const activity = this.repo.create({
      ...dto,
      organizationId: user.organizationId,
      plannedAt,
      recurrence: dto.recurrence ?? null,
      recurrenceUntil,
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
    const {
      ownerUserId,
      plannedAt,
      dealId,
      recurrence,
      recurrenceUntil,
      ...rest
    } = dto;

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
      await this.assertOwnerInTenant(ownerUserId, user);
      patch.ownerUserId = ownerUserId;
    }
    if (
      recurrence !== undefined ||
      recurrenceUntil !== undefined ||
      plannedAt !== undefined
    ) {
      // Правило проверяется в итоговом виде: частичное обновление не должно
      // оставлять предел серии раньше даты самой активности
      const nextRecurrence =
        recurrence !== undefined ? recurrence : activity.recurrence;
      let nextUntil =
        recurrenceUntil !== undefined
          ? recurrenceUntil
            ? new Date(recurrenceUntil)
            : null
          : activity.recurrenceUntil;
      // Снятие повтора снимает и предел: он имеет смысл только вместе с ним
      if (nextRecurrence === null && recurrenceUntil === undefined) {
        nextUntil = null;
      }
      this.assertRecurrence(
        nextRecurrence,
        nextUntil,
        plannedAt !== undefined ? new Date(plannedAt) : activity.plannedAt,
      );
      if (recurrence !== undefined) patch.recurrence = recurrence;
      if (recurrenceUntil !== undefined || nextRecurrence === null) {
        patch.recurrenceUntil = nextUntil;
      }
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
    const doneAt = new Date();

    await this.repo.manager.transaction(async (manager) => {
      // Условный UPDATE вместо save(): при двух одновременных отметках
      // выполнится ровно одна, и следующая активность серии появится один раз
      const marked = await manager.update(
        Activity,
        { activityId, status: ActivityStatus.PLANNED },
        {
          status: ActivityStatus.DONE,
          doneAt,
          result: dto.result,
          ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
        },
      );
      if (!marked.affected) {
        throw new BadRequestException('Активность уже выполнена');
      }
      await this.scheduleNextOccurrence(manager, activity, doneAt);
    });
    return this.findOne(activityId, user);
  }

  async remove(activityId: number, user: AuthUser): Promise<{ success: true }> {
    const activity = await this.findOne(activityId, user);
    await this.repo.remove(activity);
    return { success: true };
  }

  /**
   * Создаёт следующую активность серии после выполнения текущей.
   * Серия заканчивается, если следующая дата выходит за предел.
   */
  private async scheduleNextOccurrence(
    manager: EntityManager,
    done: Activity,
    now: Date,
  ): Promise<void> {
    if (!done.recurrence) return;
    const plannedAt = nextOccurrence(done.plannedAt, done.recurrence, now);
    if (done.recurrenceUntil && plannedAt > done.recurrenceUntil) return;
    await manager.insert(Activity, {
      organizationId: done.organizationId,
      clientId: done.clientId,
      dealId: done.dealId,
      type: done.type,
      subject: done.subject,
      plannedAt,
      status: ActivityStatus.PLANNED,
      // Заметка к плану переносится, результат прошлого раза — нет
      comment: done.comment,
      ownerUserId: done.ownerUserId,
      recurrence: done.recurrence,
      recurrenceUntil: done.recurrenceUntil,
    });
  }

  private assertRecurrence(
    recurrence: ActivityRecurrence | null,
    until: Date | null,
    plannedAt: Date,
  ): void {
    if (until && !recurrence) {
      throw new BadRequestException(
        'Дата окончания повторов задаётся только для повторяющейся активности',
      );
    }
    if (until && until < plannedAt) {
      throw new BadRequestException(
        'Дата окончания повторов раньше даты активности',
      );
    }
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

    applyTenantScope(qb, user, 'activity');
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
