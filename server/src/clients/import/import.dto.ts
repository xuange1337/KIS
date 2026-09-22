import { ClientSource, ClientStatus } from '@crm/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { MAX_IMPORT_ROWS } from './import-parser';

/** Одна строка, отобранная пользователем к загрузке. */
export class ImportRowDto {
  @IsInt()
  line: number;

  @IsString()
  @Length(2, 255)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 12)
  inn?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  industry?: string | null;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus | null;

  @IsOptional()
  @IsEnum(ClientSource)
  source?: ClientSource | null;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  address?: string | null;
}

export class ImportClientsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Нет строк для загрузки' })
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows: ImportRowDto[];
}
