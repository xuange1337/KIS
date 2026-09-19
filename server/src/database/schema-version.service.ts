import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Проверка соответствия схемы коду при старте.
 *
 * Код и схема выкатываются разными шагами, и порядок иногда нарушается:
 * контейнер с новым кодом поднимается на старой базе. Приложение при этом
 * стартует и отвечает 200, а падать начинает на конкретных запросах —
 * «нет колонки organization_id» в середине рабочего дня, уже с частично
 * записанными данными. Лучше не стартовать вовсе: оркестратор увидит
 * упавший контейнер и не переключит на него трафик.
 *
 * Проверку можно отключить (SCHEMA_CHECK=false) — например, чтобы
 * подняться и выполнить миграции руками после неудачного обновления.
 */
@Injectable()
export class SchemaVersionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaVersionService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SCHEMA_CHECK === 'false') {
      this.logger.warn('Проверка версии схемы отключена (SCHEMA_CHECK=false)');
      return;
    }

    const pending = await this.dataSource.showMigrations();
    if (pending) {
      throw new Error(
        'Схема базы данных старше кода: есть непримененные миграции. ' +
          'Выполните «npm run migration:run -w @crm/server» ' +
          '(в контейнере миграции применяются автоматически при старте) ' +
          'или временно снимите проверку переменной SCHEMA_CHECK=false.',
      );
    }

    const applied = await this.dataSource.query(
      `SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1`,
    );
    this.logger.log(
      `Схема актуальна, последняя миграция: ${applied[0]?.name ?? 'нет'}`,
    );
  }
}
