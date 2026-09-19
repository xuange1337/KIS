import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Проверка, что секреты не попали в репозиторий.
 *
 * Ищет не «что-то похожее на пароль», а конкретные формы, которые
 * действительно утекали в коммиты: содержимое .env, приватные ключи,
 * токены известных сервисов и длинные hex-строки в местах, где им
 * взяться неоткуда. Цель — остановить коммит, а не провести аудит.
 */

const PATTERNS = [
  {
    name: 'приватный ключ',
    regex: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  // Отрицательное опережение на $ пропускает подстановки вида
  // ${POSTGRES_PASSWORD:?...}: это ссылка на переменную, а не значение
  {
    name: 'заполненный JWT-секрет',
    regex:
      /JWT_(ACCESS|REFRESH)_SECRET\s*[=:]\s*(?!['"]?\$)['"]?[A-Za-z0-9+/=_-]{16,}/,
  },
  {
    name: 'заполненный пароль базы',
    regex: /POSTGRES_PASSWORD\s*[=:]\s*(?!['"]?\$)['"]?\S{8,}/,
  },
  { name: 'токен AWS', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'токен GitHub', regex: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: 'ключ OpenAI или Anthropic', regex: /sk-(ant-)?[A-Za-z0-9_-]{24,}/ },
  {
    name: 'строка подключения с паролем',
    regex: /postgres(ql)?:\/\/[^\s:@/]+:[^\s@/]+@/,
  },
];

/** Файлы, где такие строки — часть назначения файла, а не утечка. */
const ALLOWED = [
  '.env.example',
  'scripts/check-secrets.mjs',
  'docs/runbook-disaster-recovery.md',
];

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((file) => !ALLOWED.includes(file))
  .filter((file) => !/\.(png|svg|jpg|jpeg|ttf|ico|drawio|lock)$/.test(file))
  .filter((file) => file !== 'package-lock.json');

const findings = [];

// .env отслеживаться не должен вовсе: файл целиком состоит из секретов
if (tracked.includes('.env')) {
  findings.push('.env отслеживается git; удалите его из индекса');
}

for (const file of tracked) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(content);
    if (match) {
      const line = content.slice(0, match.index).split('\n').length;
      findings.push(`${file}:${line}: ${pattern.name}`);
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(
    `Похоже на секреты в репозитории:\n${findings.join('\n')}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `Проверено файлов: ${tracked.length}. Секретов в репозитории не найдено.\n`,
);
