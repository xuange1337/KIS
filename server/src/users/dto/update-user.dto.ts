import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/** Пароль в обновлении необязателен: пустое поле оставляет прежний. */
export class UpdateUserDto extends PartialType(CreateUserDto) {}
