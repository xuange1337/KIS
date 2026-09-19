import { MigrationInterface, QueryRunner } from 'typeorm';

/** Таблицы, получающие принадлежность к организации. */
const TENANT_TABLES = [
  'users',
  'clients',
  'contacts',
  'deals',
  'deal_stage_history',
  'activities',
  'commercial_offers',
];

/**
 * Введение организаций как границы изоляции данных.
 *
 * Существующие данные принадлежали одной безымянной базе. Миграция
 * заводит организацию по умолчанию, переносит в неё все записи и делает
 * принадлежность обязательной: после неё запись без организации создать
 * нельзя, а значит не может появиться и запись, видимая всем сразу.
 */
export class AddOrganizations1789700000000 implements MigrationInterface {
  name = 'AddOrganizations1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "organization_id" SERIAL NOT NULL,
        "name" character varying(255) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_organizations" PRIMARY KEY ("organization_id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_organizations_name" ON "organizations" ("name")`,
    );

    const inserted: { organization_id: number }[] = await queryRunner.query(
      `INSERT INTO "organizations" ("name") VALUES ($1) RETURNING "organization_id"`,
      ['Организация по умолчанию'],
    );
    const defaultOrganizationId = inserted[0].organization_id;

    // Колонка добавляется допускающей NULL, заполняется, и только затем
    // становится обязательной: на непустой таблице иначе не выполнится
    for (const table of TENANT_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "organization_id" integer`,
      );
      await queryRunner.query(`UPDATE "${table}" SET "organization_id" = $1`, [
        defaultOrganizationId,
      ]);
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "organization_id" SET NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "fk_${table}_organization"
           FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id")
           ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_${table}_organization" ON "${table}" ("organization_id")`,
      );
    }

    // Журнал: неудачный вход не относится ни к какой организации
    await queryRunner.query(
      `ALTER TABLE "audit_log" ADD COLUMN "organization_id" integer`,
    );
    await queryRunner.query(`UPDATE "audit_log" SET "organization_id" = $1`, [
      defaultOrganizationId,
    ]);
    await queryRunner.query(
      `ALTER TABLE "audit_log" ADD CONSTRAINT "fk_audit_log_organization"
         FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id")
         ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_log_organization" ON "audit_log" ("organization_id")`,
    );

    /**
     * Составные индексы под запросы со скоупом.
     *
     * Каждый список фильтруется сначала по организации, затем по
     * ответственному: без ведущего organization_id прежние индексы по
     * owner_user_id перестают попадать в запрос целиком.
     */
    await queryRunner.query(
      `CREATE INDEX "idx_clients_org_owner" ON "clients" ("organization_id", "owner_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_deals_org_stage" ON "deals" ("organization_id", "stage", "owner_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_activities_org_planned" ON "activities" ("organization_id", "planned_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_activities_org_planned"`);
    await queryRunner.query(`DROP INDEX "idx_deals_org_stage"`);
    await queryRunner.query(`DROP INDEX "idx_clients_org_owner"`);

    for (const table of [...TENANT_TABLES, 'audit_log']) {
      await queryRunner.query(`DROP INDEX "idx_${table}_organization"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "fk_${table}_organization"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "organization_id"`,
      );
    }

    await queryRunner.query(`DROP INDEX "idx_organizations_name"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
  }
}
