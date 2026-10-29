import { ActivityRecurrence } from '@crm/shared';

/** Предел шагов поиска: защита от бесконечного цикла при ошибочной дате. */
const MAX_STEPS = 5000;

const DAY_MS = 24 * 60 * 60 * 1000;

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/**
 * Сдвиг на `steps` месяцев от исходной даты с сохранением времени суток.
 * День месяца берётся от исходной даты, а не от предыдущего повтора: серия с
 * 31 января даёт 28 февраля, но 31 марта, а не 28 марта. Конец короткого
 * месяца — предел дня, а не переход в следующий месяц.
 */
const addMonths = (source: Date, steps: number): Date => {
  const target = source.getUTCMonth() + steps;
  const year = source.getUTCFullYear() + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const day = Math.min(source.getUTCDate(), daysInMonth(year, month));
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      source.getUTCHours(),
      source.getUTCMinutes(),
      source.getUTCSeconds(),
      source.getUTCMilliseconds(),
    ),
  );
};

const occurrence = (
  source: Date,
  rule: ActivityRecurrence,
  steps: number,
): Date => {
  switch (rule) {
    case ActivityRecurrence.DAILY:
      return new Date(source.getTime() + steps * DAY_MS);
    case ActivityRecurrence.WEEKLY:
      return new Date(source.getTime() + steps * 7 * DAY_MS);
    case ActivityRecurrence.MONTHLY:
      return addMonths(source, steps);
  }
};

/**
 * Дата следующей активности серии.
 *
 * Отсчёт идёт от запланированной даты, а не от момента выполнения: иначе
 * серия «каждый понедельник» сползала бы на день, в который активность
 * успели отметить. Если выполнение сильно запоздало, пропущенные повторы не
 * создаются пачкой: берётся ближайшая дата строго после `now`.
 *
 * Сдвиг выполняется по UTC. Для часовых поясов без перехода на летнее время
 * (в том числе московского) время суток сохраняется; для поясов с таким
 * переходом оно сдвинулось бы на час.
 */
export const nextOccurrence = (
  plannedAt: Date,
  rule: ActivityRecurrence,
  now: Date,
): Date => {
  for (let steps = 1; steps <= MAX_STEPS; steps += 1) {
    const candidate = occurrence(plannedAt, rule, steps);
    if (candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
  throw new Error('Не удалось определить дату следующего повтора');
};
