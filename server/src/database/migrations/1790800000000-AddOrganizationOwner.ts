import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Владелец организации и срок хранения закрытой организации.
 *
 * Владелец — единственный, кто закрывает организацию и передаёт
 * владение. Для существующих организаций им становится самый ранний
 * администратор: иначе закрыть их было бы некому.
 */
export class AddOrganizationOwner1790800000000 implements MigrationInterface {
  name = 'AddOrganizationOwner1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
        ADD COLUMN "owner_user_id" integer,
        ADD COLUMN "closed_at" TIMESTAMP WITH TIME ZONE,
        ADD CONSTRAINT "fk_organizations_owner" FOREIGN KEY ("owner_user_id")
          REFERENCES "users"("user_id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      UPDATE "organizations" o SET "owner_user_id" = (
        SELECT m."user_id" FROM "organization_members" m
         WHERE m."organization_id" = o."organization_id"
           AND m."role" = 'admin'
         ORDER BY m."membership_id" ASC LIMIT 1
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
        DROP CONSTRAINT "fk_organizations_owner",
        DROP COLUMN "closed_at",
        DROP COLUMN "owner_user_id"
    `);
  }
}
