import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { OfferItemInputDto } from '../../offers/dto/replace-offer-items.dto';

/** Те же поля, что у позиции КП: позиция сделки собирается из каталога так же. */
export class ReplaceDealItemsDto {
  @IsInt()
  @Min(1)
  version: number;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OfferItemInputDto)
  items: OfferItemInputDto[];
}
