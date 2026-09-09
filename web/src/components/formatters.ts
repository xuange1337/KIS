/** Единое форматирование сумм, дат и телефонов во всех разделах АРМ. */

import { BASE_CURRENCY, Currency } from '@crm/shared';

/**
 * Форматтеры по валютам создаются один раз: Intl.NumberFormat дорог
 * в конструировании, а таблицы вызывают форматирование на каждую ячейку.
 */
const currencyFormatters = new Map<Currency, Intl.NumberFormat>();

const currencyFormatterFor = (currency: Currency): Intl.NumberFormat => {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter;
};

const numberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
});

/**
 * Форматирует сумму в указанной валюте.
 * Валюта передаётся явно: раньше всё выводилось рублями независимо от
 * валюты сделки, из-за чего доллары показывались как рубли.
 */
export const formatMoney = (
  value: number | string | null | undefined,
  currency: Currency = BASE_CURRENCY,
): string =>
  value === null || value === undefined
    ? '—'
    : currencyFormatterFor(currency).format(Number(value));

export const formatNumber = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : numberFormatter.format(value);

export const formatDate = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleDateString('ru-RU') : '—';

export const formatDateTime = (value: string | null | undefined): string =>
  value
    ? new Date(value).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/** Короткая дата со временем для календаря и лент активностей. */
export const formatShortDateTime = (value: string): string =>
  new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Количество дней просрочки; отрицательные значения означают запас времени. */
export const daysUntil = (value: string): number =>
  Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 3600 * 1000));

/**
 * Преобразования между Date из компонентов выбора даты и строковым
 * представлением, в котором даты хранятся в состоянии форм и уходят в API.
 */

/** Строка 'ГГГГ-ММ-ДД' или ISO → Date; пустая строка → null. */
export const parseDateValue = (value: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Date → 'ГГГГ-ММ-ДД' в местном времени (без сдвига из-за UTC). */
export const toIsoDate = (date: Date | null): string => {
  if (!date || Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

/** Date → ISO-строка с временем для передачи в API. */
export const toIsoDateTime = (date: Date | null): string =>
  date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
