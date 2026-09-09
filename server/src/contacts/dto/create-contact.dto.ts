import { PreferredChannel } from '@crm/shared';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateContactDto {
  @IsInt()
  clientId: number;

  @IsString()
  @Length(2, 160)
  fullName: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  position?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 32)
  phone?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'Некорректный адрес электронной почты' })
  email?: string | null;

  @IsOptional()
  @IsEnum(PreferredChannel)
  preferredChannel?: PreferredChannel | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
