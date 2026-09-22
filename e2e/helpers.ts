import { Page, expect } from '@playwright/test';

/** Демонстрационные учётные записи стенда. */
export const ACCOUNTS = {
  manager: { login: 'manager', password: 'manager123' },
  head: { login: 'head', password: 'head123' },
  admin: { login: 'admin', password: 'admin123' },
} as const;

/** Вход через форму — как это делает пользователь. */
export async function signIn(
  page: Page,
  account: keyof typeof ACCOUNTS = 'manager',
): Promise<void> {
  const { login, password } = ACCOUNTS[account];
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  // Признак входа — заголовок рабочего экрана: ссылки меню на телефоне
  // убраны в панель и не видны, пока её не открыли
  await expect(page.getByRole('heading', { level: 4 })).toBeVisible();
}

/** Переход по разделу меню. */
export async function openSection(page: Page, name: string): Promise<void> {
  const burger = page.getByRole('button', { name: 'Открыть меню' });
  if (await burger.isVisible()) {
    await burger.click();
  }
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 4 })).toBeVisible();
}

/** Уникальное имя записи: прогоны не должны конфликтовать между собой. */
export const uniqueName = (prefix: string): string =>
  `${prefix} ${Date.now().toString().slice(-6)}`;
