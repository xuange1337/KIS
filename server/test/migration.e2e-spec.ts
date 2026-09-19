import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { buildDataSourceOptions } from '../src/database/data-source';

/**
 * Обновление с предыдущей схемы.
 *
 * Обычный прогон тестов создаёт базу миграциями с нуля и потому не
 * проверяет главного: применятся ли миграции к базе, в которой уже есть
 * данные. Именно там ломается обновление production — на NOT NULL без
 * значения по умолчанию, на уникальном индексе поверх дубликатов, на
 * внешнем ключе к записям, которых нет.
 *
 * Тест накатывает схему по шагам, наполняя данными перед каждой
 * следующей миграцией, и проверяет, что данные пережили обновление.
 */
describe('Обновление схемы с предыдущей версии', () => {
  let dataSource: DataSource;
  const database = 'crm_migration_test';

  beforeAll(async () => {
    const options = buildDataSourceOptions() as PostgresConnectionOptions;
    const admin = new DataSource({ ...options, database: 'postgres' });
    await admin.initialize();
    try {
      await admin.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [database],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.query(`CREATE DATABASE "${database}"`);
    } finally {
      await admin.destroy();
    }

    dataSource = new DataSource({ ...options, database, migrationsRun: false });
    await dataSource.initialize();
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('применяет все миграции к базе с данными и сохраняет их', async () => {
    const pending = await dataSource.showMigrations();
    expect(pending).toBe(true);

    const runner = dataSource.createQueryRunner();
    await runner.connect();

    // Порядок в dataSource.migrations — порядок загрузки файлов, а не
    // порядок применения: сортируем по метке времени в имени, как это
    // делает сам TypeORM при прогоне
    const migrations = [...dataSource.migrations].sort(
      (left, right) =>
        Number(/\d+/.exec(left.name ?? '')?.[0] ?? 0) -
        Number(/\d+/.exec(right.name ?? '')?.[0] ?? 0),
    );
    expect(migrations.length).toBeGreaterThanOrEqual(4);

    // Схема до появления организаций: на ней и живёт существующий стенд
    const beforeOrganizations = migrations.filter(
      (migration) => !migration.name?.includes('AddOrganizations'),
    );
    const organizationsIndex = migrations.findIndex((migration) =>
      migration.name?.includes('AddOrganizations'),
    );
    expect(organizationsIndex).toBeGreaterThan(0);

    for (const migration of migrations.slice(0, organizationsIndex)) {
      await migration.up(runner);
    }
    expect(beforeOrganizations.length).toBeGreaterThan(0);

    // Данные в старой схеме: организации ещё нет
    await runner.query(
      `INSERT INTO users (login, password_hash, full_name, role)
         VALUES ('legacy-user', 'hash', 'Пользователь до обновления', 'manager')`,
    );
    await runner.query(
      `INSERT INTO clients (name, status, owner_user_id)
         VALUES ('ООО «До обновления»', 'lead',
                 (SELECT user_id FROM users WHERE login = 'legacy-user'))`,
    );
    await runner.query(
      `INSERT INTO deals (client_id, title, stage, amount, currency, probability, owner_user_id)
         VALUES ((SELECT client_id FROM clients WHERE name = 'ООО «До обновления»'),
                 'Сделка до обновления', 'new', 100000, 'RUB', 10,
                 (SELECT user_id FROM users WHERE login = 'legacy-user'))`,
    );

    // Оставшиеся миграции применяются уже к непустой базе
    for (const migration of migrations.slice(organizationsIndex)) {
      await migration.up(runner);
    }

    const [client] = await runner.query(
      `SELECT c.name, c.organization_id, c.version, o.name AS organization
         FROM clients c JOIN organizations o
           ON o.organization_id = c.organization_id
        WHERE c.name = 'ООО «До обновления»'`,
    );
    expect(client).toBeDefined();
    expect(client.organization_id).toBeGreaterThan(0);
    // Существующие записи считаются неизменявшимися
    expect(client.version).toBe(1);

    const [{ count: orphans }] = await runner.query(
      `SELECT count(*)::int AS count FROM deals WHERE organization_id IS NULL`,
    );
    expect(orphans).toBe(0);

    // Все записи ушли в одну организацию: разнести их по смыслу
    // миграция не может и не должна
    const [{ count: organizations }] = await runner.query(
      `SELECT count(*)::int AS count FROM organizations`,
    );
    expect(organizations).toBe(1);

    await runner.release();
  }, 120_000);

  it('откатывает последнюю миграцию и восстанавливается обратно', async () => {
    const runner = dataSource.createQueryRunner();
    await runner.connect();

    /**
     * Снимок схемы вместо проверки конкретной колонки: тест не должен
     * переписываться при каждой новой миграции — иначе он проверяет
     * не обратимость, а память автора о том, какая миграция последняя.
     */
    const snapshot = async (): Promise<string> => {
      const rows = await runner.query(
        `SELECT table_name, column_name FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, column_name`,
      );
      return JSON.stringify(rows);
    };

    const ordered = [...dataSource.migrations].sort(
      (left, right) =>
        Number(/\d+/.exec(left.name ?? '')?.[0] ?? 0) -
        Number(/\d+/.exec(right.name ?? '')?.[0] ?? 0),
    );
    const last = ordered[ordered.length - 1];

    const before = await snapshot();
    await last.down(runner);
    const afterDown = await snapshot();
    expect(afterDown).not.toBe(before);

    // Данные, к которым миграция отношения не имеет, не задеты
    const [{ count }] = await runner.query(
      `SELECT count(*)::int AS count FROM clients`,
    );
    expect(count).toBe(1);

    await last.up(runner);
    expect(await snapshot()).toBe(before);

    await runner.release();
  }, 120_000);
});
