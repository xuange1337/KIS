/**
 * Справочники и перечисления предметной области.
 * Единственный источник истины для сервера и клиента (п. 1.2 ТЗ — справочники).
 */

/** Роли пользователей (ТЗ п. 1.1: менеджер / руководитель / администратор). */
export enum UserRole {
  MANAGER = 'manager',
  HEAD = 'head',
  ADMIN = 'admin',
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.MANAGER]: 'Менеджер',
  [UserRole.HEAD]: 'Руководитель отдела продаж',
  [UserRole.ADMIN]: 'Администратор',
};

/** Статус клиента (лида) в работе. */
export enum ClientStatus {
  LEAD = 'lead',
  IN_WORK = 'in_work',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  [ClientStatus.LEAD]: 'Лид',
  [ClientStatus.IN_WORK]: 'В работе',
  [ClientStatus.ACTIVE]: 'Действующий',
  [ClientStatus.ARCHIVED]: 'В архиве',
};

/** Источник появления клиента. */
export enum ClientSource {
  WEBSITE = 'website',
  CALL = 'call',
  EXHIBITION = 'exhibition',
  PARTNER = 'partner',
  ADVERTISING = 'advertising',
  RECOMMENDATION = 'recommendation',
}

export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  [ClientSource.WEBSITE]: 'Сайт',
  [ClientSource.CALL]: 'Входящий звонок',
  [ClientSource.EXHIBITION]: 'Выставка',
  [ClientSource.PARTNER]: 'Партнёр',
  [ClientSource.ADVERTISING]: 'Реклама',
  [ClientSource.RECOMMENDATION]: 'Рекомендация',
};

/** Отрасли клиентов. */
export const INDUSTRIES = [
  'Розничная торговля',
  'Оптовая торговля',
  'Производство',
  'Строительство',
  'Логистика и транспорт',
  'ИТ и телеком',
  'Финансы и страхование',
  'Медицина',
  'Образование',
  'Государственный сектор',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

/**
 * Стадии сделки. Порядок соответствует жизненному циклу
 * из PLM-диаграммы (ТЗ п. 2.6.4) и используется для воронки продаж.
 */
export enum DealStage {
  NEW = 'new',
  QUALIFICATION = 'qualification',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost',
}

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  [DealStage.NEW]: 'Первичный контакт',
  [DealStage.QUALIFICATION]: 'Квалификация',
  [DealStage.PROPOSAL]: 'Предложение',
  [DealStage.NEGOTIATION]: 'Переговоры',
  [DealStage.WON]: 'Сделка выиграна',
  [DealStage.LOST]: 'Сделка проиграна',
};

/** Стадии воронки в порядке прохождения (без терминальных). */
export const DEAL_FUNNEL_STAGES: DealStage[] = [
  DealStage.NEW,
  DealStage.QUALIFICATION,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
];

/** Терминальные стадии — сделка закрыта. */
export const DEAL_CLOSED_STAGES: DealStage[] = [DealStage.WON, DealStage.LOST];

export const isClosedStage = (stage: DealStage): boolean =>
  DEAL_CLOSED_STAGES.includes(stage);

/** Вероятность закрытия по умолчанию для каждой стадии, %. */
export const DEAL_STAGE_PROBABILITY: Record<DealStage, number> = {
  [DealStage.NEW]: 10,
  [DealStage.QUALIFICATION]: 25,
  [DealStage.PROPOSAL]: 50,
  [DealStage.NEGOTIATION]: 75,
  [DealStage.WON]: 100,
  [DealStage.LOST]: 0,
};

export enum Currency {
  RUB = 'RUB',
  USD = 'USD',
  EUR = 'EUR',
}

/**
 * Базовая валюта отчётности.
 *
 * Курсы в прототипе не хранятся, поэтому суммы разных валют не складываются:
 * денежные показатели считаются по одной валюте, выбранной в отчёте.
 * По умолчанию — базовая.
 */
export const BASE_CURRENCY = Currency.RUB;

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  [Currency.RUB]: '₽',
  [Currency.USD]: '$',
  [Currency.EUR]: '€',
};

/** Тип активности (ТЗ п. 2.3: звонок / встреча / письмо). */
export enum ActivityType {
  CALL = 'call',
  MEETING = 'meeting',
  EMAIL = 'email',
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  [ActivityType.CALL]: 'Звонок',
  [ActivityType.MEETING]: 'Встреча',
  [ActivityType.EMAIL]: 'Письмо',
};

export enum ActivityStatus {
  PLANNED = 'planned',
  DONE = 'done',
  CANCELED = 'canceled',
}

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  [ActivityStatus.PLANNED]: 'Запланирована',
  [ActivityStatus.DONE]: 'Выполнена',
  [ActivityStatus.CANCELED]: 'Отменена',
};

/** Предпочитаемый канал связи с контактным лицом. */
export enum PreferredChannel {
  PHONE = 'phone',
  EMAIL = 'email',
  MESSENGER = 'messenger',
}

export const PREFERRED_CHANNEL_LABELS: Record<PreferredChannel, string> = {
  [PreferredChannel.PHONE]: 'Телефон',
  [PreferredChannel.EMAIL]: 'Электронная почта',
  [PreferredChannel.MESSENGER]: 'Мессенджер',
};

/** Статус коммерческого предложения. */
export enum OfferStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  [OfferStatus.DRAFT]: 'Черновик',
  [OfferStatus.SENT]: 'Отправлено',
  [OfferStatus.ACCEPTED]: 'Принято',
  [OfferStatus.REJECTED]: 'Отклонено',
};

/** Действие, фиксируемое в журнале (ТЗ п. 1.1 — журналирование действий). */
export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  EXPORT = 'export',
}
