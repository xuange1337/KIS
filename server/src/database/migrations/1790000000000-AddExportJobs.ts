import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Задания на фоновое формирование выгрузок.
 *
 * Синхронная выгрузка занимает рабочий поток процесса на всё время
 * формирования файла: на большой базе это минуты, в течение которых
 * экземпляр хуже отвечает всем остальным, а браузер успевает разорвать
 * соединение по таймауту и пользователь жмёт «выгрузить» ещё раз.
 */
export class AddExportJobs1790000000000 implements MigrationInterface {
  name = 'AddExportJobs1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "export_jobs" (
        "export_job_id" SERIAL NOT NULL,
        "organization_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "report" character varying(64) NOT NULL,
        "format" character varying(8) NOT NULL,
        "params" jsonb NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "file_name" character varying(255),
        "content_type" character varying(128),
        "size_bytes" integer,
        "row_count" integer,
        "error" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "finished_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_export_jobs" PRIMARY KEY ("export_job_id"),
        CONSTRAINT "fk_export_jobs_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("organization_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_export_jobs_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("user_id") ON DELETE CASCADE,
        CONSTRAINT "ck_export_jobs_status" CHECK
          ("status" IN ('pending', 'running', 'done', 'failed'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_export_jobs_organization" ON "export_jobs" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_export_jobs_status" ON "export_jobs" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_export_jobs_expires" ON "export_jobs" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "export_jobs"`);
  }
}
