import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTags1791300000000 implements MigrationInterface {
  name = 'AddTags1791300000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE tags (
      tag_id SERIAL PRIMARY KEY,
      organization_id integer NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
      name varchar(40) NOT NULL CHECK (length(trim(name)) > 0),
      color varchar(7) NOT NULL DEFAULT '#6B7280' CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
    )`);
    await runner.query(
      'CREATE UNIQUE INDEX uq_tags_organization_name ON tags (organization_id, lower(name))',
    );
    await runner.query(`CREATE TABLE client_tags (
      client_id integer NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
      tag_id integer NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
      organization_id integer NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
      PRIMARY KEY (client_id, tag_id)
    )`);
    await runner.query(
      'CREATE INDEX idx_client_tags_tag ON client_tags (tag_id)',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE client_tags');
    await runner.query('DROP TABLE tags');
  }
}
