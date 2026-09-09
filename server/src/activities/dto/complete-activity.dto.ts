import { IsOptional, IsString, Length } from 'class-validator';

/** Отметка о выполнении активности с фиксацией результата (ТЗ п. 1.2.4). */
export class CompleteActivityDto {
  @IsString()
  @Length(1, 2000, { message: 'Укажите результат активности' })
  result: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
