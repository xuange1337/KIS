import { BadRequestException } from '@nestjs/common';
import {
  CLIENT_SOURCE_LABELS,
  CLIENT_STATUS_LABELS,
  ClientSource,
  ClientStatus,
  ImportColumn,
  ImportRow,
} from '@crm/shared';
import * as ExcelJS from 'exceljs';

/** Предел строк в одном файле. */
export const MAX_IMPORT_ROWS = 1000;

/**
 * Колонки файла и как они называются у людей.
 *
 * Выгрузка из другой системы приходит с заголовками на русском, и
 * требовать переименования колонок — значит заставить пользователя
 * править файл в редакторе до того, как он сможет им воспользоваться.
 */
const COLUMN_ALIASES: Record<ImportColumn, string[]> = {
  name: ['наименование', 'название', 'клиент', 'организация', 'name'],
  inn: ['инн', 'inn'],
  industry: ['отрасль', 'industry'],
  status: ['статус', 'status'],
  source: ['источник', 'source'],
  address: ['адрес', 'address'],
};

const normalize = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

/** Значение перечисления по коду или по русской подписи. */
const matchEnum = <T extends string>(
  value: string,
  labels: Record<T, string>,
): T | undefined => {
  const needle = normalize(value);
  const entries = Object.entries(labels) as [T, string][];
  return entries.find(
    ([code, label]) =>
      normalize(code) === needle || normalize(label) === needle,
  )?.[0];
};

/** Разобранный файл: какие колонки распознаны и что в строках. */
export interface ParsedImport {
  columns: Partial<Record<ImportColumn, string>>;
  rows: ImportRow[];
}

/**
 * Разбор загруженного файла.
 *
 * CSV и XLSX разбираются одним кодом после приведения к таблице строк:
 * правила проверки не должны зависеть от того, в каком формате прислали
 * те же данные.
 */
export async function parseImportFile(
  buffer: Buffer,
  fileName: string,
): Promise<ParsedImport> {
  const table = fileName.toLowerCase().endsWith('.csv')
    ? parseCsv(buffer)
    : await parseXlsx(buffer);

  if (table.length === 0) {
    throw new BadRequestException('Файл пуст');
  }

  const [header, ...body] = table;
  const columns = mapColumns(header);
  if (columns.name === undefined) {
    throw new BadRequestException(
      'В файле не найдена колонка с наименованием клиента. ' +
        'Ожидается заголовок «Наименование», «Название» или «Клиент»',
    );
  }
  if (body.length > MAX_IMPORT_ROWS) {
    throw new BadRequestException(
      `В файле ${body.length} строк, за один раз загружается не более ${MAX_IMPORT_ROWS}`,
    );
  }

  const indexes = columnIndexes(header);
  const seenInn = new Map<string, number>();
  const seenName = new Map<string, number>();

  const rows = body
    // Пустые строки в конце файла — обычное дело для выгрузок из Excel
    .filter((cells) => cells.some((cell) => cell.trim().length > 0))
    .map((cells, index) =>
      buildRow(cells, indexes, index + 2, seenInn, seenName),
    );

  return { columns, rows };
}

/** Соответствие «колонка файла → поле карточки» для показа пользователю. */
function mapColumns(header: string[]): Partial<Record<ImportColumn, string>> {
  const result: Partial<Record<ImportColumn, string>> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
    ImportColumn,
    string[],
  ][]) {
    const found = header.find((title) => aliases.includes(normalize(title)));
    if (found !== undefined) result[field] = found;
  }
  return result;
}

function columnIndexes(
  header: string[],
): Partial<Record<ImportColumn, number>> {
  const result: Partial<Record<ImportColumn, number>> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
    ImportColumn,
    string[],
  ][]) {
    const index = header.findIndex((title) =>
      aliases.includes(normalize(title)),
    );
    if (index >= 0) result[field] = index;
  }
  return result;
}

/** Проверка одной строки: значения приводятся, ошибки собираются все сразу. */
function buildRow(
  cells: string[],
  indexes: Partial<Record<ImportColumn, number>>,
  lineNumber: number,
  seenInn: Map<string, number>,
  seenName: Map<string, number>,
): ImportRow {
  const cell = (field: ImportColumn): string => {
    const index = indexes[field];
    return index === undefined ? '' : (cells[index] ?? '').trim();
  };

  const errors: string[] = [];
  const name = cell('name');
  if (name.length < 2) {
    errors.push('Наименование короче двух символов');
  }
  if (name.length > 255) {
    errors.push('Наименование длиннее 255 символов');
  }

  const inn = cell('inn').replace(/\s/g, '');
  if (inn && !/^(\d{10}|\d{12})$/.test(inn)) {
    errors.push('ИНН должен содержать 10 цифр (организация) или 12 (ИП)');
  }

  const statusRaw = cell('status');
  const status = statusRaw
    ? matchEnum<ClientStatus>(statusRaw, CLIENT_STATUS_LABELS)
    : undefined;
  if (statusRaw && !status) {
    errors.push(`Неизвестный статус: ${statusRaw}`);
  }

  const sourceRaw = cell('source');
  const source = sourceRaw
    ? matchEnum<ClientSource>(sourceRaw, CLIENT_SOURCE_LABELS)
    : undefined;
  if (sourceRaw && !source) {
    errors.push(`Неизвестный источник: ${sourceRaw}`);
  }

  // Дубли внутри самого файла: выгрузки часто склеивают из нескольких
  // и одна и та же организация попадает дважды
  if (inn) {
    const previous = seenInn.get(inn);
    if (previous) errors.push(`Дубль ИНН со строкой ${previous}`);
    else seenInn.set(inn, lineNumber);
  }
  const nameKey = normalize(name);
  if (nameKey) {
    const previous = seenName.get(nameKey);
    if (previous) errors.push(`Дубль наименования со строкой ${previous}`);
    else seenName.set(nameKey, lineNumber);
  }

  return {
    line: lineNumber,
    name,
    inn: inn || null,
    industry: cell('industry') || null,
    status: status ?? null,
    source: source ?? null,
    address: cell('address') || null,
    errors,
  };
}

/**
 * Разбор CSV.
 *
 * Разделитель определяется по заголовку: выгрузки из Excel в русской
 * локали используют точку с запятой, а из веб-систем — запятую.
 * Кавычки учитываются: в наименованиях организаций запятые не редкость.
 */
function parseCsv(buffer: Buffer): string[][] {
  const text = buffer
    .toString('utf8')
    // BOM оставляет невидимый символ в первом заголовке, и колонка
    // «Наименование» перестаёт распознаваться
    .replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter =
    firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

/** Разбор XLSX: читается первый лист. */
async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestException('В файле нет ни одного листа');
  }

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(
        cell.value === null || cell.value === undefined
          ? ''
          : String(cell.text ?? cell.value),
      );
    });
    rows.push(cells);
  });
  return rows;
}
