import { DealStage } from '@crm/shared';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreatePipelineDto {
  @IsString()
  @Length(1, 80)
  name: string;

  /** Рабочие стадии по порядку; «Выиграна» и «Проиграна» добавляются сами. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsEnum(DealStage, { each: true })
  stages: DealStage[];
}

export class UpdatePipelineDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsEnum(DealStage, { each: true })
  stages?: DealStage[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
