import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshSessions1789527600000 implements MigrationInterface {
  name = 'AddRefreshSessions1789527600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_sessions" (
        "session_id" uuid NOT NULL,
        "user_id" integer NOT NULL,
        "token_hash" char(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_used_at" timestamptz NOT NULL,
        CONSTRAINT "pk_refresh_sessions" PRIMARY KEY ("session_id"),
        CONSTRAINT "fk_refresh_sessions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("user_id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_sessions_user" ON "refresh_sessions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_sessions_expires" ON "refresh_sessions" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_sessions"`);
  }
}
