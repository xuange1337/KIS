import { DealStage } from '@crm/shared';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** Фильтры списка сделок (ТЗ п. 2.5 — «Сделки: список, стадия/статус, поиск»). */
export class QueryDealsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(DealStage)
  stage?: DealStage;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  clientId?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  ownerUserId?: number;

  /** Период по плановой дате закрытия. */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  amountFrom?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  amountTo?: number;
}
