import { BASE_CURRENCY, Currency } from '@crm/shared';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional } from 'class-validator';

/** Общие параметры всех отчётов: период и ответственный (ТЗ п. 2.5). */
export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  ownerUserId?: number;

  /**
   * Валюта денежных показателей. Курсы в прототипе не хранятся, поэтому
   * суммы разных валют не складываются: отчёт всегда считается по одной.
   */
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency = BASE_CURRENCY;
}

/** Отчёт «Динамика продаж» строится по неделям или месяцам. */
export class SalesDynamicsQueryDto extends ReportQueryDto {
  @IsOptional()
  @IsIn(['week', 'month'])
  granularity?: 'week' | 'month' = 'month';
}

/** Отчёт «ТОП» ранжирует либо клиентов, либо сделки. */
export class TopQueryDto extends ReportQueryDto {
  @IsOptional()
  @IsIn(['clients', 'deals'])
  entity?: 'clients' | 'deals' = 'clients';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  limit?: number = 10;
}
