import { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL возвращает numeric строкой, чтобы не терять точность.
 * Для сумм сделок и КП точности double достаточно, поэтому приводим к number,
 * иначе арифметика на клиенте и в отчётах даёт склейку строк.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};
