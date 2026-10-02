import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Приглашения в организацию по одноразовой ссылке.
 *
 * Единственным способом завести сотрудника было придумать ему пароль и
 * продиктовать — пароль знали двое. По приглашению человек заводит себя
 * сам, администратор задаёт только роль.
 */
export class AddOrganizationInvitations1790400000000 implements MigrationInterface {
  name = 'AddOrganizationInvitations1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "organization_invitations" (
        "invitation_id" SERIAL NOT NULL,
        "organization_id" integer NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'manager',
        "token_hash" character(64) NOT NULL,
        "full_name" character varying(160),
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "invited_by" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_organization_invitations" PRIMARY KEY ("invitation_id"),
        CONSTRAINT "fk_invitations_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("organization_id") ON DELETE CASCADE,
        CONSTRAINT "fk_invitations_inviter" FOREIGN KEY ("invited_by")
          REFERENCES "users"("user_id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_invitations_token"
         ON "organization_invitations" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invitations_organization"
         ON "organization_invitations" ("organization_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "organization_invitations"`);
  }
}
