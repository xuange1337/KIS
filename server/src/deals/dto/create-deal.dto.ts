import { Currency, DealStage } from '@crm/shared';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

/**
 * Предел суммы задан типом колонки numeric(14,2): большее значение
 * не помещается в БД и раньше роняло запрос с ошибкой 500 вместо
 * понятного сообщения о некорректном вводе.
 */
export const MAX_MONEY_AMOUNT = 999_999_999_999.99;

export class CreateDealDto {
  /** Воронка; без неё сделка попадает в основную. */
  @IsOptional()
  @IsInt()
  pipelineId?: number;

  /** Значения пользовательских полей: идентификатор поля → значение. */
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @IsInt()
  clientId: number;

  @IsString()
  @Length(2, 255)
  title: string;

  @IsOptional()
  @IsEnum(DealStage)
  stage?: DealStage;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT, { message: 'Сумма сделки слишком велика' })
  amount: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Некорректная плановая дата закрытия' })
  plannedClose?: string | null;

  @IsOptional()
  @IsInt()
  ownerUserId?: number | null;
}
