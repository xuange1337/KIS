import { expect, test } from '@playwright/test';
import { openSection, signIn, uniqueName } from './helpers';

test.describe('Сделка от заведения до смены стадии', () => {
  test('заводит сделку, переводит стадию и пишет историю', async ({ page }) => {
    const title = uniqueName('Поставка по браузерной проверке');
    await signIn(page, 'manager');
    await openSection(page, 'Сделки');

    await page.getByRole('button', { name: 'Создать сделку' }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Клиент').click();
    await page.getByRole('option').first().click();
    await form.getByLabel('Наименование сделки').fill(title);
    await form.getByLabel('Сумма').fill('250000');
    await form.getByRole('button', { name: 'Сохранить' }).click();

    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // Стадия меняется отдельной операцией и попадает в историю
    await page.getByLabel('Текущая стадия').click();
    await page.getByRole('option', { name: 'Квалификация' }).click();

    // В истории две записи: заведение сделки и перевод стадии
    const history = page.getByText('История стадий').locator('..');
    await expect(history.getByText('Квалификация').first()).toBeVisible();
    await expect(history.getByText('Первичный контакт').first()).toBeVisible();

    await page.getByRole('button', { name: 'Удалить' }).first().click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Удалить' })
      .click();
    await expect(page.getByRole('heading', { name: 'Сделки' })).toBeVisible();
  });

  test('канбан показывает сделки по стадиям', async ({ page }) => {
    await signIn(page, 'manager');
    await openSection(page, 'Сделки');

    await page.getByRole('button', { name: 'Канбан по стадиям' }).click();
    // Колонки воронки соответствуют стадиям сделки
    for (const stage of ['Первичный контакт', 'Квалификация', 'Предложение']) {
      await expect(page.getByText(stage).first()).toBeVisible();
    }
  });
});
