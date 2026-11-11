import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavedFiltersAndFavorites1791200000000 implements MigrationInterface {
  name = 'AddSavedFiltersAndFavorites1791200000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE saved_filters (
      saved_filter_id SERIAL PRIMARY KEY,
      organization_id integer NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      entity varchar(16) NOT NULL CHECK (entity IN ('clients', 'deals')),
      name varchar(80) NOT NULL CHECK (length(trim(name)) > 0),
      filters jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      'CREATE UNIQUE INDEX uq_saved_filters_user_entity_name ON saved_filters (user_id, entity, name)',
    );
    await runner.query(`CREATE TABLE favorites (
      favorite_id SERIAL PRIMARY KEY,
      organization_id integer NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      entity_type varchar(16) NOT NULL CHECK (entity_type IN ('client', 'deal')),
      entity_id integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      'CREATE UNIQUE INDEX uq_favorites_user_entity ON favorites (user_id, entity_type, entity_id)',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE favorites');
    await runner.query('DROP TABLE saved_filters');
  }
}
