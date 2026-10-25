import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from './setup';

/**
 * Подстрочный поиск должен идти по индексу.
 *
 * Тест не меряет секунды (они зависят от машины), а проверяет план:
 * при большой таблице планировщик выбирает триграммный индекс, а не
 * последовательное чтение. Если кто-то поменяет запрос так, что индекс
 * перестанет подходить, тест это покажет.
 */
describe('Индексы поиска', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let organizationId: number;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    const [org] = await dataSource.query(
      `INSERT INTO organizations (name) VALUES ('Нагрузка поиска') RETURNING organization_id`,
    );
    organizationId = org.organization_id;
    await dataSource.query(
      `INSERT INTO clients (name, inn, status, organization_id)
       SELECT 'Клиент ' || md5(g::text) || ' ' || g,
              lpad(g::text, 10, '0'), 'lead', $1
         FROM generate_series(1, 40000) g`,
      [organizationId],
    );
    await dataSource.query(`ANALYZE clients`);
  }, 120_000);

  afterAll(async () => {
    await dataSource.query(`DELETE FROM clients WHERE organization_id = $1`, [
      organizationId,
    ]);
    await dataSource.query(
      `DELETE FROM organizations WHERE organization_id = $1`,
      [organizationId],
    );
    await app.close();
  });

  const plan = async (sql: string, params: unknown[]): Promise<string> => {
    const rows = await dataSource.query(`EXPLAIN ${sql}`, params);
    return rows
      .map((row: Record<string, string>) => row['QUERY PLAN'])
      .join('\n');
  };

  it('имя клиента ищется по триграммному индексу', async () => {
    const result = await plan(
      `SELECT client_id FROM clients WHERE name ILIKE $1`,
      ['%a1b2c3d4e5%'],
    );
    expect(result).toContain('idx_clients_name_trgm');
  });

  it('ИНН может искаться по триграммному индексу', async () => {
    // Цифры почти не различаются триграммами, и на небольшой таблице
    // планировщик честно выберет чтение таблицы. Проверяется, что индекс
    // подходит запросу, а не что планировщик всегда его выберет.
    const runner = dataSource.createQueryRunner();
    try {
      await runner.query('SET enable_seqscan = off');
      const rows = await runner.query(
        `EXPLAIN SELECT client_id FROM clients WHERE inn ILIKE $1`,
        ['%0000012345%'],
      );
      expect(JSON.stringify(rows)).toContain('idx_clients_inn_trgm');
    } finally {
      await runner.query('RESET enable_seqscan');
      await runner.release();
    }
  });

  it('индекс находит подстроку без учёта регистра', async () => {
    const rows = await dataSource.query(
      `SELECT count(*)::int AS count FROM clients
        WHERE organization_id = $1 AND name ILIKE $2`,
      [organizationId, '%КЛИЕНТ%'],
    );
    expect(rows[0].count).toBe(40000);
  });
});
