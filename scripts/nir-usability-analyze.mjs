import { readFileSync } from 'node:fs';

/**
 * Сводка по таблице наблюдений за пользователями (docs/nir/usability-kit.md).
 *
 * Считает то, что названо в протоколе: долю завершённых задач, медиану и
 * диапазон времени, ошибки, подсказки и оценку SUS. Скрипт ничего не
 * выдумывает: на пустой таблице он так и сообщает, а не печатает нули,
 * похожие на результат.
 *
 * Запуск: node scripts/nir-usability-analyze.mjs таблица.csv
 *         node scripts/nir-usability-analyze.mjs --self-test
 */

const SUS_COLUMNS = Array.from({ length: 10 }, (_, i) => `sus_${i + 1}`);

export const parseCsv = (text) => {
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell !== '')) rows.push(row);
  const [header, ...body] = rows;
  return body.map((cells) =>
    Object.fromEntries(
      header.map((name, i) => [name.trim(), (cells[i] ?? '').trim()]),
    ),
  );
};

export const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Оценка SUS по десяти ответам 1–5; null, если ответы неполны или неверны. */
export const susScore = (answers) => {
  if (answers.length !== 10) return null;
  if (answers.some((a) => !Number.isInteger(a) || a < 1 || a > 5)) return null;
  const sum = answers.reduce(
    (total, answer, i) => total + (i % 2 === 0 ? answer - 1 : 5 - answer),
    0,
  );
  return sum * 2.5;
};

export const summarize = (records) => {
  if (records.length === 0) return { participants: 0 };
  const yes = (value) =>
    ['да', 'yes', '1', 'true'].includes(value.toLowerCase());
  const completed = records.filter((r) => yes(r.completed));
  const numbers = (column, rows = records) =>
    rows
      .map((r) => Number(r[column]))
      .filter((n) => Number.isFinite(n) && n >= 0);
  const times = numbers('time_s');
  const sus = records
    .map((r) => susScore(SUS_COLUMNS.map((c) => Number(r[c]))))
    .filter((score) => score !== null);
  return {
    participants: records.length,
    completed: completed.length,
    completionRate: completed.length / records.length,
    // Время считается по всем: незавершённые задачи не исключаются (протокол)
    time: times.length
      ? {
          median: median(times),
          min: Math.min(...times),
          max: Math.max(...times),
        }
      : null,
    errorsTotal: numbers('errors').reduce((a, b) => a + b, 0),
    hintsTotal: numbers('hints').reduce((a, b) => a + b, 0),
    sus: sus.length
      ? {
          n: sus.length,
          median: median(sus),
          min: Math.min(...sus),
          max: Math.max(...sus),
        }
      : null,
  };
};

const selfTest = () => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(`Самопроверка не пройдена: ${message}`);
  };
  // Лучший и худший возможные ответы
  assert(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]) === 100, 'SUS максимум');
  assert(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5]) === 0, 'SUS минимум');
  assert(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]) === 50, 'SUS середина');
  assert(susScore([3, 3, 3]) === null, 'SUS неполный');
  assert(
    susScore([6, 1, 5, 1, 5, 1, 5, 1, 5, 1]) === null,
    'SUS вне диапазона',
  );
  assert(median([3, 1, 2]) === 2 && median([1, 2, 3, 4]) === 2.5, 'медиана');
  assert(summarize([]).participants === 0, 'пустая таблица');
  const csv =
    'code,completed,time_s,errors,hints\nT1,да,100,1,0\n"T2",нет,1200,3,2\n';
  const summary = summarize(parseCsv(csv));
  assert(
    summary.participants === 2 && summary.completed === 1,
    'доля завершённых',
  );
  assert(
    summary.time.median === 650 && summary.errorsTotal === 4,
    'время и ошибки',
  );
  assert(summary.sus === null, 'без SUS');
  process.stdout.write(
    'Самопроверка пройдена (данные в ней вымышлены и не являются результатом).\n',
  );
};

const [argument] = process.argv.slice(2);
if (argument === '--self-test') {
  selfTest();
} else if (argument) {
  const records = parseCsv(readFileSync(argument, 'utf8'));
  const summary = summarize(records);
  if (summary.participants === 0) {
    process.stdout.write(
      'В таблице нет ни одного участника: результатов нет.\n',
    );
  } else {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  }
} else {
  process.stderr.write('Укажите CSV-файл или --self-test\n');
  process.exit(1);
}
