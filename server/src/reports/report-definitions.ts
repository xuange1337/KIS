import {
  ACTIVITY_TYPE_LABELS,
  ActivityType,
  DEAL_LOSS_REASON_LABELS,
  DEAL_STAGE_LABELS,
  DealLossReason,
  DealStage,
  ReportName,
} from '@crm/shared';

/** Строка отчёта: набор значений, форма которого зависит от отчёта. */
export type ExportRow = Record<string, unknown>;

/** Значение ячейки выгрузки; пустое отображается пустой ячейкой. */
export type ExportCell = string | number | null;

/** Приводит значение строки отчёта к виду, пригодному для ячейки. */
const cell = (value: unknown): ExportCell =>
  typeof value === 'string' || typeof value === 'number'
    ? value
    : value == null
      ? null
      : String(value);

/** Описание колонки выгрузки: заголовок и извлечение значения из строки. */
export interface ExportColumn {
  header: string;
  /** Ширина колонки в символах для XLSX и доля ширины для PDF. */
  width: number;
  value: (row: ExportRow) => ExportCell;
}

export interface ReportDefinition {
  title: string;
  columns: ExportColumn[];
}

const formatDate = (value: unknown): string =>
  value ? new Date(value as string).toLocaleDateString('ru-RU') : '—';

const formatDateTime = (value: unknown): string =>
  value
    ? new Date(value as string).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/**
 * Единое описание выгрузок для всех отчётов: заголовки и порядок колонок
 * не дублируются между CSV, XLSX и PDF.
 */
export const REPORT_DEFINITIONS: Record<ReportName, ReportDefinition> = {
  funnel: {
    title: 'Воронка продаж',
    columns: [
      {
        header: 'Стадия',
        width: 28,
        value: (row) =>
          cell(DEAL_STAGE_LABELS[row.stage as DealStage] ?? row.stage),
      },
      {
        header: 'Количество сделок',
        width: 20,
        value: (row) => cell(row.count),
      },
      { header: 'Сумма', width: 20, value: (row) => cell(row.amount) },
    ],
  },
  'sales-dynamics': {
    title: 'Динамика продаж',
    columns: [
      { header: 'Период', width: 18, value: (row) => formatDate(row.period) },
      { header: 'Закрыто сделок', width: 18, value: (row) => cell(row.count) },
      { header: 'Сумма', width: 20, value: (row) => cell(row.amount) },
    ],
  },
  'manager-activities': {
    title: 'Активности менеджеров',
    columns: [
      { header: 'Сотрудник', width: 32, value: (row) => cell(row.fullName) },
      { header: 'Звонки', width: 12, value: (row) => cell(row.calls) },
      { header: 'Встречи', width: 12, value: (row) => cell(row.meetings) },
      { header: 'Письма', width: 12, value: (row) => cell(row.emails) },
      { header: 'Всего', width: 12, value: (row) => cell(row.total) },
    ],
  },
  'overdue-activities': {
    title: 'Просроченные активности',
    columns: [
      {
        header: 'Тип',
        width: 14,
        value: (row) =>
          cell(ACTIVITY_TYPE_LABELS[row.type as ActivityType] ?? row.type),
      },
      { header: 'Тема', width: 34, value: (row) => cell(row.subject) },
      { header: 'Клиент', width: 28, value: (row) => cell(row.clientName) },
      {
        header: 'Запланирована на',
        width: 20,
        value: (row) => formatDateTime(row.plannedAt),
      },
      {
        header: 'Просрочка, дней',
        width: 18,
        value: (row) => cell(row.daysOverdue),
      },
      {
        header: 'Ответственный',
        width: 28,
        value: (row) => cell(row.ownerName),
      },
    ],
  },
  'loss-reasons': {
    title: 'Причины проигрыша',
    columns: [
      {
        header: 'Причина',
        width: 32,
        value: (row) =>
          cell(
            DEAL_LOSS_REASON_LABELS[row.reason as DealLossReason] ?? row.reason,
          ),
      },
      { header: 'Сделок', width: 14, value: (row) => cell(row.count) },
      { header: 'Сумма', width: 20, value: (row) => cell(row.amount) },
    ],
  },
  top: {
    title: 'ТОП по сумме',
    columns: [
      { header: 'Наименование', width: 44, value: (row) => cell(row.name) },
      { header: 'Сделок', width: 12, value: (row) => cell(row.dealsCount) },
      { header: 'Сумма', width: 20, value: (row) => cell(row.amount) },
    ],
  },
};
