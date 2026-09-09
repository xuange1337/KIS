import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { buildDataSourceOptions } from '../src/database/data-source';
import { seed } from '../src/database/seeds/seed';

/**
 * Подготовка изолированной базы для e2e-тестов.
 *
 * Тесты создают, изменяют и удаляют записи, поэтому работать в одной базе
 * с приложением нельзя: незавершённый прогон оставлял бы мусор, который
 * искажает отчёты и скриншоты. База пересоздаётся перед каждым прогоном,
 * что заодно делает тесты независимыми от порядка выполнения.
 */
export default async function globalSetup(): Promise<void> {
  // Конфигурация заведомо postgres-овая; уточнение типа нужно, чтобы
  // спред не упирался в объединение вариантов всех драйверов TypeORM
  const options = buildDataSourceOptions() as PostgresConnectionOptions;
  const testDatabase = String(options.database);

  if (!testDatabase.endsWith('_test')) {
    throw new Error(
      `Тесты должны работать с базой, имя которой оканчивается на _test, ` +
        `а получено «${testDatabase}». Запустите: POSTGRES_DB=crm_test npm run test:e2e`,
    );
  }

  // Подключение к служебной базе: удалить и создать целевую можно
  // только не будучи к ней подключённым
  const admin = new DataSource({ ...options, database: 'postgres' });
  await admin.initialize();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDatabase],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${testDatabase}"`);
    await admin.query(`CREATE DATABASE "${testDatabase}"`);
  } finally {
    await admin.destroy();
  }

  const target = new DataSource({ ...options, migrationsRun: false });
  await target.initialize();
  try {
    await target.runMigrations();
    await seed(target, true);
  } finally {
    await target.destroy();
  }
}
