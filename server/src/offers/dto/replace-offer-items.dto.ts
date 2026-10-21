import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MAX_MONEY_AMOUNT } from '../../deals/dto/create-deal.dto';

export class OfferItemInputDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  itemId?: number;

  @IsInt()
  @Min(1)
  productId: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1000000)
  quantity: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  unitPrice?: number;
}

export class ReplaceOfferItemsDto {
  @IsInt()
  @Min(1)
  version: number;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OfferItemInputDto)
  items: OfferItemInputDto[];
}
