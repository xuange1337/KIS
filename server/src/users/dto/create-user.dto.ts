import { UserRole } from '@crm/shared';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(3, 64)
  login: string;

  @IsString()
  @MinLength(6, { message: 'Пароль должен содержать не менее 6 символов' })
  password: string;

  @IsString()
  @Length(3, 160)
  fullName: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
