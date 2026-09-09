import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Базовые параметры любого списка: страница, размер, сортировка, поиск.
 * Наследуется фильтрами клиентов, сделок, активностей и КП —
 * логика разбора живёт в одном месте (paginate()).
 */
export class PaginationDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 25;

  /** Имя поля сущности для сортировки, валидируется в сервисе по белому списку. */
  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @Transform(({ value }) => String(value).toUpperCase())
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'DESC';

  /** Строка полнотекстового поиска. */
  @IsOptional()
  @IsString()
  q?: string;
}
