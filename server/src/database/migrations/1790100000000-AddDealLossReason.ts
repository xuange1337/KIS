import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Причина проигрыша сделки.
 *
 * Без неё отчёт отвечает, сколько сделок проиграно, но не отвечает
 * почему — а это единственный вопрос, ради которого проигрыши и
 * разбирают. Список закрытый: свободный текст в отчёте не суммируется.
 */
export class AddDealLossReason1790100000000 implements MigrationInterface {
  name = 'AddDealLossReason1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "deal_loss_reason" AS ENUM (
        'price', 'competitor', 'no_budget', 'no_need',
        'no_response', 'timing', 'other'
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "deals" ADD COLUMN "loss_reason" "deal_loss_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deals" ADD COLUMN "loss_comment" text`,
    );
    /**
     * Причина есть только у проигранных сделок — это проверяется базой,
     * а не только приложением: отчёт по причинам строится прямым
     * запросом, и мусор в колонке исказил бы его молча.
     */
    await queryRunner.query(`
      ALTER TABLE "deals" ADD CONSTRAINT "ck_deals_loss_reason"
        CHECK (("stage" = 'lost') OR ("loss_reason" IS NULL))
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_deals_loss_reason" ON "deals" ("organization_id", "loss_reason")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_deals_loss_reason"`);
    await queryRunner.query(
      `ALTER TABLE "deals" DROP CONSTRAINT "ck_deals_loss_reason"`,
    );
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "loss_comment"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "loss_reason"`);
    await queryRunner.query(`DROP TYPE "deal_loss_reason"`);
  }
}
