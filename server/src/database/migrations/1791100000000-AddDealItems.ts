import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDealItems1791100000000 implements MigrationInterface {
  name = 'AddDealItems1791100000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE deal_items (
      item_id SERIAL PRIMARY KEY,
      organization_id integer NOT NULL REFERENCES organizations(organization_id) ON DELETE RESTRICT,
      deal_id integer NOT NULL REFERENCES deals(deal_id) ON DELETE CASCADE,
      product_id integer NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
      sku varchar(64) NOT NULL,
      name varchar(200) NOT NULL,
      unit varchar(32) NOT NULL,
      quantity numeric(10,3) NOT NULL CHECK (quantity > 0),
      unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
      total_amount numeric(14,2) NOT NULL CHECK (total_amount >= 0)
    )`);
    await runner.query(
      'CREATE INDEX idx_deal_items_deal ON deal_items (deal_id)',
    );
    await runner.query(
      'CREATE INDEX idx_deal_items_organization ON deal_items (organization_id)',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE deal_items');
  }
}
