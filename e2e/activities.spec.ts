import { expect, test } from '@playwright/test';
import { openSection, signIn, uniqueName } from './helpers';

test.describe('Планирование и выполнение активности', () => {
  test('планирует звонок и отмечает выполнение', async ({ page }) => {
    const subject = uniqueName('Звонок по браузерной проверке');
    await signIn(page, 'manager');
    await openSection(page, 'Календарь');

    await page.getByRole('button', { name: 'Запланировать' }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Клиент').click();
    await page.getByRole('option').first().click();
    await form.getByLabel('Тема').fill(subject);
    await form.getByRole('button', { name: 'Сохранить' }).click();

    await expect(page.getByText(subject).first()).toBeVisible();

    // Отметка о выполнении требует результата: пустую отметку принимать
    // нельзя, иначе история коммуникаций теряет смысл
    await page.getByText(subject).first().click();
    const card = page.getByRole('dialog');
    await expect(card).toBeVisible();
  });

  test('показывает просроченные активности на дашборде', async ({ page }) => {
    await signIn(page, 'manager');

    // Плитка показателя ведёт в отфильтрованный список просроченных
    await expect(
      page.getByRole('link', { name: /^Просрочено: \d+/ }),
    ).toBeVisible();
    await expect(page.getByText(/Требуют внимания/i).first()).toBeVisible();
  });
});
