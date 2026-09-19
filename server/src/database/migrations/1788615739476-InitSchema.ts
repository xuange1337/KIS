import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1788615739476 implements MigrationInterface {
  name = 'InitSchema1788615739476';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('manager', 'head', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("user_id" SERIAL NOT NULL, "login" character varying(64) NOT NULL, "password_hash" character varying(255) NOT NULL, "full_name" character varying(160) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'manager', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2d443082eccd5198f95f2a36e2c" UNIQUE ("login"), CONSTRAINT "PK_96aac72f1574b88752e9fb00089" PRIMARY KEY ("user_id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_login" ON "users" ("login") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."contacts_preferred_channel_enum" AS ENUM('phone', 'email', 'messenger')`,
    );
    await queryRunner.query(
      `CREATE TABLE "contacts" ("contact_id" SERIAL NOT NULL, "client_id" integer NOT NULL, "full_name" character varying(160) NOT NULL, "position" character varying(120), "phone" character varying(32), "email" character varying(160), "preferred_channel" "public"."contacts_preferred_channel_enum", "notes" text, CONSTRAINT "PK_b85c417d6af2e06ff6ba8c8234d" PRIMARY KEY ("contact_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_contacts_client" ON "contacts" ("client_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."deal_stage_history_from_stage_enum" AS ENUM('new', 'qualification', 'proposal', 'negotiation', 'won', 'lost')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."deal_stage_history_to_stage_enum" AS ENUM('new', 'qualification', 'proposal', 'negotiation', 'won', 'lost')`,
    );
    await queryRunner.query(
      `CREATE TABLE "deal_stage_history" ("id" SERIAL NOT NULL, "deal_id" integer NOT NULL, "from_stage" "public"."deal_stage_history_from_stage_enum", "to_stage" "public"."deal_stage_history_to_stage_enum" NOT NULL, "changed_by" integer, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_92a1807e6b5c2694b06a430f77d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stage_history_deal" ON "deal_stage_history" ("deal_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."deals_stage_enum" AS ENUM('new', 'qualification', 'proposal', 'negotiation', 'won', 'lost')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."deals_currency_enum" AS ENUM('RUB', 'USD', 'EUR')`,
    );
    await queryRunner.query(
      `CREATE TABLE "deals" ("deal_id" SERIAL NOT NULL, "client_id" integer NOT NULL, "title" character varying(255) NOT NULL, "stage" "public"."deals_stage_enum" NOT NULL DEFAULT 'new', "amount" numeric(14,2) NOT NULL DEFAULT '0', "currency" "public"."deals_currency_enum" NOT NULL DEFAULT 'RUB', "probability" smallint NOT NULL DEFAULT '0', "planned_close" date, "owner_user_id" integer, "closed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_573b867184b86b67976b5b6b190" PRIMARY KEY ("deal_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_deals_closed_at" ON "deals" ("closed_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_deals_stage_owner" ON "deals" ("stage", "owner_user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."activities_type_enum" AS ENUM('call', 'meeting', 'email')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."activities_status_enum" AS ENUM('planned', 'done', 'canceled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "activities" ("activity_id" SERIAL NOT NULL, "client_id" integer NOT NULL, "deal_id" integer, "type" "public"."activities_type_enum" NOT NULL, "subject" character varying(255) NOT NULL, "planned_at" TIMESTAMP WITH TIME ZONE NOT NULL, "done_at" TIMESTAMP WITH TIME ZONE, "status" "public"."activities_status_enum" NOT NULL DEFAULT 'planned', "result" text, "comment" text, "owner_user_id" integer, CONSTRAINT "PK_1ca2c10152039da7b4c08744ab9" PRIMARY KEY ("activity_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_activities_planning" ON "activities" ("planned_at", "owner_user_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."clients_status_enum" AS ENUM('lead', 'in_work', 'active', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."clients_source_enum" AS ENUM('website', 'call', 'exhibition', 'partner', 'advertising', 'recommendation')`,
    );
    await queryRunner.query(
      `CREATE TABLE "clients" ("client_id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "inn" character varying(12), "industry" character varying(120), "status" "public"."clients_status_enum" NOT NULL DEFAULT 'lead', "source" "public"."clients_source_enum", "address" character varying(255), "owner_user_id" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_49e91f1e368e3f760789e7764aa" PRIMARY KEY ("client_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_clients_name" ON "clients" ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_clients_owner" ON "clients" ("owner_user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."commercial_offers_status_enum" AS ENUM('draft', 'sent', 'accepted', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "commercial_offers" ("offer_id" SERIAL NOT NULL, "deal_id" integer NOT NULL, "number" character varying(64) NOT NULL, "date" date NOT NULL, "total_amount" numeric(14,2) NOT NULL DEFAULT '0', "status" "public"."commercial_offers_status_enum" NOT NULL DEFAULT 'draft', "file_ref" character varying(255), CONSTRAINT "PK_16080420f3a2343a841fdfccde3" PRIMARY KEY ("offer_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_offers_deal" ON "commercial_offers" ("deal_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_log_action_enum" AS ENUM('create', 'update', 'delete', 'login', 'export')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_log" ("id" SERIAL NOT NULL, "user_id" integer, "entity" character varying(64) NOT NULL, "entity_id" character varying(64), "action" "public"."audit_log_action_enum" NOT NULL, "payload" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_user" ON "audit_log" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_created" ON "audit_log" ("created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "contacts" ADD CONSTRAINT "FK_72d1013c43a0198e905290831e5" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "deal_stage_history" ADD CONSTRAINT "FK_073f62f53839beb06c39ee65b82" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "deal_stage_history" ADD CONSTRAINT "FK_da17c3e8ee6f6e06e82b72e1c94" FOREIGN KEY ("changed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "deals" ADD CONSTRAINT "FK_7a1770366da1de36b1efc628073" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "deals" ADD CONSTRAINT "FK_07c50a332fa40e891d2026a0319" FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD CONSTRAINT "FK_8aa3b964a575c4eb670bbe0a89d" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD CONSTRAINT "FK_04fa1883f5dc10f9a9661074ae0" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD CONSTRAINT "FK_a5a928b05a4eced7627b766cf0f" FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ADD CONSTRAINT "FK_6a58aa554994437afe9d4dc4343" FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commercial_offers" ADD CONSTRAINT "FK_e7fe8d4adc7501201784e27e74a" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "commercial_offers" DROP CONSTRAINT "FK_e7fe8d4adc7501201784e27e74a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" DROP CONSTRAINT "FK_6a58aa554994437afe9d4dc4343"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP CONSTRAINT "FK_a5a928b05a4eced7627b766cf0f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP CONSTRAINT "FK_04fa1883f5dc10f9a9661074ae0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP CONSTRAINT "FK_8aa3b964a575c4eb670bbe0a89d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deals" DROP CONSTRAINT "FK_07c50a332fa40e891d2026a0319"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deals" DROP CONSTRAINT "FK_7a1770366da1de36b1efc628073"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deal_stage_history" DROP CONSTRAINT "FK_da17c3e8ee6f6e06e82b72e1c94"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deal_stage_history" DROP CONSTRAINT "FK_073f62f53839beb06c39ee65b82"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contacts" DROP CONSTRAINT "FK_72d1013c43a0198e905290831e5"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_audit_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_user"`);
    await queryRunner.query(`DROP TABLE "audit_log"`);
    await queryRunner.query(`DROP TYPE "public"."audit_log_action_enum"`);
    await queryRunner.query(`DROP INDEX "public"."idx_offers_deal"`);
    await queryRunner.query(`DROP TABLE "commercial_offers"`);
    await queryRunner.query(
      `DROP TYPE "public"."commercial_offers_status_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_clients_owner"`);
    await queryRunner.query(`DROP INDEX "public"."idx_clients_name"`);
    await queryRunner.query(`DROP TABLE "clients"`);
    await queryRunner.query(`DROP TYPE "public"."clients_source_enum"`);
    await queryRunner.query(`DROP TYPE "public"."clients_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."idx_activities_planning"`);
    await queryRunner.query(`DROP TABLE "activities"`);
    await queryRunner.query(`DROP TYPE "public"."activities_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."activities_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."idx_deals_stage_owner"`);
    await queryRunner.query(`DROP INDEX "public"."idx_deals_closed_at"`);
    await queryRunner.query(`DROP TABLE "deals"`);
    await queryRunner.query(`DROP TYPE "public"."deals_currency_enum"`);
    await queryRunner.query(`DROP TYPE "public"."deals_stage_enum"`);
    await queryRunner.query(`DROP INDEX "public"."idx_stage_history_deal"`);
    await queryRunner.query(`DROP TABLE "deal_stage_history"`);
    await queryRunner.query(
      `DROP TYPE "public"."deal_stage_history_to_stage_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."deal_stage_history_from_stage_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_contacts_client"`);
    await queryRunner.query(`DROP TABLE "contacts"`);
    await queryRunner.query(
      `DROP TYPE "public"."contacts_preferred_channel_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_users_login"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
