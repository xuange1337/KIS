import { ClientSource, ClientStatus } from '@crm/shared';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @Length(2, 255)
  name: string;

  @IsOptional()
  @Matches(/^(\d{10}|\d{12})$/, {
    message: 'ИНН должен содержать 10 цифр (организация) или 12 (ИП)',
  })
  inn?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  industry?: string | null;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @IsEnum(ClientSource)
  source?: ClientSource | null;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  address?: string | null;

  /** Смена ответственного доступна только руководителю и администратору. */
  @IsOptional()
  @IsInt()
  ownerUserId?: number | null;
}
