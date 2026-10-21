import { UserRole } from '@crm/shared';
import {
  IsEmail,
  IsInt,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class RenameOrganizationDto {
  @IsString()
  @Length(2, 255)
  name: string;
}

export class CreateInvitationDto {
  @IsEnum(UserRole)
  role: UserRole;

  /** Подсказка администратору, кому выдана ссылка. */
  @IsOptional()
  @IsString()
  @Length(0, 160)
  fullName?: string;

  /** Если указан и почта настроена, ссылка уходит письмом. */
  @IsOptional()
  @IsEmail({}, { message: 'Некорректный адрес электронной почты' })
  @Length(0, 254)
  email?: string;
}

export class AcceptInvitationDto {
  @IsString()
  @Length(32, 128)
  token: string;

  @IsString()
  @Length(3, 64)
  login: string;

  @IsString()
  @MinLength(6, {
    message: 'Пароль должен содержать не менее 6 символов',
  })
  password: string;

  @IsString()
  @Length(3, 160)
  fullName: string;
}

export class JoinByInvitationDto {
  @IsString()
  @Length(32, 128)
  token: string;
}

export class SetMemberRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

export class TransferOwnershipDto {
  @IsInt()
  userId: number;

  /** Пароль владельца: передача необратима без согласия нового владельца. */
  @IsString()
  @Length(1, 255)
  password: string;
}

export class CloseOrganizationDto {
  @IsString()
  @Length(1, 255)
  password: string;

  /** Название организации, набранное вручную. */
  @IsString()
  @Length(1, 255)
  confirmName: string;
}
