import { DealStage } from '@crm/shared';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ChangeStageDto {
  @IsEnum(DealStage)
  stage: DealStage;

  /** Комментарий к переходу, попадает в журнал действий. */
  @IsOptional()
  @IsString()
  comment?: string;
}
