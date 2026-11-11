import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotifications1791400000000 implements MigrationInterface {
  name = 'AddNotifications1791400000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE notifications (
      notification_id SERIAL PRIMARY KEY,
      organization_id integer NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      type varchar(32) NOT NULL,
      title varchar(255) NOT NULL,
      body varchar(500),
      link varchar(255),
      dedupe_key varchar(120) NOT NULL,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      'CREATE UNIQUE INDEX uq_notifications_user_key ON notifications (user_id, dedupe_key)',
    );
    await runner.query(
      'CREATE INDEX idx_notifications_user_unread ON notifications (user_id, created_at DESC) WHERE read_at IS NULL',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE notifications');
  }
}
