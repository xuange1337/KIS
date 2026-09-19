import { Paginated } from '@crm/shared';
import { SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from '../dto/pagination.dto';

/**
 * Применяет сортировку и постраничную выборку к готовому QueryBuilder
 * и возвращает ответ в общем формате { items, total, page, limit }.
 *
 * @param alias       алиас корневой сущности в запросе
 * @param sortable    белый список полей, по которым разрешена сортировка;
 *                    первое значение используется как сортировка по умолчанию
 */
export async function paginate<T extends object>(
  qb: SelectQueryBuilder<T>,
  query: PaginationDto,
  alias: string,
  sortable: string[],
): Promise<Paginated<T>> {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? query.limit : 25;

  // Поле сортировки подставляется в SQL, поэтому берётся только из белого списка
  const sort =
    query.sort && sortable.includes(query.sort) ? query.sort : sortable[0];
  const order = query.order === 'ASC' ? 'ASC' : 'DESC';

  qb.orderBy(`${alias}.${sort}`, order);

  /**
   * Вторичная сортировка по первичному ключу.
   *
   * PostgreSQL не гарантирует порядок строк с одинаковым значением ключа
   * сортировки, и порядок действительно меняется от запроса к запросу
   * (другой план, другой параллельный проход). При постраничном выводе это
   * значит, что запись с распространённым значением — например, сделки в
   * одной стадии или клиенты одного статуса — попадала и на первую, и на
   * вторую страницу, а какая-то другая не попадала никуда. Ключ уникален,
   * поэтому добавление его в ORDER BY делает порядок устойчивым.
   */
  const primaryKey = qb.expressionMap.mainAlias?.metadata.primaryColumns[0];
  if (primaryKey && primaryKey.propertyName !== sort) {
    qb.addOrderBy(`${alias}.${primaryKey.propertyName}`, order);
  }

  qb.skip((page - 1) * limit).take(limit);

  const [items, total] = await qb.getManyAndCount();
  return { items, total, page, limit };
}
