import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Повторяющиеся активности: правило повтора и необязательный предел серии.
 * У существующих активностей повтора нет.
 */
export class AddActivityRecurrence1791000000000 implements MigrationInterface {
  name = 'AddActivityRecurrence1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activities"
        ADD COLUMN "recurrence" character varying(16),
        ADD COLUMN "recurrence_until" TIMESTAMP WITH TIME ZONE,
        ADD CONSTRAINT "ck_activities_recurrence" CHECK (
          "recurrence" IS NULL OR "recurrence" IN ('daily', 'weekly', 'monthly')
        ),
        ADD CONSTRAINT "ck_activities_recurrence_until" CHECK (
          "recurrence_until" IS NULL OR "recurrence" IS NOT NULL
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activities"
        DROP CONSTRAINT "ck_activities_recurrence_until",
        DROP CONSTRAINT "ck_activities_recurrence",
        DROP COLUMN "recurrence_until",
        DROP COLUMN "recurrence"
    `);
  }
}
