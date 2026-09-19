import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateClientDto } from './create-client.dto';

export class UpdateClientDto extends PartialType(CreateClientDto) {
  /**
   * Версия записи, полученная вместе с карточкой.
   *
   * Поле необязательное: без него сохранение работает как прежде, и
   * существующие интеграции не ломаются. Если версия передана и не
   * совпала — карточку успели изменить, и правка отклоняется.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}
