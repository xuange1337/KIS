import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ActivityStatus,
  ActivityType,
  BASE_CURRENCY,
  DEAL_STAGE_LABELS,
  DealStage,
  FunnelRow,
  ManagerActivityRow,
  OverdueActivityRow,
  SalesDynamicsRow,
  TopRow,
} from '@crm/shared';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Deal } from '../deals/deal.entity';
import { Activity } from '../activities/activity.entity';
import { Client } from '../clients/client.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { applyOwnerScope, canSeeAll } from '../common/helpers/owner-scope';
import { applyTenantScope } from '../common/helpers/tenant-scope';
import {
  ReportQueryDto,
  SalesDynamicsQueryDto,
  TopQueryDto,
} from './dto/report-query.dto';

/**
 * Отчёты, формируемые программой (ТЗ п. 2.4).
 * Все выборки агрегирующие, выполняются на стороне СУБД —
 * в приложение не поднимаются сырые списки сделок и активностей.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Deal)
    private readonly dealsRepo: Repository<Deal>,
    @InjectRepository(Activity)
    private readonly activitiesRepo: Repository<Activity>,
    @InjectRepository(Client)
    private readonly clientsRepo: Repository<Client>,
  ) {}

  /** 1. Воронка продаж: количество и сумма сделок по стадиям. */
  async funnel(query: ReportQueryDto, user: AuthUser): Promise<FunnelRow[]> {
    const qb = this.dealsRepo
      .createQueryBuilder('deal')
      .select('deal.stage', 'stage')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(deal.amount), 0)', 'amount')
      .groupBy('deal.stage');

    this.applyReportScope(qb, query, user, 'deal', 'deal.createdAt');
    this.applyCurrency(qb, query);

    const rows = await qb.getRawMany<{
      stage: DealStage;
      count: number;
      amount: string;
    }>();
    const byStage = new Map(rows.map((row) => [row.stage, row]));

    // Стадии без сделок тоже показываются — иначе воронка «рвётся»
    return (Object.keys(DEAL_STAGE_LABELS) as DealStage[]).map((stage) => ({
      stage,
      count: byStage.get(stage)?.count ?? 0,
      amount: Number(byStage.get(stage)?.amount ?? 0),
    }));
  }

  /** 2. Динамика продаж: сумма выигранных сделок по неделям/месяцам. */
  async salesDynamics(
    query: SalesDynamicsQueryDto,
    user: AuthUser,
  ): Promise<SalesDynamicsRow[]> {
    const granularity = query.granularity === 'week' ? 'week' : 'month';

    const qb = this.dealsRepo
      .createQueryBuilder('deal')
      .select(
        `TO_CHAR(DATE_TRUNC('${granularity}', deal.closedAt), 'YYYY-MM-DD')`,
        'period',
      )
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(deal.amount), 0)', 'amount')
      .where('deal.stage = :won', { won: DealStage.WON })
      .andWhere('deal.closedAt IS NOT NULL')
      .groupBy('period')
      .orderBy('period', 'ASC');

    this.applyReportScope(qb, query, user, 'deal', 'deal.closedAt');
    this.applyCurrency(qb, query);

    const rows = await qb.getRawMany<{
      period: string;
      count: number;
      amount: string;
    }>();
    return rows.map((row) => ({
      period: row.period,
      count: row.count,
      amount: Number(row.amount),
    }));
  }

  /** 3. Активности менеджеров: количество звонков/встреч/писем по сотрудникам. */
  async managerActivities(
    query: ReportQueryDto,
    user: AuthUser,
  ): Promise<ManagerActivityRow[]> {
    const qb = this.activitiesRepo
      .createQueryBuilder('activity')
      .innerJoin('activity.owner', 'owner')
      .select('owner.user_id', 'ownerUserId')
      .addSelect('owner.full_name', 'fullName')
      .addSelect(
        `COUNT(*) FILTER (WHERE activity.type = '${ActivityType.CALL}')::int`,
        'calls',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE activity.type = '${ActivityType.MEETING}')::int`,
        'meetings',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE activity.type = '${ActivityType.EMAIL}')::int`,
        'emails',
      )
      .addSelect('COUNT(*)::int', 'total')
      .groupBy('owner.user_id')
      .addGroupBy('owner.full_name')
      .orderBy('total', 'DESC');

    this.applyReportScope(qb, query, user, 'activity', 'activity.plannedAt');

    return qb.getRawMany<ManagerActivityRow>();
  }

  /** 4. Просроченные активности: срок прошёл, отметки о выполнении нет. */
  async overdueActivities(
    query: ReportQueryDto,
    user: AuthUser,
  ): Promise<OverdueActivityRow[]> {
    const qb = this.activitiesRepo
      .createQueryBuilder('activity')
      .innerJoin('activity.client', 'client')
      .leftJoin('activity.owner', 'owner')
      .select('activity.activity_id', 'activityId')
      .addSelect('activity.type', 'type')
      .addSelect('activity.subject', 'subject')
      .addSelect('activity.planned_at', 'plannedAt')
      .addSelect(
        'EXTRACT(DAY FROM NOW() - activity.planned_at)::int',
        'daysOverdue',
      )
      .addSelect('client.name', 'clientName')
      .addSelect("COALESCE(owner.full_name, '—')", 'ownerName')
      .where('activity.status = :planned', { planned: ActivityStatus.PLANNED })
      .andWhere('activity.planned_at < NOW()')
      .orderBy('activity.planned_at', 'ASC');

    this.applyReportScope(qb, query, user, 'activity', 'activity.plannedAt');

    return qb.getRawMany<OverdueActivityRow>();
  }

  /** 5. ТОП клиентов или сделок по сумме. */
  async top(query: TopQueryDto, user: AuthUser): Promise<TopRow[]> {
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 50) : 10;

    if (query.entity === 'deals') {
      const qb = this.dealsRepo
        .createQueryBuilder('deal')
        .innerJoin('deal.client', 'client')
        .select('deal.deal_id', 'id')
        .addSelect("deal.title || ' (' || client.name || ')'", 'name')
        .addSelect('1', 'dealsCount')
        .addSelect('deal.amount', 'amount')
        .orderBy('deal.amount', 'DESC')
        .limit(limit);

      this.applyReportScope(qb, query, user, 'deal', 'deal.createdAt');
      this.applyCurrency(qb, query);
      const rows = await qb.getRawMany<TopRow>();
      return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
    }

    const qb = this.clientsRepo
      .createQueryBuilder('client')
      .innerJoin('client.deals', 'deal')
      .select('client.client_id', 'id')
      .addSelect('client.name', 'name')
      .addSelect('COUNT(deal.deal_id)::int', 'dealsCount')
      .addSelect('COALESCE(SUM(deal.amount), 0)', 'amount')
      .groupBy('client.client_id')
      .addGroupBy('client.name')
      .orderBy('amount', 'DESC')
      .limit(limit);

    // Клиенты ранжируются по своим сделкам, поэтому скоуп берётся от сделки
    this.applyReportScope(qb, query, user, 'deal', 'deal.createdAt');
    this.applyCurrency(qb, query);
    const rows = await qb.getRawMany<TopRow>();
    return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
  }

  /**
   * Ограничивает выборку одной валютой.
   *
   * Курсы в прототипе не хранятся, поэтому SUM(amount) по сделкам в разных
   * валютах давал бы бессмысленное число, подписанное рублями.
   */
  private applyCurrency<T extends object>(
    qb: SelectQueryBuilder<T>,
    query: ReportQueryDto,
  ): void {
    qb.andWhere('deal.currency = :reportCurrency', {
      reportCurrency: query.currency ?? BASE_CURRENCY,
    });
  }

  /**
   * Общие ограничения любого отчёта: период, фильтр по ответственному
   * и разграничение доступа. Менеджер видит только свои данные,
   * поэтому явный фильтр по чужому сотруднику для него игнорируется.
   */
  private applyReportScope<T extends object>(
    qb: SelectQueryBuilder<T>,
    query: ReportQueryDto,
    user: AuthUser,
    alias: string,
    dateColumn: string,
  ): void {
    // Организация ограничивает выборку раньше ролей: отчёт не должен
    // суммировать чужие сделки даже для администратора
    applyTenantScope(qb, user, alias);
    applyOwnerScope(qb, user, alias);

    if (query.ownerUserId && canSeeAll(user)) {
      qb.andWhere(`${alias}.ownerUserId = :reportOwner`, {
        reportOwner: query.ownerUserId,
      });
    }
    if (query.from) {
      qb.andWhere(`${dateColumn} >= :reportFrom`, { reportFrom: query.from });
    }
    if (query.to) {
      // Верхняя граница включает весь указанный день
      qb.andWhere(`${dateColumn} < (:reportTo::date + INTERVAL '1 day')`, {
        reportTo: query.to,
      });
    }
  }
}
