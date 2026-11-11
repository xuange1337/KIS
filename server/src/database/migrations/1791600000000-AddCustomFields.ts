import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomFields1791600000000 implements MigrationInterface {
  name = 'AddCustomFields1791600000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE custom_field_definitions (
      field_id SERIAL PRIMARY KEY,
      organization_id integer NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
      entity varchar(16) NOT NULL CHECK (entity IN ('client', 'deal')),
      name varchar(80) NOT NULL CHECK (length(trim(name)) > 0),
      type varchar(16) NOT NULL CHECK (type IN ('text', 'number', 'date', 'boolean', 'select')),
      options jsonb NOT NULL DEFAULT '[]'::jsonb,
      position integer NOT NULL DEFAULT 0
    )`);
    await runner.query(
      'CREATE UNIQUE INDEX uq_custom_fields_name ON custom_field_definitions (organization_id, entity, lower(name))',
    );
    await runner.query(
      `ALTER TABLE clients ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await runner.query(
      `ALTER TABLE deals ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE deals DROP COLUMN custom_fields');
    await runner.query('ALTER TABLE clients DROP COLUMN custom_fields');
    await runner.query('DROP TABLE custom_field_definitions');
  }
}
