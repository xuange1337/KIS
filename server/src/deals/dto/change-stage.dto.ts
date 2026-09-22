import { DealLossReason, DealStage } from '@crm/shared';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class ChangeStageDto {
  @IsEnum(DealStage)
  stage: DealStage;

  /**
   * Причина проигрыша. Обязательна при переходе на «проиграна» —
   * проверяется в сервисе, потому что зависит от стадии.
   */
  @IsOptional()
  @IsEnum(DealLossReason)
  lossReason?: DealLossReason;

  /** Пояснение к причине; обязательно, если причина «другое». */
  @IsOptional()
  @IsString()
  @Length(0, 500)
  lossComment?: string;

  /** Комментарий к переходу, попадает в журнал действий. */
  @IsOptional()
  @IsString()
  comment?: string;
}
