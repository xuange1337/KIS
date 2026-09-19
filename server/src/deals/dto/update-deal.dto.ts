import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateDealDto } from './create-deal.dto';

/**
 * Стадия меняется отдельным маршрутом PATCH /deals/:id/stage,
 * чтобы каждый переход попадал в историю (ТЗ п. 1.2.3).
 *
 * Вероятность тоже исключена: она определяется стадией. Иначе её можно было
 * задать напрямую и получить, например, 90 % у проигранной сделки.
 */
export class UpdateDealDto extends PartialType(
  OmitType(CreateDealDto, ['clientId', 'stage', 'probability'] as const),
) {
  /** Версия записи; см. UpdateClientDto. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}
