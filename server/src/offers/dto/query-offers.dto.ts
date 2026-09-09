import { OfferStatus } from '@crm/shared';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryOffersDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  dealId?: number;
}
