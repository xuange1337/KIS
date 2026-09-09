import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1, { message: 'Укажите логин' })
  login: string;

  @IsString()
  @MinLength(1, { message: 'Укажите пароль' })
  password: string;
}
