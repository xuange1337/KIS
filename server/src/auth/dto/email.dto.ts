import {
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import { MIN_PASSWORD_LENGTH } from './password.dto';

const EMAIL_MESSAGE = 'Некорректный адрес электронной почты';

export class SetEmailDto {
  @IsEmail({}, { message: EMAIL_MESSAGE })
  @Length(3, 254)
  email: string;
}

export class VerifyEmailDto {
  @IsString()
  @Length(32, 128)
  token: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: EMAIL_MESSAGE })
  @Length(3, 254)
  email: string;
}

export class RegisterDto {
  @IsString()
  @Length(2, 255, { message: 'Название организации: от 2 до 255 символов' })
  organizationName: string;

  @IsString()
  @Length(3, 160, { message: 'Укажите имя и фамилию' })
  fullName: string;

  @IsString()
  @Length(3, 64, { message: 'Логин: от 3 до 64 символов' })
  login: string;

  @IsEmail({}, { message: EMAIL_MESSAGE })
  @Length(3, 254)
  email: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `Пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов`,
  })
  password: string;

  /** Принятие пользовательского соглашения: без него регистрация невозможна. */
  @IsBoolean()
  @Equals(true, { message: 'Необходимо принять условия использования' })
  acceptTerms: boolean;
}
