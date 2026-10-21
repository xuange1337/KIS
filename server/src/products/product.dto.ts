import { Currency } from '@crm/shared';
import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { MAX_MONEY_AMOUNT } from '../deals/dto/create-deal.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @Length(1, 64)
  sku: string;

  @Transform(trim)
  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 32)
  unit?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  price: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(Currency)
  currency?: Currency;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto, {
  skipNullProperties: false,
}) {
  @IsInt()
  @Min(1)
  version: number;
}

export class QueryProductsDto extends PaginationDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(Currency)
  currency?: Currency;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}
