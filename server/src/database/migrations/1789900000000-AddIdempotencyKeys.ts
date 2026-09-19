import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ключи идемпотентности для операций создания.
 *
 * Клиент отправил запрос, ответ не дошёл из-за обрыва связи, клиент
 * повторил — и в базе появилась вторая сделка. Ключ позволяет повтору
 * вернуть результат первой попытки вместо создания дубликата.
 */
export class AddIdempotencyKeys1789900000000 implements MigrationInterface {
  name = 'AddIdempotencyKeys1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "idempotency_id" SERIAL NOT NULL,
        "idempotency_key" character varying(128) NOT NULL,
        "user_id" integer NOT NULL,
        "organization_id" integer NOT NULL,
        "endpoint" character varying(255) NOT NULL,
        "request_hash" character(64) NOT NULL,
        "status_code" integer,
        "response" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_idempotency_keys" PRIMARY KEY ("idempotency_id")
      )
    `);
    // Уникальность вставки — то, что делает повтор безопасным при гонке:
    // вторая попытка не создаёт запись, а натыкается на существующую
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_idempotency_user_key"
         ON "idempotency_keys" ("user_id", "idempotency_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_idempotency_created"
         ON "idempotency_keys" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
  }
}
