import { ClientStatus } from '@crm/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  ValidateIf,
} from 'class-validator';

/** Что сделать с выбранными карточками. */
export enum BulkClientAction {
  ASSIGN_OWNER = 'assign-owner',
  SET_STATUS = 'set-status',
}

/** Предел одной операции: столько строк помещается на странице списка. */
export const BULK_MAX_ITEMS = 200;

export class BulkClientsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Выберите хотя бы одну карточку' })
  @ArrayMaxSize(BULK_MAX_ITEMS, {
    message: `За одну операцию можно изменить не более ${BULK_MAX_ITEMS} карточек`,
  })
  @Type(() => Number)
  @IsInt({ each: true })
  clientIds: number[];

  @IsEnum(BulkClientAction)
  action: BulkClientAction;

  /** Новый ответственный — для действия «назначить ответственного». */
  @ValidateIf(
    (dto: BulkClientsDto) => dto.action === BulkClientAction.ASSIGN_OWNER,
  )
  @IsInt()
  ownerUserId?: number;

  /** Новый статус — для действия «сменить статус». */
  @ValidateIf(
    (dto: BulkClientsDto) => dto.action === BulkClientAction.SET_STATUS,
  )
  @IsEnum(ClientStatus)
  status?: ClientStatus;
}
