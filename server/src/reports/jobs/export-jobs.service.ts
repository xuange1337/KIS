import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExportFormat, ExportJobDto, ReportName } from '@crm/shared';
import { createReadStream, ReadStream } from 'fs';
import { mkdir, rm, writeFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { LessThan, Repository } from 'typeorm';
import { configuration } from '../../config/configuration';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { ExportJob } from './export-job.entity';

/** Сколько заданий выполняется одновременно. */
const CONCURRENCY = 1;

/** Сколько готовый файл доступен для скачивания. */
const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Предел числа незавершённых заданий на пользователя. */
const MAX_PENDING_PER_USER = 3;

/**
 * Очередь фоновых выгрузок.
 *
 * Очередь хранится в базе, а не в памяти: перезапуск процесса не должен
 * терять заказанные выгрузки, а состояние задания нужно видеть с любого
 * экземпляра. Обработчик при этом внутрипроцессный и берёт по одному
 * заданию — на нескольких экземплярах их разберут все сразу, поэтому
 * строка задания захватывается условным UPDATE, а не простым чтением.
 */
@Injectable()
export class ExportJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExportJobsService.name);
  private readonly directory = resolve(configuration().uploadsDir, 'exports');
  private running = 0;
  private cleanupTimer?: NodeJS.Timeout;
  private stopped = false;

  /** Формирование файла задаётся снаружи: сервис не знает про отчёты. */
  private runner?: (job: ExportJob) => Promise<{
    buffer: Buffer;
    fileName: string;
    contentType: string;
    rowCount: number;
  }>;

  constructor(
    @InjectRepository(ExportJob)
    private readonly repo: Repository<ExportJob>,
  ) {}

  registerRunner(runner: NonNullable<ExportJobsService['runner']>): void {
    this.runner = runner;
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    // Задания, брошенные предыдущим запуском в состоянии running,
    // возвращаются в очередь: иначе они висят «выполняется» вечно
    await this.repo.update({ status: 'running' }, { status: 'pending' });
    await this.cleanup();
    this.cleanupTimer = setInterval(() => void this.cleanup(), 60 * 60 * 1000);
    this.cleanupTimer.unref();
    void this.drain();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  /** Ставит выгрузку в очередь. */
  async enqueue(
    report: ReportName,
    format: ExportFormat,
    params: Record<string, unknown>,
    user: AuthUser,
  ): Promise<ExportJobDto> {
    const pending = await this.repo.count({
      where: [
        { userId: user.userId, status: 'pending' },
        { userId: user.userId, status: 'running' },
      ],
    });
    if (pending >= MAX_PENDING_PER_USER) {
      throw new BadRequestException(
        'Уже формируется несколько выгрузок. Дождитесь их завершения',
      );
    }

    const job = await this.repo.save(
      this.repo.create({
        organizationId: user.organizationId,
        userId: user.userId,
        report,
        format,
        params,
        status: 'pending',
      }),
    );
    void this.drain();
    return toExportJobDto(job);
  }

  async findOne(exportJobId: number, user: AuthUser): Promise<ExportJob> {
    const job = await this.repo.findOne({
      // Задание видит только заказавший: файл содержит его срез данных,
      // и коллеге с другими правами он показал бы лишнее
      where: {
        exportJobId,
        userId: user.userId,
        organizationId: user.organizationId,
      },
    });
    if (!job) {
      throw new NotFoundException('Задание на выгрузку не найдено');
    }
    return job;
  }

  async status(exportJobId: number, user: AuthUser): Promise<ExportJobDto> {
    return toExportJobDto(await this.findOne(exportJobId, user));
  }

  /** Список последних заданий пользователя. */
  async list(user: AuthUser, limit = 20): Promise<ExportJobDto[]> {
    const jobs = await this.repo.find({
      where: { userId: user.userId, organizationId: user.organizationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return jobs.map(toExportJobDto);
  }

  /** Поток готового файла. */
  async openFile(
    exportJobId: number,
    user: AuthUser,
  ): Promise<{ stream: ReadStream; job: ExportJob; size: number }> {
    const job = await this.findOne(exportJobId, user);
    if (job.status !== 'done') {
      throw new BadRequestException(
        job.status === 'failed'
          ? `Выгрузка не сформирована: ${job.error ?? 'неизвестная ошибка'}`
          : 'Выгрузка ещё формируется',
      );
    }
    if (job.expiresAt && job.expiresAt <= new Date()) {
      throw new NotFoundException('Срок хранения выгрузки истёк');
    }

    const path = this.filePath(job);
    try {
      const info = await stat(path);
      return { stream: createReadStream(path), job, size: info.size };
    } catch {
      throw new NotFoundException('Файл выгрузки недоступен');
    }
  }

  private filePath(job: ExportJob): string {
    return join(this.directory, `${job.exportJobId}.${job.format}`);
  }

  /** Разбирает очередь, пока есть задания и свободные места. */
  private async drain(): Promise<void> {
    if (this.stopped || !this.runner || this.running >= CONCURRENCY) return;

    const job = await this.claimNext();
    if (!job) return;

    this.running += 1;
    try {
      await this.process(job);
    } finally {
      this.running -= 1;
      void this.drain();
    }
  }

  /**
   * Захватывает следующее задание условным UPDATE.
   *
   * Чтение с последующей записью позволило бы двум экземплярам взять
   * одно задание и сформировать файл дважды; условие по прежнему статусу
   * в самом UPDATE делает захват атомарным.
   */
  private async claimNext(): Promise<ExportJob | null> {
    const claimed = await this.repo
      .createQueryBuilder()
      .update(ExportJob)
      .set({ status: 'running' })
      .where(
        `export_job_id = (
           SELECT export_job_id FROM export_jobs
            WHERE status = 'pending'
            ORDER BY created_at
            LIMIT 1
            FOR UPDATE SKIP LOCKED
         )`,
      )
      .returning('*')
      .execute();
    const row = claimed.raw?.[0] as { export_job_id?: number } | undefined;
    if (!row?.export_job_id) return null;
    // RETURNING отдаёт строку в именах колонок БД; сущность со связями и
    // типами читается отдельно — собирать её из сырой строки значит
    // повторять здесь работу маппера
    return this.repo.findOne({ where: { exportJobId: row.export_job_id } });
  }

  private async process(job: ExportJob): Promise<void> {
    try {
      const result = await this.runner!(job);
      await writeFile(this.filePath(job), result.buffer);
      await this.repo.update(
        { exportJobId: job.exportJobId },
        {
          status: 'done',
          fileName: result.fileName,
          contentType: result.contentType,
          sizeBytes: result.buffer.length,
          rowCount: result.rowCount,
          finishedAt: new Date(),
          expiresAt: new Date(Date.now() + RETENTION_MS),
        },
      );
    } catch (error) {
      this.logger.error(
        `Выгрузка ${job.exportJobId} не сформирована: ${String(error)}`,
      );
      await this.repo.update(
        { exportJobId: job.exportJobId },
        {
          status: 'failed',
          // Наружу уходит короткая причина: текст исключения может
          // содержать фрагменты запросов и пути файлов
          error: 'Не удалось сформировать файл. Повторите выгрузку',
          finishedAt: new Date(),
        },
      );
    }
  }

  /** Удаляет просроченные файлы и записи о них. */
  private async cleanup(): Promise<void> {
    try {
      const expired = await this.repo.find({
        where: { expiresAt: LessThan(new Date()) },
      });
      for (const job of expired) {
        await rm(this.filePath(job), { force: true });
      }
      if (expired.length > 0) {
        await this.repo.remove(expired);
        this.logger.log(`Удалено просроченных выгрузок: ${expired.length}`);
      }
    } catch (error) {
      this.logger.error(`Не удалось очистить выгрузки: ${String(error)}`);
    }
  }
}

export const toExportJobDto = (job: ExportJob): ExportJobDto => ({
  exportJobId: job.exportJobId,
  report: job.report,
  format: job.format,
  status: job.status,
  fileName: job.fileName,
  sizeBytes: job.sizeBytes,
  rowCount: job.rowCount,
  error: job.error,
  createdAt: job.createdAt.toISOString(),
  finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
  expiresAt: job.expiresAt ? job.expiresAt.toISOString() : null,
});
