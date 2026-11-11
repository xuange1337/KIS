import {
  ActivityRecurrence,
  ActivityStatus,
  ActivityType,
  ClientSource,
  ClientStatus,
  Currency,
  DealLossReason,
  DealStage,
  OfferStatus,
  OrganizationStatus,
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

export interface ProductDto {
  productId: number;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  price: number;
  currency: Currency;
  isActive: boolean;
  version: number;
}

export type ProductInput = Pick<
  ProductDto,
  'sku' | 'name' | 'unit' | 'price' | 'currency' | 'isActive'
> & { description?: string | null };

/** Организация, в которой работает пользователь. */
export interface OrganizationSummary {
  organizationId: number;
  name: string;
  /** Роль действует в пределах этой организации. */
  role: UserRole;
  /** Действующее состояние (с учётом истёкшего пробного периода). */
  status: OrganizationStatus;
  /** Конец пробного периода; null, если организация не на пробном. */
  trialEndsAt: string | null;
}

/** Организация целиком — для экрана настроек. */
export interface OrganizationDto {
  organizationId: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  status: OrganizationStatus;
  trialEndsAt: string | null;
  /** Владелец организации: ему доступны закрытие и передача владения. */
  ownerUserId: number | null;
  /** Когда организация закрыта; null, если работает. */
  closedAt: string | null;
  /** Когда данные закрытой организации будут удалены безвозвратно. */
  purgeAt: string | null;
  /** Сколько сотрудников в организации. */
  memberCount: number;
}

/** Участник организации в списке управления. */
export interface MemberDto {
  userId: number;
  login: string;
  fullName: string;
  email: string | null;
  role: UserRole;
  isOwner: boolean;
  isActive: boolean;
  joinedAt: string;
}

/** Приглашение в организацию. */
export interface InvitationDto {
  invitationId: number;
  role: UserRole;
  fullName: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

/** Что видит приглашённый до того, как принял приглашение. */
export interface InvitationPreview {
  organizationName: string;
  role: UserRole;
  fullName: string | null;
  expiresAt: string;
}

export interface UserDto {
  userId: number;
  login: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  email: string | null;
  /** Адрес подтверждён переходом по ссылке из письма. */
  emailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: UserDto;
  /** Организация сеанса и список доступных для переключения. */
  organization: OrganizationSummary;
  organizations: OrganizationSummary[];
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
  /** Метки клиента; приходят в списке клиентов. */
  tags?: TagDto[];
  /** Значения пользовательских полей: идентификатор поля → значение. */
  customFields?: Record<string, string | number | boolean>;
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
  /** Значения пользовательских полей: идентификатор поля → значение. */
  customFields?: Record<string, string | number | boolean>;
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
  /** Причина проигрыша; заполнена только у проигранных сделок. */
  lossReason: DealLossReason | null;
  /** Пояснение к причине; обязательно для причины «другое». */
  lossComment: string | null;
  createdAt: string;
}

/** Поля карточки клиента, которые понимает импорт. */
export type ImportColumn =
  'name' | 'inn' | 'industry' | 'status' | 'source' | 'address';

/** Строка файла импорта с результатом проверки. */
export interface ImportRow {
  /** Номер строки в файле, считая заголовок первой. */
  line: number;
  name: string;
  inn: string | null;
  industry: string | null;
  status: ClientStatus | null;
  source: ClientSource | null;
  address: string | null;
  /** Все ошибки строки сразу: исправлять по одной — это N загрузок файла. */
  errors: string[];
}

/** Предпросмотр загруженного файла. */
export interface ImportPreview {
  /** Какие колонки файла распознаны и под какими заголовками. */
  columns: Partial<Record<ImportColumn, string>>;
  rows: ImportRow[];
  validCount: number;
  errorCount: number;
}

/** Итог загрузки. */
export interface ImportResult {
  created: number;
  skipped: number;
  /** Строки, которые не удалось загрузить, с причинами. */
  errors: { line: number; name: string; errors: string[] }[];
}

/** Строка отчёта «Причины проигрыша». */
export interface LossReasonRow {
  reason: DealLossReason;
  count: number;
  amount: number;
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
  /** Повторение: после выполнения создаётся следующая активность. */
  recurrence: ActivityRecurrence | null;
  /** Последняя допустимая дата планирования повторов; null — без предела. */
  recurrenceUntil: string | null;
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
  currency: Currency;
  version: number;
  items?: OfferItemDto[];
}

export interface OfferItemDto {
  itemId: number;
  productId: number;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface OfferItemInput {
  itemId?: number;
  productId: number;
  quantity: number;
  unitPrice?: number;
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
  | 'loss-reasons'
  | 'top';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

/** Одно совпадение глобального поиска. */
export interface SearchHit {
  id: number;
  title: string;
  /** Уточнение: клиент сделки, ИНН, название сделки предложения. */
  subtitle: string;
  /** Куда ведёт совпадение. */
  url: string;
}

/** Результат поиска по всем разделам сразу. */
export interface GlobalSearchResult {
  clients: SearchHit[];
  deals: SearchHit[];
  activities: SearchHit[];
  offers: SearchHit[];
}

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

/** Почему клиентов сочли возможными дублями. */
export type DuplicateReason = 'inn' | 'name' | 'email' | 'phone';

export interface DuplicateClientDto {
  clientId: number;
  name: string;
  inn: string | null;
  status: string;
  ownerName: string | null;
  contactsCount: number;
  dealsCount: number;
  createdAt: string;
}

/** Группа клиентов, похожих друг на друга. */
export interface DuplicateGroupDto {
  /** Устойчивый ключ группы: наименьший идентификатор клиента. */
  key: number;
  reasons: DuplicateReason[];
  clients: DuplicateClientDto[];
}

export interface MergeClientsResult {
  clientId: number;
  mergedCount: number;
  movedContacts: number;
  movedDeals: number;
  movedActivities: number;
}

/** Личный набор фильтров списка. */
export interface SavedFilterDto {
  savedFilterId: number;
  entity: 'clients' | 'deals';
  name: string;
  filters: Record<string, string | number | boolean>;
  createdAt: string;
}

/** Метка клиента. */
export interface TagDto {
  tagId: number;
  name: string;
  /** Цвет в формате #RRGGBB. */
  color: string;
  /** Сколько клиентов помечено; приходит только в списке меток. */
  clientsCount?: number;
}

/** Уведомление центра уведомлений. */
export interface NotificationDto {
  notificationId: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface CommentDto {
  commentId: number;
  body: string;
  createdAt: string;
  authorUserId: number | null;
  authorName: string | null;
}

export interface ChecklistItemDto {
  itemId: number;
  text: string;
  isDone: boolean;
  position: number;
  doneAt: string | null;
}

export interface ChecklistProgress {
  total: number;
  done: number;
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select';

/** Описание пользовательского поля. */
export interface CustomFieldDto {
  fieldId: number;
  entity: 'client' | 'deal';
  name: string;
  type: CustomFieldType;
  options: string[];
  position: number;
}
