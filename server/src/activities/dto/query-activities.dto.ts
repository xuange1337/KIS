import { ActivityStatus, ActivityType } from '@crm/shared';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** Фильтры списка и календаря активностей. */
export class QueryActivitiesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  clientId?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  dealId?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  ownerUserId?: number;

  /** Диапазон планируемых дат — основа выборки для календаря. */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
