import { IsString, Length, MinLength } from 'class-validator';

/** Минимальная длина пароля: та же, что при заведении пользователя. */
export const MIN_PASSWORD_LENGTH = 6;

export class ChangePasswordDto {
  /**
   * Текущий пароль.
   *
   * Спрашивается даже у вошедшего: у оставленного без присмотра
   * компьютера смена пароля — это захват учётной записи, после которого
   * владелец в неё уже не войдёт.
   */
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `Пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов`,
  })
  newPassword: string;
}

export class ResetPasswordDto {
  @IsString()
  @Length(32, 128)
  token: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `Пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов`,
  })
  newPassword: string;
}
