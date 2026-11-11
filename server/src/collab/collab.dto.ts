import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export const RECORD_TYPES = ['client', 'deal'] as const;

export class QueryRecordDto {
  @IsIn(RECORD_TYPES)
  entityType: 'client' | 'deal';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  entityId: number;
}

export class CreateCommentDto extends QueryRecordDto {
  @IsString()
  @Length(1, 2000)
  body: string;
}

export class CreateChecklistItemDto extends QueryRecordDto {
  @IsString()
  @Length(1, 255)
  text: string;
}

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  text?: string;

  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}
