import { HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/** Коды ошибок PostgreSQL, которым соответствует ошибка ввода, а не сбой. */
const USER_ERRORS: Record<string, { status: number; message: string }> = {
  '23503': {
    status: HttpStatus.CONFLICT,
    message:
      'Запись связана с другими данными и не может быть изменена или удалена',
  },
  '23505': {
    status: HttpStatus.CONFLICT,
    message: 'Запись с такими данными уже существует',
  },
  '23514': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Значение поля выходит за допустимые границы',
  },
  '22003': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Числовое значение слишком велико',
  },
  '22001': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Значение поля слишком длинное',
  },
};

/**
 * Переводит ошибку СУБД в ошибку ввода.
 *
 * Без этого нарушение ограничения БД (переполнение numeric, внешний ключ,
 * CHECK) отдавалось как «Внутренняя ошибка сервера», и пользователь не мог
 * понять, что именно во вводе неверно. Возвращает undefined, если код
 * неизвестен: такую ошибку нельзя показывать как ошибку ввода.
 */
export const describeDatabaseError = (
  error: QueryFailedError,
): { status: number; message: string } | undefined => {
  const code =
    (error as unknown as { code?: string }).code ??
    (error.driverError as { code?: string } | undefined)?.code;
  return code ? USER_ERRORS[code] : undefined;
};
