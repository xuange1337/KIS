import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('Оформление и узкий экран', () => {
  test('переключает схему и помнит выбор', async ({ page }) => {
    await signIn(page, 'manager');

    const html = page.locator('html');
    const toggle = page.getByRole('button', { name: /^Оформление/ });

    // Переключатель перебирает три состояния: как в системе, светлое,
    // тёмное. Отсюда и до тёмного — не более трёх нажатий
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if ((await html.getAttribute('data-theme')) === 'dark') break;
      await toggle.click();
    }
    await expect.poll(() => html.getAttribute('data-theme')).toBe('dark');

    // Выбор переживает перезагрузку: иначе тёмная схема сбрасывалась бы
    // при каждом открытии
    await page.reload();
    await expect.poll(() => html.getAttribute('data-theme')).toBe('dark');

    // Схема возвращается к светлой, чтобы следующие сценарии и показ
    // стенда начинались с обычного вида
    await toggle.click();
    await expect.poll(() => html.getAttribute('data-theme')).toBe('light');
  });

  test('на узком экране меню убрано в панель', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await signIn(page, 'manager');

    // На телефоне постоянное меню отнимает шестую часть ширины
    await expect(page.getByRole('link', { name: 'Клиенты' })).toBeHidden();
    await page.getByRole('button', { name: 'Открыть меню' }).click();
    await page.getByRole('link', { name: 'Клиенты', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Клиенты' })).toBeVisible();
    // Панель закрывается при переходе, страница не едет по горизонтали
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });

  test('первым по клавише Tab идёт пропуск навигации', async ({ page }) => {
    await signIn(page, 'manager');
    await page.keyboard.press('Tab');

    const focused = await page.evaluate(
      () => document.activeElement?.textContent,
    );
    expect(focused).toBe('Перейти к содержимому');
  });
});
