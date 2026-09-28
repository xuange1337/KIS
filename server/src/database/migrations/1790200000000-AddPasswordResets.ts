import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Одноразовые ссылки для установки нового пароля.
 *
 * До них забывший пароль сотрудник получал новый пароль от
 * администратора голосом или в переписке: пароль знали двое, а в
 * мессенджере он оставался навсегда.
 */
export class AddPasswordResets1790200000000 implements MigrationInterface {
  name = 'AddPasswordResets1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_resets" (
        "password_reset_id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "token_hash" character(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "issued_by" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_password_resets" PRIMARY KEY ("password_reset_id"),
        CONSTRAINT "fk_password_resets_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("user_id") ON DELETE CASCADE,
        CONSTRAINT "fk_password_resets_issuer" FOREIGN KEY ("issued_by")
          REFERENCES "users"("user_id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_password_resets_token" ON "password_resets" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_resets_user" ON "password_resets" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "password_resets"`);
  }
}
