import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateOfferDto } from './create-offer.dto';

export class UpdateOfferDto extends PartialType(
  OmitType(CreateOfferDto, ['dealId'] as const),
) {}
