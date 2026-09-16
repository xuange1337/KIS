import { readFile } from 'node:fs/promises';

const allowedLicenses = new Set([
  '(MIT AND BSD-3-Clause)',
  '(MIT AND Zlib)',
  '(MIT OR GPL-3.0-or-later)',
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  'ISC',
  'MIT',
  'MIT AND ISC',
  'MIT/X11',
  'OFL-1.1',
  'Unlicense',
]);

const verifiedMissingMetadata = new Set([
  'buffers',
  'busboy',
  'passport-strategy',
  'pause',
  'png-js',
  'streamsearch',
]);

const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const violations = [];
let checked = 0;

for (const [path, metadata] of Object.entries(lock.packages)) {
  if (!path.includes('node_modules') || metadata.dev === true) continue;
  const name = path.split('node_modules/').at(-1);
  if (name.startsWith('@crm/')) continue;
  checked += 1;
  if (!metadata.license && verifiedMissingMetadata.has(name)) continue;
  if (!metadata.license || !allowedLicenses.has(metadata.license)) {
    violations.push(`${name}@${metadata.version ?? 'unknown'}: ${metadata.license ?? 'UNKNOWN'}`);
  }
}

if (violations.length > 0) {
  process.stderr.write(`Обнаружены непроверенные лицензии:\n${violations.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`Проверено production-пакетов: ${checked}. Запрещённых лицензий нет.\n`);
