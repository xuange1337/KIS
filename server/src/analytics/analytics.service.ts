import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  BASE_CURRENCY,
  ConversionRow,
  DEAL_STAGE_LABELS,
  DealStage,
  ForecastRow,
  ManagerRankingRow,
} from '@crm/shared';
import { DataSource } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { canSeeAll } from '../common/helpers/owner-scope';

/** Рабочие стадии по порядку: по ним считается прохождение воронки. */
const FLOW: DealStage[] = [
  DealStage.NEW,
  DealStage.QUALIFICATION,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
  DealStage.WON,
];

@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Условие видимости: менеджер видит только свои сделки. */
  private scope(user: AuthUser, alias: string) {
    const params: unknown[] = [user.organizationId];
    let sql = `${alias}.organization_id = $1`;
    if (!canSeeAll(user)) {
      params.push(user.userId);
      sql += ` AND ${alias}.owner_user_id = $2`;
    }
    return { sql, params };
  }

  /**
   * Прогноз поступлений: открытые сделки по месяцам планового закрытия.
   * «Взвешенная» сумма — сумма, умноженная на вероятность стадии. Сделки
   * без плановой даты собраны в отдельную строку, а сделки в других
   * валютах не складываются с рублёвыми и только учитываются в счётчике.
   */
  async forecast(user: AuthUser, months = 6): Promise<ForecastRow[]> {
    const scope = this.scope(user, 'd');
    const rows: Array<{
      month: string | null;
      count: number;
      amount: string;
      weighted: string;
      other: number;
    }> = await this.dataSource.query(
      `SELECT to_char(date_trunc('month', d.planned_close), 'YYYY-MM') AS month,
              count(*)::int AS count,
              coalesce(sum(d.amount) FILTER (WHERE d.currency = '${BASE_CURRENCY}'), 0) AS amount,
              coalesce(sum(d.amount * d.probability / 100.0)
                       FILTER (WHERE d.currency = '${BASE_CURRENCY}'), 0) AS weighted,
              count(*) FILTER (WHERE d.currency <> '${BASE_CURRENCY}')::int AS other
         FROM deals d
        WHERE ${scope.sql}
          AND d.stage NOT IN ('won', 'lost')
          AND (d.planned_close IS NULL
               OR d.planned_close < date_trunc('month', now()) + make_interval(months => $${scope.params.length + 1}))
        GROUP BY 1
        ORDER BY month NULLS LAST`,
      [...scope.params, months],
    );
    return rows.map((row) => ({
      month: row.month,
      dealsCount: row.count,
      amount: Number(row.amount),
      weightedAmount: Math.round(Number(row.weighted) * 100) / 100,
      otherCurrencyCount: row.other,
    }));
  }

  /**
   * Конверсия воронки: какая доля сделок, дошедших до стадии, дошла до
   * следующей. Считается по истории переходов — стадия засчитывается,
   * если сделка была на ней или ушла дальше.
   */
  async conversion(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<ConversionRow[]> {
    const scope = this.scope(user, 'd');
    const params = [...scope.params];
    let period = '';
    if (from) {
      params.push(from);
      period += ` AND d.created_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      period += ` AND d.created_at < ($${params.length}::date + 1)`;
    }
    const rows: Array<{ best: number; deals: number }> =
      await this.dataSource.query(
        `WITH best AS (
           SELECT d.deal_id,
                  max(CASE h.to_stage
                        WHEN 'new' THEN 0 WHEN 'qualification' THEN 1
                        WHEN 'proposal' THEN 2 WHEN 'negotiation' THEN 3
                        WHEN 'won' THEN 4 ELSE -1 END) AS best
             FROM deals d JOIN deal_stage_history h ON h.deal_id = d.deal_id
            WHERE ${scope.sql}${period}
            GROUP BY d.deal_id)
         SELECT best, count(*)::int AS deals FROM best WHERE best >= 0 GROUP BY best`,
        params,
      );
    const reached = FLOW.map((_stage, index) =>
      rows
        .filter((row) => Number(row.best) >= index)
        .reduce((sum, row) => sum + row.deals, 0),
    );
    return FLOW.map((stage, index) => ({
      stage,
      label: DEAL_STAGE_LABELS[stage],
      reached: reached[index],
      conversionFromPrevious:
        index === 0 || reached[index - 1] === 0
          ? null
          : Math.round((reached[index] / reached[index - 1]) * 1000) / 10,
    }));
  }

  /** Рейтинг менеджеров по закрытым сделкам за период. */
  async managers(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<ManagerRankingRow[]> {
    const params: unknown[] = [user.organizationId];
    let period = '';
    if (from) {
      params.push(from);
      period += ` AND d.closed_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      period += ` AND d.closed_at < ($${params.length}::date + 1)`;
    }
    let who = 'true';
    if (!canSeeAll(user)) {
      params.push(user.userId);
      who = `u.user_id = $${params.length}`;
    }
    const rows: Array<{
      userId: number;
      fullName: string;
      won: number;
      lost: number;
      wonAmount: string;
      cycle: string | null;
      open: number;
      openAmount: string;
      overdue: number;
    }> = await this.dataSource.query(
      `SELECT u.user_id AS "userId", u.full_name AS "fullName",
              count(d.deal_id) FILTER (WHERE d.stage = 'won' ${period})::int AS won,
              count(d.deal_id) FILTER (WHERE d.stage = 'lost' ${period})::int AS lost,
              coalesce(sum(d.amount) FILTER (WHERE d.stage = 'won'
                AND d.currency = '${BASE_CURRENCY}' ${period}), 0) AS "wonAmount",
              avg(extract(epoch FROM (d.closed_at - d.created_at)) / 86400)
                FILTER (WHERE d.stage = 'won' ${period}) AS cycle,
              count(d.deal_id) FILTER (WHERE d.stage NOT IN ('won', 'lost'))::int AS open,
              coalesce(sum(d.amount) FILTER (WHERE d.stage NOT IN ('won', 'lost')
                AND d.currency = '${BASE_CURRENCY}'), 0) AS "openAmount",
              (SELECT count(*)::int FROM activities a
                WHERE a.owner_user_id = u.user_id AND a.organization_id = $1
                  AND a.status = 'planned' AND a.planned_at < now()) AS overdue
         FROM users u
         JOIN organization_members m
           ON m.user_id = u.user_id AND m.organization_id = $1
         LEFT JOIN deals d
           ON d.owner_user_id = u.user_id AND d.organization_id = $1
        WHERE ${who} AND u.is_active
        GROUP BY u.user_id, u.full_name
        ORDER BY "wonAmount" DESC, won DESC, u.full_name`,
      params,
    );
    return rows.map((row) => ({
      userId: row.userId,
      fullName: row.fullName,
      dealsWon: row.won,
      dealsLost: row.lost,
      wonAmount: Number(row.wonAmount),
      winRate:
        row.won + row.lost === 0
          ? null
          : Math.round((row.won / (row.won + row.lost)) * 1000) / 10,
      avgCycleDays:
        row.cycle === null ? null : Math.round(Number(row.cycle) * 10) / 10,
      openDeals: row.open,
      openAmount: Number(row.openAmount),
      overdueActivities: row.overdue,
    }));
  }
}
