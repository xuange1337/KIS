import { Currency } from '@crm/shared';
import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  formatDate,
  formatMoney,
  formatNumber,
  parseDateValue,
  toIsoDate,
  toIsoDateTime,
} from './formatters';

describe('Форматирование значений в интерфейсе', () => {
  it('выводит суммы в рублях без дробной части', () => {
    // Неразрывные пробелы в русской локали заменяются для сравнения
    const normalize = (value: string) => value.replace(/ /g, ' ');
    expect(normalize(formatMoney(1250000))).toBe('1 250 000 ₽');
    expect(normalize(formatMoney('890000'))).toBe('890 000 ₽');
  });

  it('заменяет отсутствующие значения прочерком', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatNumber(null)).toBe('—');
    expect(formatDate(null)).toBe('—');
  });

  it('выводит нулевую сумму, а не прочерк', () => {
    // Ноль — осмысленное значение суммы и не должен теряться
    expect(formatMoney(0)).not.toBe('—');
    expect(formatNumber(0)).toBe('0');
  });

  it('форматирует дату в принятом виде ДД.ММ.ГГГГ', () => {
    expect(formatDate('2026-03-14')).toBe('14.03.2026');
  });

  it('выводит сумму в её собственной валюте', () => {
    // Раньше любая сумма подписывалась рублями, и доллары показывались
    // как рубли — в списках сделок это давало неверную картину
    const rub = formatMoney(1000, Currency.RUB);
    const usd = formatMoney(1000, Currency.USD);
    const eur = formatMoney(1000, Currency.EUR);

    expect(rub).toContain('₽');
    expect(usd).toContain('$');
    expect(eur).toContain('€');
    expect(usd).not.toContain('₽');
  });

  it('без указания валюты использует базовую', () => {
    expect(formatMoney(1000)).toBe(formatMoney(1000, Currency.RUB));
  });
});

describe('Преобразование дат между формой и API', () => {
  it('возвращает null для пустого значения', () => {
    expect(parseDateValue('')).toBeNull();
    expect(toIsoDate(null)).toBe('');
    expect(toIsoDateTime(null)).toBe('');
  });

  it('не сдвигает день при обходе через Date', () => {
    // Наивное toISOString() смещает дату в часовых поясах восточнее UTC,
    // из-за чего сохранённая дата закрытия сделки уезжала на день назад
    const iso = '2026-01-01';
    expect(toIsoDate(parseDateValue(iso))).toBe(iso);
    expect(toIsoDate(parseDateValue('2026-12-31'))).toBe('2026-12-31');
  });

  it('сохраняет день для даты, собранной из местного времени', () => {
    const localMidday = new Date(2026, 6, 15, 12, 0, 0);
    expect(toIsoDate(localMidday)).toBe('2026-07-15');
    // Полночь по местному времени — граничный случай для сдвига в UTC
    const localMidnight = new Date(2026, 6, 15, 0, 0, 0);
    expect(toIsoDate(localMidnight)).toBe('2026-07-15');
  });

  it('игнорирует некорректную дату', () => {
    expect(parseDateValue('не дата')).toBeNull();
    expect(toIsoDate(new Date('не дата'))).toBe('');
  });

  it('считает остаток дней до срока', () => {
    const inThreeDays = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    expect(daysUntil(inThreeDays.toISOString())).toBe(3);

    const overdue = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    expect(daysUntil(overdue.toISOString())).toBeLessThan(0);
  });
});
