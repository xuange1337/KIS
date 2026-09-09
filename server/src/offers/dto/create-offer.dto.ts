import { OfferStatus } from '@crm/shared';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { MAX_MONEY_AMOUNT } from '../../deals/dto/create-deal.dto';

export class CreateOfferDto {
  @IsInt()
  dealId: number;

  @IsString()
  @Length(1, 64)
  number: string;

  @IsDateString({}, { message: 'Некорректная дата предложения' })
  date: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT, { message: 'Сумма предложения слишком велика' })
  totalAmount: number;

  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @IsOptional()
  @IsString()
  fileRef?: string | null;
}
