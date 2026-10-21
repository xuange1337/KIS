import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProducts1790500000000 implements MigrationInterface {
  name = 'AddProducts1790500000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE products (
      product_id SERIAL PRIMARY KEY,
      organization_id integer NOT NULL REFERENCES organizations(organization_id) ON DELETE RESTRICT,
      sku varchar(64) NOT NULL CHECK (length(trim(sku)) > 0),
      name varchar(200) NOT NULL CHECK (length(trim(name)) > 0),
      description varchar(2000),
      unit varchar(32) NOT NULL DEFAULT 'шт.' CHECK (length(trim(unit)) > 0),
      price numeric(14,2) NOT NULL CHECK (price >= 0 AND price <= 999999999999.99),
      currency varchar(3) NOT NULL DEFAULT 'RUB' CHECK (currency IN ('RUB', 'USD', 'EUR')),
      is_active boolean NOT NULL DEFAULT true,
      version integer NOT NULL DEFAULT 1 CHECK (version > 0)
    )`);
    await runner.query(
      'CREATE UNIQUE INDEX uq_products_organization_sku ON products (organization_id, sku)',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE products');
  }
}
