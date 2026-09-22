import {
  ActivityStatus,
  ActivityType,
  ClientSource,
  ClientStatus,
  Currency,
  DealStage,
  OfferStatus,
  PreferredChannel,
  UserRole,
} from './enums';

/** Обёртка постраничного ответа для всех списков. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
  q?: string;
}

export interface UserDto {
  userId: number;
  login: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: UserDto;
}

export interface SessionDto {
  sessionId: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface ClientDto {
  clientId: number;
  name: string;
  inn: string | null;
  industry: string | null;
  status: ClientStatus;
  source: ClientSource | null;
  address: string | null;
  ownerUserId: number | null;
  owner?: UserDto | null;
  /**
   * Версия записи. Возвращается вместе с карточкой и отправляется
   * обратно при сохранении: так одновременная правка двумя людьми
   * не затирается молча, а отклоняется с понятным сообщением.
   */
  version: number;
  createdAt: string;
  /** Агрегаты для списка — заполняются выборкой списка клиентов. */
  dealsCount?: number;
  dealsAmount?: number;
}

export interface ContactDto {
  contactId: number;
  clientId: number;
  fullName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  preferredChannel: PreferredChannel | null;
  notes: string | null;
}

export interface DealDto {
  dealId: number;
  clientId: number;
  client?: Pick<ClientDto, 'clientId' | 'name'> | null;
  title: string;
  stage: DealStage;
  amount: number;
  currency: Currency;
  probability: number;
  plannedClose: string | null;
  ownerUserId: number | null;
  owner?: UserDto | null;
  /** Версия записи; см. ClientDto.version. */
  version: number;
  closedAt: string | null;
  createdAt: string;
}

export interface DealStageHistoryDto {
  id: number;
  dealId: number;
  fromStage: DealStage | null;
  toStage: DealStage;
  changedBy: number | null;
  changedByUser?: Pick<UserDto, 'userId' | 'fullName'> | null;
  changedAt: string;
}

export interface ActivityDto {
  activityId: number;
  clientId: number;
  client?: Pick<ClientDto, 'clientId' | 'name'> | null;
  dealId: number | null;
  deal?: Pick<DealDto, 'dealId' | 'title'> | null;
  type: ActivityType;
  subject: string;
  plannedAt: string;
  doneAt: string | null;
  status: ActivityStatus;
  result: string | null;
  comment: string | null;
  ownerUserId: number | null;
  owner?: UserDto | null;
}

export interface OfferDto {
  offerId: number;
  dealId: number;
  deal?: Pick<DealDto, 'dealId' | 'title'> | null;
  number: string;
  date: string;
  totalAmount: number;
  status: OfferStatus;
  fileRef: string | null;
}

/* ---------- Отчёты (ТЗ п. 2.4) ---------- */

export interface FunnelRow {
  stage: DealStage;
  count: number;
  amount: number;
}

export interface SalesDynamicsRow {
  period: string;
  count: number;
  amount: number;
}

export interface ManagerActivityRow {
  ownerUserId: number;
  fullName: string;
  calls: number;
  meetings: number;
  emails: number;
  total: number;
}

export interface OverdueActivityRow {
  activityId: number;
  type: ActivityType;
  subject: string;
  plannedAt: string;
  daysOverdue: number;
  clientName: string;
  ownerName: string;
}

export interface TopRow {
  id: number;
  name: string;
  dealsCount: number;
  amount: number;
}

export interface DashboardSummary {
  /** Валюта, в которой посчитаны денежные показатели сводки. */
  currency: Currency;
  dealsInWork: number;
  dealsInWorkAmount: number;
  wonThisMonthCount: number;
  wonThisMonthAmount: number;
  overdueCount: number;
  plannedTodayCount: number;
  funnel: FunnelRow[];
  upcomingActivities: ActivityDto[];
  overdueActivities: ActivityDto[];
}

/** Период выборки, общий параметр всех отчётов. */
export interface ReportQuery {
  from?: string;
  to?: string;
  ownerUserId?: number;
  /** Валюта денежных показателей; суммы разных валют не складываются. */
  currency?: Currency;
}

export type ReportName =
  | 'funnel'
  | 'sales-dynamics'
  | 'manager-activities'
  | 'overdue-activities'
  | 'top';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

/** Состояние задания на фоновую выгрузку. */
export type ExportJobStatus = 'pending' | 'running' | 'done' | 'failed';

/**
 * Задание на выгрузку отчёта.
 *
 * Большая выгрузка формируется не в запросе, а отдельно: клиент ставит
 * задание, опрашивает его состояние и забирает готовый файл.
 */
export interface ExportJobDto {
  exportJobId: number;
  report: ReportName;
  format: ExportFormat;
  status: ExportJobStatus;
  fileName: string | null;
  sizeBytes: number | null;
  rowCount: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  /** До какого момента файл доступен для скачивания. */
  expiresAt: string | null;
}
