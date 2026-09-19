import { performance } from 'node:perf_hooks';

/**
 * Нагрузочный smoke-тест API.
 *
 * Не заменяет полноценное нагрузочное тестирование: цель — поймать
 * грубые регрессии, которые не видны на одиночном запросе. Список,
 * выдаваемый за 40 мс в тесте, может занимать секунды под десятком
 * параллельных клиентов — например, когда запрос перестал попадать в
 * индекс или появилась выборка N+1.
 *
 * Запуск: node scripts/load-test.mjs [--url http://localhost:8080]
 *
 * Переменные окружения:
 *   LOAD_USERS       число параллельных клиентов (по умолчанию 10)
 *   LOAD_REQUESTS    запросов на клиента (по умолчанию 20)
 *   LOAD_P95_MS      предел 95-го перцентиля, мс (по умолчанию 800)
 */

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const BASE_URL = arg('--url', process.env.BASE_URL ?? 'http://localhost:8080');
const USERS = Number(process.env.LOAD_USERS ?? 10);
const REQUESTS = Number(process.env.LOAD_REQUESTS ?? 20);
const P95_BUDGET = Number(process.env.LOAD_P95_MS ?? 800);

/** Проверяемые маршруты: список, карточка, отчёт и дашборд. */
const ROUTES = [
  '/api/clients?limit=25',
  '/api/deals?limit=25',
  '/api/activities?limit=25',
  '/api/dashboard',
  '/api/reports/funnel',
];

const login = async () => {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'manager', password: 'manager123' }),
  });
  if (!response.ok) {
    throw new Error(`Вход не выполнен: ${response.status}`);
  }
  return (await response.json()).accessToken;
};

const percentile = (values, share) => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * share));
  return Math.round(sorted[index]);
};

const run = async () => {
  const token = await login();
  const headers = { Authorization: `Bearer ${token}` };
  const durations = [];
  let failures = 0;

  const worker = async (workerIndex) => {
    for (let index = 0; index < REQUESTS; index += 1) {
      const route = ROUTES[(workerIndex + index) % ROUTES.length];
      const started = performance.now();
      try {
        const response = await fetch(`${BASE_URL}${route}`, { headers });
        if (!response.ok) failures += 1;
        await response.arrayBuffer();
      } catch {
        failures += 1;
      }
      durations.push(performance.now() - started);
    }
  };

  const started = performance.now();
  await Promise.all(Array.from({ length: USERS }, (_, index) => worker(index)));
  const elapsed = (performance.now() - started) / 1000;

  const total = durations.length;
  const p50 = percentile(durations, 0.5);
  const p95 = percentile(durations, 0.95);
  const max = Math.round(Math.max(...durations));
  const rps = Math.round(total / elapsed);

  process.stdout.write(
    `Клиентов ${USERS}, запросов ${total} за ${elapsed.toFixed(1)} с\n` +
      `Пропускная способность: ${rps} запросов/с\n` +
      `Задержка: p50 ${p50} мс, p95 ${p95} мс, максимум ${max} мс\n` +
      `Ошибок: ${failures}\n`,
  );

  if (failures > 0) {
    process.stderr.write('Под нагрузкой появились ошибки ответов\n');
    process.exit(1);
  }
  if (p95 > P95_BUDGET) {
    process.stderr.write(
      `95-й перцентиль ${p95} мс превышает предел ${P95_BUDGET} мс\n`,
    );
    process.exit(1);
  }
};

run().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
