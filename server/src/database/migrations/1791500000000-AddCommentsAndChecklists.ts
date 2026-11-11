import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentsAndChecklists1791500000000 implements MigrationInterface {
  name = 'AddCommentsAndChecklists1791500000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE comments (
      comment_id SERIAL PRIMARY KEY,
      organization_id integer NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
      entity_type varchar(16) NOT NULL CHECK (entity_type IN ('client', 'deal')),
      entity_id integer NOT NULL,
      author_user_id integer REFERENCES users(user_id) ON DELETE SET NULL,
      body text NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 2000),
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      'CREATE INDEX idx_comments_entity ON comments (entity_type, entity_id, created_at)',
    );
    await runner.query(`CREATE TABLE checklist_items (
      item_id SERIAL PRIMARY KEY,
      organization_id integer NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
      entity_type varchar(16) NOT NULL CHECK (entity_type IN ('client', 'deal')),
      entity_id integer NOT NULL,
      text varchar(255) NOT NULL CHECK (length(trim(text)) > 0),
      is_done boolean NOT NULL DEFAULT false,
      position integer NOT NULL DEFAULT 0,
      done_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      'CREATE INDEX idx_checklist_entity ON checklist_items (entity_type, entity_id, position)',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE checklist_items');
    await runner.query('DROP TABLE comments');
  }
}
