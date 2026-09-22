import { ExportFormat, ReportName } from '@crm/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../../organizations/organization.entity';
import { User } from '../../users/user.entity';

export type ExportJobStatus = 'pending' | 'running' | 'done' | 'failed';

/**
 * Задание на формирование выгрузки.
 *
 * Выгрузка отчёта считается синхронно и целиком в памяти: на учебной базе
 * это незаметно, но на десятках тысяч строк запрос занимает рабочий поток
 * процесса на минуты, а браузер к тому времени успевает разорвать
 * соединение по таймауту. Задание разрывает эту связь: HTTP-запрос
 * возвращается сразу, файл формируется отдельно, клиент забирает готовое.
 */
@Entity('export_jobs')
export class ExportJob {
  @PrimaryGeneratedColumn({ name: 'export_job_id' })
  exportJobId: number;

  @Index('idx_export_jobs_organization')
  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /** Заказавший выгрузку: файл содержит его срез данных, а не общий. */
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 64 })
  report: ReportName;

  @Column({ type: 'varchar', length: 8 })
  format: ExportFormat;

  /** Параметры отчёта: период, валюта, фильтр по сотруднику. */
  @Column({ type: 'jsonb' })
  params: Record<string, unknown>;

  @Index('idx_export_jobs_status')
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: ExportJobStatus;

  /** Имя файла, под которым выгрузка отдаётся пользователю. */
  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({
    name: 'content_type',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  contentType: string | null;

  @Column({ name: 'size_bytes', type: 'int', nullable: true })
  sizeBytes: number | null;

  /** Число строк в выгрузке: по нему видно, что файл не пустой. */
  @Column({ name: 'row_count', type: 'int', nullable: true })
  rowCount: number | null;

  /** Причина отказа — показывается заказавшему, поэтому без деталей СУБД. */
  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  /** До какого момента файл доступен для скачивания. */
  @Index('idx_export_jobs_expires')
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;
}
