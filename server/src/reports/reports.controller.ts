import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  AuditAction,
  BASE_CURRENCY,
  ExportFormat,
  ExportJobDto,
  ReportName,
} from '@crm/shared';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';
import { ExportJobsService } from './jobs/export-jobs.service';
import { REPORT_DEFINITIONS } from './report-definitions';
import {
  ReportQueryDto,
  SalesDynamicsQueryDto,
  TopQueryDto,
} from './dto/report-query.dto';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Audit, AuditEntity } from '../common/decorators/audit.decorator';
import { UserRole } from '@crm/shared';

const EXPORT_FORMATS: ExportFormat[] = ['csv', 'xlsx', 'pdf'];

/** Отчёты, формируемые программой (ТЗ п. 2.4, экранная форма «Отчёты»). */
@Controller('reports')
@AuditEntity('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ExportService,
    private readonly exportJobs: ExportJobsService,
  ) {
    /**
     * Формирование файла задаётся здесь: очередь не знает про отчёты,
     * а контроллер не знает про очередь больше, чем нужно, чтобы
     * поставить задание.
     */
    this.exportJobs.registerRunner(async (job) => {
      const owner: AuthUser = {
        userId: job.userId,
        organizationId: job.organizationId,
        login: '',
        fullName: '',
        role: (job.params.__role as AuthUser['role']) ?? UserRole.MANAGER,
      };
      const query = job.params as TopQueryDto & SalesDynamicsQueryDto;
      const rows = await this.loadRows(job.report, query, owner);
      const result = await this.exportService.export(
        job.report,
        job.format,
        rows,
        this.describePeriod(query),
      );
      return { ...result, rowCount: rows.length };
    });
  }

  /** Список последних заданий пользователя. */
  @Get('export/jobs')
  listExportJobs(@CurrentUser() user: AuthUser): Promise<ExportJobDto[]> {
    return this.exportJobs.list(user);
  }

  /** Состояние задания. */
  @Get('export/jobs/:id')
  exportJobStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ExportJobDto> {
    return this.exportJobs.status(id, user);
  }

  /** Скачивание готового файла. */
  @Get('export/jobs/:id/file')
  @Audit(AuditAction.EXPORT)
  async downloadExportJob(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, job, size } = await this.exportJobs.openFile(id, user);
    res.set({
      'Content-Type': job.contentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${job.fileName}"`,
      'Content-Length': String(size),
    });
    return new StreamableFile(stream);
  }

  @Get('funnel')
  funnel(@Query() query: ReportQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportsService.funnel(query, user);
  }

  @Get('sales-dynamics')
  salesDynamics(
    @Query() query: SalesDynamicsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.salesDynamics(query, user);
  }

  @Get('manager-activities')
  managerActivities(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.managerActivities(query, user);
  }

  @Get('overdue-activities')
  overdueActivities(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.overdueActivities(query, user);
  }

  @Get('loss-reasons')
  lossReasons(@Query() query: ReportQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportsService.lossReasons(query, user);
  }

  @Get('top')
  top(@Query() query: TopQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportsService.top(query, user);
  }

  /**
   * Выгрузка отчёта в файл. Данные считаются тем же методом, что и для
   * экрана, поэтому выгрузка всегда совпадает с тем, что видит пользователь.
   */
  @Get(':report/export')
  // Выгрузка данных фиксируется в журнале: это самая чувствительная
  // операция чтения — из системы уходит файл с клиентской базой
  @Audit(AuditAction.EXPORT)
  async export(
    @Param('report') report: string,
    @Query('format') format: string,
    @Query() query: TopQueryDto & SalesDynamicsQueryDto,
    @CurrentUser() user: AuthUser,
    // passthrough: заголовки выставляются вручную, но ответ по-прежнему
    // проходит через конвейер Nest — иначе выгрузка выпадает из интерцептора
    // и не попадает в журнал действий
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const reportName = this.assertReport(report);
    const exportFormat = this.assertFormat(format);

    const rows = await this.loadRows(reportName, query, user);
    const result = await this.exportService.export(
      reportName,
      exportFormat,
      rows,
      this.describePeriod(query),
    );

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Content-Length': String(result.buffer.length),
    });
    return new StreamableFile(result.buffer);
  }

  /**
   * Постановка выгрузки в очередь.
   *
   * Отдаёт 202 и идентификатор задания: файл считается отдельно, а
   * запрос не держит рабочий поток процесса и не упирается в таймаут
   * прокси. Синхронный маршрут сохранён для небольших выгрузок.
   */
  @Post(':report/export/jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  @Audit(AuditAction.EXPORT)
  async enqueueExport(
    @Param('report') report: string,
    @Query('format') format: string,
    @Query() query: TopQueryDto & SalesDynamicsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ExportJobDto> {
    const reportName = this.assertReport(report);
    const exportFormat = this.assertFormat(format);
    return this.exportJobs.enqueue(
      reportName,
      exportFormat,
      // Роль сохраняется вместе с параметрами: выгрузка считается позже,
      // и права заказавшего должны применяться те же, что при заказе
      { ...query, __role: user.role },
      user,
    );
  }

  private assertReport(report: string): ReportName {
    const reportName = report as ReportName;
    if (!REPORT_DEFINITIONS[reportName]) {
      throw new BadRequestException(`Неизвестный отчёт: ${report}`);
    }
    return reportName;
  }

  private assertFormat(format: string | undefined): ExportFormat {
    const exportFormat = (format ?? 'xlsx') as ExportFormat;
    if (!EXPORT_FORMATS.includes(exportFormat)) {
      throw new BadRequestException(
        `Неподдерживаемый формат выгрузки: ${format}`,
      );
    }
    return exportFormat;
  }

  private loadRows(
    report: ReportName,
    query: TopQueryDto & SalesDynamicsQueryDto,
    user: AuthUser,
  ): Promise<Record<string, any>[]> {
    switch (report) {
      case 'funnel':
        return this.reportsService.funnel(query, user);
      case 'sales-dynamics':
        return this.reportsService.salesDynamics(query, user);
      case 'manager-activities':
        return this.reportsService.managerActivities(query, user);
      case 'overdue-activities':
        return this.reportsService.overdueActivities(query, user);
      case 'loss-reasons':
        return this.reportsService.lossReasons(query, user);
      case 'top':
        return this.reportsService.top(query, user);
    }
  }

  /** Подзаголовок выгрузки: период и валюта денежных показателей. */
  private describePeriod(query: ReportQueryDto): string {
    const format = (value: string) =>
      new Date(value).toLocaleDateString('ru-RU');
    const period =
      query.from && query.to
        ? `Период: ${format(query.from)} — ${format(query.to)}`
        : query.from
          ? `Период: с ${format(query.from)}`
          : query.to
            ? `Период: по ${format(query.to)}`
            : 'Период: за всё время';

    return `${period}. Валюта: ${query.currency ?? BASE_CURRENCY}`;
  }
}
