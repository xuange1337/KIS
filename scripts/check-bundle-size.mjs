import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

/**
 * Бюджет размера клиентского бандла.
 *
 * Размер растёт незаметно: каждая отдельная зависимость добавляет
 * «немного», а через полгода первая загрузка на медленной сети занимает
 * десятки секунд. Проверка фиксирует достигнутый уровень, чтобы
 * ухудшение обсуждалось осознанно, а не обнаруживалось у пользователя.
 *
 * Сравнивается сжатый размер: по сети едет именно он.
 */

/** Пределы в килобайтах после gzip. */
const BUDGET = {
  /** Самый крупный отдельный чанк: с ним ждут первую отрисовку. */
  largestChunk: 200,
  /** Весь JavaScript сборки: он загрузится при обходе всех страниц. */
  totalJs: 700,
  /** Стили. */
  totalCss: 60,
};

const assetsDir = 'web/dist/assets';

let files;
try {
  files = readdirSync(assetsDir);
} catch {
  process.stderr.write(
    `Каталог ${assetsDir} не найден. Сначала выполните: npm run build -w @crm/web\n`,
  );
  process.exit(1);
}

const gzipKb = (path) =>
  Math.round((gzipSync(readFileSync(path)).length / 1024) * 10) / 10;

let totalJs = 0;
let totalCss = 0;
let largest = { name: '', size: 0 };

for (const file of files) {
  const path = join(assetsDir, file);
  if (!statSync(path).isFile()) continue;
  const size = gzipKb(path);
  if (file.endsWith('.js')) {
    totalJs += size;
    if (size > largest.size) largest = { name: file, size };
  } else if (file.endsWith('.css')) {
    totalCss += size;
  }
}

const round = (value) => Math.round(value * 10) / 10;
const checks = [
  ['крупнейший чанк', round(largest.size), BUDGET.largestChunk, largest.name],
  ['весь JavaScript', round(totalJs), BUDGET.totalJs, ''],
  ['все стили', round(totalCss), BUDGET.totalCss, ''],
];

const exceeded = checks.filter(([, actual, budget]) => actual > budget);

for (const [name, actual, budget, detail] of checks) {
  const mark = actual > budget ? '✗' : '✓';
  process.stdout.write(
    `${mark} ${name}: ${actual} КБ gzip из ${budget} КБ${detail ? ` (${detail})` : ''}\n`,
  );
}

if (exceeded.length > 0) {
  process.stderr.write(
    'Бюджет размера бандла превышен. Либо уменьшите сборку, ' +
      'либо осознанно поднимите предел в scripts/check-bundle-size.mjs\n',
  );
  process.exit(1);
}
