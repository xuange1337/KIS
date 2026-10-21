import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateOfferDto } from './create-offer.dto';
import { IsInt, Min, ValidateIf } from 'class-validator';

export class UpdateOfferDto extends PartialType(
  OmitType(CreateOfferDto, ['dealId'] as const),
  { skipNullProperties: false },
) {
  /** Необязательно только для совместимости старых API-клиентов. */
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  version?: number;
}
