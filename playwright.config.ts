import { defineConfig, devices } from '@playwright/test';

/**
 * Браузерные проверки критических потоков.
 *
 * Работают по собранному стенду (docker compose), а не по dev-серверу:
 * проверяется то, что уходит пользователю, — собранный фронтенд за nginx
 * и настоящий API с миграциями. Тесты создают и удаляют свои записи,
 * поэтому демонстрационные данные остаются пригодными для показа.
 */
export default defineConfig({
  testDir: './e2e',
  // Потоки идут по одним и тем же данным: параллельный прогон
  // перемешивал бы записи между сценариями
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    // Снимок и трасса только на упавшем сценарии: на зелёном прогоне
    // они занимают место и ничего не добавляют
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
