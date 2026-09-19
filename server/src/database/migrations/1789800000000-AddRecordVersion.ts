import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Версия записи для клиентов и сделок.
 *
 * Карточки клиента и сделки правят несколько человек одновременно —
 * это основной сценарий отдела продаж. До сих пор второе сохранение
 * молча затирало первое: обе операции отвечали 200, и потерю правки
 * нельзя было ни заметить, ни восстановить.
 *
 * Существующим строкам проставляется версия 1: они считаются никогда
 * не изменявшимися, и первая же правка поднимет версию.
 */
export class AddRecordVersion1789800000000 implements MigrationInterface {
  name = 'AddRecordVersion1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['clients', 'deals']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "version" integer NOT NULL DEFAULT 1`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['clients', 'deals']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "version"`);
    }
  }
}
