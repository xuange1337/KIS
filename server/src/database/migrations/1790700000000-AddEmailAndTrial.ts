import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Почта учётных записей, подтверждение адреса и состояние организации.
 *
 * Вход остаётся по логину; адрес нужен для писем: приглашений,
 * восстановления пароля, уведомлений об окончании пробного периода.
 *
 * Уникальность адреса — только среди подтверждённых. Иначе достаточно
 * зарегистрироваться с чужим адресом, не подтверждая его, чтобы
 * владелец не смог им воспользоваться.
 *
 * Существующие организации получают состояние `active`: пробный период
 * вводится для новых регистраций и не должен отключать действующих.
 */
export class AddEmailAndTrial1790700000000 implements MigrationInterface {
  name = 'AddEmailAndTrial1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "email" character varying(254),
        ADD COLUMN "email_verified_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "terms_accepted_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_users_email_verified"
        ON "users" (lower("email"))
        WHERE "email_verified_at" IS NOT NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_users_email" ON "users" (lower("email"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "email_verifications" (
        "verification_id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "email" character varying(254) NOT NULL,
        "token_hash" character(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_email_verifications" PRIMARY KEY ("verification_id"),
        CONSTRAINT "fk_email_verifications_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("user_id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_email_verifications_token"
         ON "email_verifications" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_email_verifications_user"
         ON "email_verifications" ("user_id")`,
    );

    // Название организации перестаёт быть уникальным: две компании с
    // одинаковым названием — обычное дело, а отказ в регистрации по
    // этой причине ещё и раскрывал бы состав клиентов сервиса
    await queryRunner.query(`DROP INDEX "idx_organizations_name"`);
    await queryRunner.query(
      `CREATE INDEX "idx_organizations_name" ON "organizations" ("name")`,
    );
    await queryRunner.query(`
      ALTER TABLE "organizations"
        ADD COLUMN "status" character varying(16) NOT NULL DEFAULT 'active',
        ADD COLUMN "trial_ends_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "trial_notified_days" smallint,
        ADD CONSTRAINT "ck_organizations_status" CHECK (
          "status" IN ('trial', 'active', 'past_due', 'suspended', 'closed')
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
        DROP CONSTRAINT "ck_organizations_status",
        DROP COLUMN "trial_notified_days",
        DROP COLUMN "trial_ends_at",
        DROP COLUMN "status"
    `);
    await queryRunner.query(`DROP INDEX "idx_organizations_name"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_organizations_name" ON "organizations" ("name")`,
    );
    await queryRunner.query(`DROP TABLE "email_verifications"`);
    await queryRunner.query(`DROP INDEX "idx_users_email"`);
    await queryRunner.query(`DROP INDEX "idx_users_email_verified"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "terms_accepted_at",
        DROP COLUMN "email_verified_at",
        DROP COLUMN "email"
    `);
  }
}
