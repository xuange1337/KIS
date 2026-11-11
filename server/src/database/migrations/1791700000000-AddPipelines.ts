import { MigrationInterface, QueryRunner } from 'typeorm';

const ALL_STAGES = [
  'new',
  'qualification',
  'proposal',
  'negotiation',
  'won',
  'lost',
];

export class AddPipelines1791700000000 implements MigrationInterface {
  name = 'AddPipelines1791700000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE pipelines (
      pipeline_id SERIAL PRIMARY KEY,
      organization_id integer NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
      name varchar(80) NOT NULL CHECK (length(trim(name)) > 0),
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      'CREATE UNIQUE INDEX uq_pipelines_name ON pipelines (organization_id, lower(name))',
    );
    await runner.query(
      'CREATE UNIQUE INDEX uq_pipelines_default ON pipelines (organization_id) WHERE is_default',
    );
    await runner.query(`CREATE TABLE pipeline_stages (
      pipeline_id integer NOT NULL REFERENCES pipelines(pipeline_id) ON DELETE CASCADE,
      stage varchar(32) NOT NULL CHECK (stage IN ('new', 'qualification', 'proposal', 'negotiation', 'won', 'lost')),
      position integer NOT NULL,
      PRIMARY KEY (pipeline_id, stage)
    )`);
    await runner.query(
      'ALTER TABLE deals ADD COLUMN pipeline_id integer REFERENCES pipelines(pipeline_id) ON DELETE RESTRICT',
    );
    await runner.query(
      'CREATE INDEX idx_deals_pipeline ON deals (pipeline_id)',
    );
    // Для каждой существующей организации заводится основная воронка со
    // всеми стадиями, и в неё переносятся все её сделки
    await runner.query(
      `INSERT INTO pipelines (organization_id, name, is_default)
       SELECT organization_id, 'Основная воронка', true FROM organizations`,
    );
    for (const [index, stage] of ALL_STAGES.entries()) {
      await runner.query(
        `INSERT INTO pipeline_stages (pipeline_id, stage, position)
         SELECT pipeline_id, $1, $2 FROM pipelines`,
        [stage, index],
      );
    }
    await runner.query(
      `UPDATE deals d SET pipeline_id = p.pipeline_id
         FROM pipelines p
        WHERE p.organization_id = d.organization_id AND p.is_default`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE deals DROP COLUMN pipeline_id');
    await runner.query('DROP TABLE pipeline_stages');
    await runner.query('DROP TABLE pipelines');
  }
}
