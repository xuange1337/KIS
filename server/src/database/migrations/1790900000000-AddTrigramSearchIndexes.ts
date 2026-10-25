import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Индексы под подстрочный поиск.
 *
 * Поиск по всем разделам и фильтры списков ищут `ILIKE '%текст%'`.
 * Обычный индекс по такому шаблону не работает: на каждый запрос
 * читалась вся таблица, и время поиска росло вместе с данными
 * заказчика. Триграммный GIN-индекс обслуживает именно подстроку и
 * регистронезависимый поиск, а запросы приложения менять не нужно.
 *
 * pg_trgm входит в стандартную поставку PostgreSQL и в управляемых
 * сервисах считается доверенным расширением.
 */
const INDEXES: Array<[name: string, table: string, column: string]> = [
  ['idx_clients_name_trgm', 'clients', 'name'],
  ['idx_clients_inn_trgm', 'clients', 'inn'],
  ['idx_deals_title_trgm', 'deals', 'title'],
  ['idx_activities_subject_trgm', 'activities', 'subject'],
  ['idx_offers_number_trgm', 'commercial_offers', 'number'],
  ['idx_products_name_trgm', 'products', 'name'],
  ['idx_products_sku_trgm', 'products', 'sku'],
];

export class AddTrigramSearchIndexes1790900000000 implements MigrationInterface {
  name = 'AddTrigramSearchIndexes1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    for (const [name, table, column] of INDEXES) {
      await queryRunner.query(
        `CREATE INDEX "${name}" ON "${table}" USING gin ("${column}" gin_trgm_ops)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [name] of INDEXES) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${name}"`);
    }
    // Расширение остаётся: им могут пользоваться другие объекты базы
  }
}
