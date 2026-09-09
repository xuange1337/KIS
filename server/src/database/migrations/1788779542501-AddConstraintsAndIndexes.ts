import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Приводит схему в соответствие с документацией (docs/schema.sql) и
 * добавляет индексы под фактические выборки.
 *
 * CHECK-ограничения были описаны в Приложении А пояснительной записки,
 * но в базе отсутствовали: суммы и вероятность защищались только валидацией
 * DTO, а прямые запросы и seed могли записать любое значение.
 *
 * Индексы: разграничение доступа добавляет условие по owner_user_id во все
 * списки и отчёты, но ведущими колонками существующих составных индексов
 * были stage и planned_at, поэтому по одному owner_user_id они не работали.
 */
export class AddConstraintsAndIndexes1788779542501 implements MigrationInterface {
  name = 'AddConstraintsAndIndexes1788779542501';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "deals"
        ADD CONSTRAINT "ck_deals_amount" CHECK ("amount" >= 0),
        ADD CONSTRAINT "ck_deals_probability" CHECK ("probability" BETWEEN 0 AND 100)
    `);
    await queryRunner.query(`
      ALTER TABLE "commercial_offers"
        ADD CONSTRAINT "ck_offers_amount" CHECK ("total_amount" >= 0)
    `);

    // Выборки вида «мои сделки» и «мои активности»
    await queryRunner.query(
      `CREATE INDEX "idx_deals_owner" ON "deals" ("owner_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_activities_owner" ON "activities" ("owner_user_id")`,
    );
    // Фильтры карточек и каскадное удаление по внешним ключам
    await queryRunner.query(
      `CREATE INDEX "idx_activities_client" ON "activities" ("client_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_activities_deal" ON "activities" ("deal_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_activities_deal"`);
    await queryRunner.query(`DROP INDEX "idx_activities_client"`);
    await queryRunner.query(`DROP INDEX "idx_activities_owner"`);
    await queryRunner.query(`DROP INDEX "idx_deals_owner"`);
    await queryRunner.query(
      `ALTER TABLE "commercial_offers" DROP CONSTRAINT "ck_offers_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deals"
         DROP CONSTRAINT "ck_deals_probability",
         DROP CONSTRAINT "ck_deals_amount"`,
    );
  }
}
