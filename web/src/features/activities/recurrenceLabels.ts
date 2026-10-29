import { ActivityRecurrence } from '@crm/shared';

/**
 * Подписи правил повтора. Живут в интерфейсе, а не в общем пакете: общий
 * пакет входит в основной чанк, а подписи нужны только форме активности и
 * ленте, которые загружаются отдельно.
 */
export const ACTIVITY_RECURRENCE_LABELS: Record<ActivityRecurrence, string> = {
  [ActivityRecurrence.DAILY]: 'Каждый день',
  [ActivityRecurrence.WEEKLY]: 'Каждую неделю',
  [ActivityRecurrence.MONTHLY]: 'Каждый месяц',
};
