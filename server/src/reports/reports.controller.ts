import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  AuditAction,
  BASE_CURRENCY,
  ExportFormat,
  ReportName,
} from '@crm/shared';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';
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

const EXPORT_FORMATS: ExportFormat[] = ['csv', 'xlsx', 'pdf'];

/** Отчёты, формируемые программой (ТЗ п. 2.4, экранная форма «Отчёты»). */
@Controller('reports')
@AuditEntity('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ExportService,
  ) {}

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
    const reportName = report as ReportName;
    if (!REPORT_DEFINITIONS[reportName]) {
      throw new BadRequestException(`Неизвестный отчёт: ${report}`);
    }
    const exportFormat = (format ?? 'xlsx') as ExportFormat;
    if (!EXPORT_FORMATS.includes(exportFormat)) {
      throw new BadRequestException(
        `Неподдерживаемый формат выгрузки: ${format}`,
      );
    }

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
      case 'top':
        return this.reportsService.top(query, user);
    }
  }

  /** Подзаголовок выгрузки: период и валюта денежных показателей. */
  private describePeriod(query: ReportQueryDto): string {
    const format = (value: string) => new Date(value).toLocaleDateString('ru-RU');
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
