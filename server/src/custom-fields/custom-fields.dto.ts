import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export const FIELD_ENTITIES = ['client', 'deal'] as const;
export const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'boolean',
  'select',
] as const;

export class QueryFieldsDto {
  @IsIn(FIELD_ENTITIES)
  entity: 'client' | 'deal';
}

export class CreateFieldDto extends QueryFieldsDto {
  @IsString()
  @Length(1, 80)
  name: string;

  @IsIn(FIELD_TYPES)
  type: (typeof FIELD_TYPES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  @Type(() => String)
  options?: string[];
}

export class UpdateFieldDto {
  @IsString()
  @Length(1, 80)
  name: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  options?: string[];
}
