import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOfferItems1790600000000 implements MigrationInterface {
  name = 'AddOfferItems1790600000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      'ALTER TABLE commercial_offers ADD COLUMN version integer NOT NULL DEFAULT 1',
    );
    await runner.query(
      'ALTER TABLE commercial_offers ADD COLUMN currency varchar(3)',
    );
    await runner.query(
      'UPDATE commercial_offers o SET currency = d.currency::text FROM deals d WHERE d.deal_id = o.deal_id',
    );
    await runner.query(
      'ALTER TABLE commercial_offers ALTER COLUMN currency SET NOT NULL',
    );
    await runner.query(
      `ALTER TABLE commercial_offers ADD CONSTRAINT ck_offers_currency CHECK (currency IN ('RUB', 'USD', 'EUR'))`,
    );
    await runner.query(
      'ALTER TABLE commercial_offers ADD CONSTRAINT uq_offers_id_organization UNIQUE (offer_id, organization_id)',
    );
    await runner.query(
      'ALTER TABLE products ADD CONSTRAINT uq_products_id_organization UNIQUE (product_id, organization_id)',
    );
    await runner.query(`CREATE TABLE offer_items (
      item_id SERIAL PRIMARY KEY,
      organization_id integer NOT NULL,
      offer_id integer NOT NULL,
      product_id integer NOT NULL,
      sku varchar(64) NOT NULL,
      name varchar(200) NOT NULL,
      unit varchar(32) NOT NULL,
      quantity numeric(10,3) NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
      unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0 AND unit_price <= 999999999999.99),
      total_amount numeric(14,2) NOT NULL CHECK (total_amount >= 0 AND total_amount <= 999999999999.99),
      CONSTRAINT fk_items_offer FOREIGN KEY (offer_id, organization_id) REFERENCES commercial_offers(offer_id, organization_id) ON DELETE CASCADE,
      CONSTRAINT fk_items_product FOREIGN KEY (product_id, organization_id) REFERENCES products(product_id, organization_id) ON DELETE RESTRICT
    )`);
    await runner.query(
      'CREATE INDEX idx_offer_items_offer ON offer_items(offer_id, item_id)',
    );
    await runner.query(
      'CREATE INDEX idx_offer_items_product ON offer_items(product_id, organization_id)',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE offer_items');
    await runner.query(
      'ALTER TABLE products DROP CONSTRAINT uq_products_id_organization',
    );
    await runner.query(
      'ALTER TABLE commercial_offers DROP CONSTRAINT uq_offers_id_organization, DROP CONSTRAINT ck_offers_currency, DROP COLUMN currency, DROP COLUMN version',
    );
  }
}
