import {
  ACTIVITY_TYPE_LABELS,
  ActivityType,
  DEAL_STAGE_LABELS,
  DealStage,
  ReportName,
} from '@crm/shared';

/** Описание колонки выгрузки: заголовок и извлечение значения из строки. */
export interface ExportColumn {
  header: string;
  /** Ширина колонки в символах для XLSX и доля ширины для PDF. */
  width: number;
  value: (row: Record<string, any>) => string | number;
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
        value: (row) => DEAL_STAGE_LABELS[row.stage as DealStage] ?? row.stage,
      },
      { header: 'Количество сделок', width: 20, value: (row) => row.count },
      { header: 'Сумма', width: 20, value: (row) => row.amount },
    ],
  },
  'sales-dynamics': {
    title: 'Динамика продаж',
    columns: [
      { header: 'Период', width: 18, value: (row) => formatDate(row.period) },
      { header: 'Закрыто сделок', width: 18, value: (row) => row.count },
      { header: 'Сумма', width: 20, value: (row) => row.amount },
    ],
  },
  'manager-activities': {
    title: 'Активности менеджеров',
    columns: [
      { header: 'Сотрудник', width: 32, value: (row) => row.fullName },
      { header: 'Звонки', width: 12, value: (row) => row.calls },
      { header: 'Встречи', width: 12, value: (row) => row.meetings },
      { header: 'Письма', width: 12, value: (row) => row.emails },
      { header: 'Всего', width: 12, value: (row) => row.total },
    ],
  },
  'overdue-activities': {
    title: 'Просроченные активности',
    columns: [
      {
        header: 'Тип',
        width: 14,
        value: (row) =>
          ACTIVITY_TYPE_LABELS[row.type as ActivityType] ?? row.type,
      },
      { header: 'Тема', width: 34, value: (row) => row.subject },
      { header: 'Клиент', width: 28, value: (row) => row.clientName },
      {
        header: 'Запланирована на',
        width: 20,
        value: (row) => formatDateTime(row.plannedAt),
      },
      { header: 'Просрочка, дней', width: 18, value: (row) => row.daysOverdue },
      { header: 'Ответственный', width: 28, value: (row) => row.ownerName },
    ],
  },
  top: {
    title: 'ТОП по сумме',
    columns: [
      { header: 'Наименование', width: 44, value: (row) => row.name },
      { header: 'Сделок', width: 12, value: (row) => row.dealsCount },
      { header: 'Сумма', width: 20, value: (row) => row.amount },
    ],
  },
};
