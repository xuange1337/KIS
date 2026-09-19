import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ActivityStatus,
  BASE_CURRENCY,
  DEAL_CLOSED_STAGES,
  DashboardSummary,
  DealStage,
} from '@crm/shared';
import { Repository } from 'typeorm';
import { Deal } from '../deals/deal.entity';
import { Activity } from '../activities/activity.entity';
import { ActivitiesService } from '../activities/activities.service';
import { ReportsService } from '../reports/reports.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { applyOwnerScope } from '../common/helpers/owner-scope';
import { applyTenantScope } from '../common/helpers/tenant-scope';

const UPCOMING_LIMIT = 10;
const OVERDUE_LIMIT = 10;

/** Сводка для главной страницы — дашборда (ТЗ п. 2.5). */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Deal)
    private readonly dealsRepo: Repository<Deal>,
    @InjectRepository(Activity)
    private readonly activitiesRepo: Repository<Activity>,
    private readonly activitiesService: ActivitiesService,
    private readonly reportsService: ReportsService,
  ) {}

  async summary(user: AuthUser): Promise<DashboardSummary> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [inWork, won, plannedToday, funnel, upcoming, overdue, overdueCount] =
      await Promise.all([
        this.dealsInWork(user),
        this.wonSince(user, monthStart),
        this.plannedBetween(user, dayStart, dayEnd),
        this.reportsService.funnel({ currency: BASE_CURRENCY }, user),
        this.upcomingActivities(user, dayStart),
        this.activitiesService.findOverdue(user, OVERDUE_LIMIT),
        // Список просроченных обрезан лимитом для показа, поэтому счётчик
        // на плитке считается отдельным запросом и показывает полное число
        this.overdueCount(user),
      ]);

    return {
      // Показатели считаются в базовой валюте: курсы в прототипе
      // не хранятся, поэтому суммы разных валют не складываются
      currency: BASE_CURRENCY,
      dealsInWork: inWork.count,
      dealsInWorkAmount: inWork.amount,
      wonThisMonthCount: won.count,
      wonThisMonthAmount: won.amount,
      overdueCount,
      plannedTodayCount: plannedToday,
      funnel,
      upcomingActivities: upcoming as never,
      overdueActivities: overdue as never,
    };
  }

  /** Сделки, не дошедшие до терминальной стадии. */
  private async dealsInWork(
    user: AuthUser,
  ): Promise<{ count: number; amount: number }> {
    const qb = this.dealsRepo
      .createQueryBuilder('deal')
      .select('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(deal.amount), 0)', 'amount')
      .where('deal.stage NOT IN (:...closed)', { closed: DEAL_CLOSED_STAGES })
      .andWhere('deal.currency = :currency', { currency: BASE_CURRENCY });
    applyTenantScope(qb, user, 'deal');
    applyOwnerScope(qb, user, 'deal');
    return this.readAggregate(qb);
  }

  private async wonSince(
    user: AuthUser,
    since: Date,
  ): Promise<{ count: number; amount: number }> {
    const qb = this.dealsRepo
      .createQueryBuilder('deal')
      .select('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(deal.amount), 0)', 'amount')
      .where('deal.stage = :won', { won: DealStage.WON })
      .andWhere('deal.closedAt >= :since', { since })
      .andWhere('deal.currency = :currency', { currency: BASE_CURRENCY });
    applyTenantScope(qb, user, 'deal');
    applyOwnerScope(qb, user, 'deal');
    return this.readAggregate(qb);
  }

  /** Полное число просроченных активностей — без ограничения выборки. */
  private overdueCount(user: AuthUser): Promise<number> {
    const qb = this.activitiesRepo
      .createQueryBuilder('activity')
      .where('activity.status = :planned', { planned: ActivityStatus.PLANNED })
      .andWhere('activity.plannedAt < NOW()');
    applyTenantScope(qb, user, 'activity');
    applyOwnerScope(qb, user, 'activity');
    return qb.getCount();
  }

  private async plannedBetween(
    user: AuthUser,
    from: Date,
    to: Date,
  ): Promise<number> {
    const qb = this.activitiesRepo
      .createQueryBuilder('activity')
      .where('activity.status = :planned', { planned: ActivityStatus.PLANNED })
      .andWhere('activity.plannedAt >= :from AND activity.plannedAt < :to', {
        from,
        to,
      });
    applyTenantScope(qb, user, 'activity');
    applyOwnerScope(qb, user, 'activity');
    return qb.getCount();
  }

  /** Ближайшие активности начиная с сегодняшнего дня. */
  private upcomingActivities(user: AuthUser, from: Date): Promise<Activity[]> {
    const qb = this.activitiesRepo
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.client', 'client')
      .leftJoinAndSelect('activity.deal', 'deal')
      .leftJoinAndSelect('activity.owner', 'owner')
      .where('activity.status = :planned', { planned: ActivityStatus.PLANNED })
      .andWhere('activity.plannedAt >= :from', { from });
    applyTenantScope(qb, user, 'activity');
    applyOwnerScope(qb, user, 'activity');
    return qb
      .orderBy('activity.plannedAt', 'ASC')
      .take(UPCOMING_LIMIT)
      .getMany();
  }

  private async readAggregate(qb: {
    getRawOne: () => Promise<any>;
  }): Promise<{ count: number; amount: number }> {
    const raw = await qb.getRawOne();
    return { count: Number(raw?.count ?? 0), amount: Number(raw?.amount ?? 0) };
  }
}
