import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Участие пользователя в организации отдельной таблицей.
 *
 * Пока организация и роль лежали в самой учётной записи, человек мог
 * состоять ровно в одной организации. Для партнёра, ведущего несколько
 * заказчиков, и для самостоятельного подключения этого недостаточно:
 * заводящий организацию становится в ней администратором, оставаясь
 * рядовым сотрудником в своей.
 *
 * Данные переносятся один в один: у каждого существующего пользователя
 * появляется ровно одно участие с прежней организацией и прежней
 * ролью, поэтому поведение системы не меняется.
 */
export class AddOrganizationMembers1790300000000 implements MigrationInterface {
  name = 'AddOrganizationMembers1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "organization_members" (
        "membership_id" SERIAL NOT NULL,
        "organization_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'manager',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_organization_members" PRIMARY KEY ("membership_id"),
        CONSTRAINT "fk_members_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("organization_id") ON DELETE CASCADE,
        CONSTRAINT "fk_members_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("user_id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_members_organization_user"
         ON "organization_members" ("organization_id", "user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_members_organization" ON "organization_members" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_members_user" ON "organization_members" ("user_id")`,
    );

    await queryRunner.query(`
      INSERT INTO "organization_members" ("organization_id", "user_id", "role")
      SELECT "organization_id", "user_id", "role" FROM "users"
    `);

    /**
     * Сессия привязывается к организации.
     *
     * У пользователя их может быть несколько, и «текущая организация» —
     * свойство сеанса, а не учётной записи: в двух вкладках можно
     * работать с разными заказчиками.
     */
    await queryRunner.query(
      `ALTER TABLE "refresh_sessions" ADD COLUMN "organization_id" integer`,
    );
    await queryRunner.query(`
      UPDATE "refresh_sessions" s
         SET "organization_id" = u."organization_id"
        FROM "users" u
       WHERE u."user_id" = s."user_id"
    `);
    // Сессии без организации не остаётся: столбец заполнен для всех
    await queryRunner.query(
      `DELETE FROM "refresh_sessions" WHERE "organization_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_sessions" ALTER COLUMN "organization_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_sessions" ADD CONSTRAINT "fk_refresh_sessions_organization"
         FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id")
         ON DELETE CASCADE`,
    );

    // Прежние колонки учётной записи больше не источник истины
    await queryRunner.query(`DROP INDEX "idx_users_organization"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "fk_users_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "organization_id"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "role" "public"."users_role_enum" NOT NULL DEFAULT 'manager'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "organization_id" integer`,
    );
    // Возвращается первое по времени участие: до разделения у
    // пользователя могла быть только одна организация
    await queryRunner.query(`
      UPDATE "users" u
         SET "organization_id" = m."organization_id", "role" = m."role"
        FROM (
          SELECT DISTINCT ON ("user_id") "user_id", "organization_id", "role"
            FROM "organization_members" ORDER BY "user_id", "membership_id"
        ) m
       WHERE m."user_id" = u."user_id"
    `);
    await queryRunner.query(
      `DELETE FROM "users" WHERE "organization_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "organization_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "fk_users_organization"
         FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id")
         ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_organization" ON "users" ("organization_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "refresh_sessions" DROP CONSTRAINT "fk_refresh_sessions_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_sessions" DROP COLUMN "organization_id"`,
    );
    await queryRunner.query(`DROP TABLE "organization_members"`);
  }
}
