import { ClientSource, ClientStatus } from '@crm/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** Фильтры списка клиентов (ТЗ п. 2.5 — «Клиенты: список + фильтры»). */
export class QueryClientsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @IsEnum(ClientSource)
  source?: ClientSource;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  ownerUserId?: number;

  /** Только отмеченные звёздочкой. */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  favorite?: boolean;
}
