import { expect, test } from '@playwright/test';
import { openSection, signIn, uniqueName } from './helpers';

test.describe('Проигрыш сделки', () => {
  test('спрашивает причину и показывает её в карточке и отчёте', async ({
    page,
  }) => {
    const title = uniqueName('Сделка для проигрыша');
    await signIn(page, 'head');
    await openSection(page, 'Сделки');

    await page.getByRole('button', { name: 'Создать сделку' }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Клиент').click();
    await page.getByRole('option').first().click();
    await form.getByLabel('Наименование сделки').fill(title);
    await form.getByLabel('Сумма').fill('310000');
    await form.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.getByLabel('Текущая стадия').click();
    await page.getByRole('option', { name: 'Сделка проиграна' }).click();

    // Причина спрашивается в тот момент, когда менеджер ещё помнит
    // разговор: заполнить её «потом» не заполняет никто
    const loss = page.getByRole('dialog');
    await expect(
      loss.getByRole('heading', { name: 'Почему сделка проиграна?' }),
    ).toBeVisible();
    await loss.getByLabel('Причина').click();
    await page.getByRole('option', { name: 'Выбрали конкурента' }).click();
    await loss.getByRole('button', { name: 'Закрыть как проигранную' }).click();

    await expect(page.getByText('Выбрали конкурента')).toBeVisible();

    await openSection(page, 'Отчёты');
    await page.getByRole('tab', { name: 'Причины проигрыша' }).click();
    await expect(
      page.getByText('Сумма проигранных сделок по причинам'),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Выбрали конкурента' }),
    ).toBeVisible();
  });

  test('не закрывает сделку, пока причина не выбрана', async ({ page }) => {
    const title = uniqueName('Сделка без причины');
    await signIn(page, 'head');
    await openSection(page, 'Сделки');

    await page.getByRole('button', { name: 'Создать сделку' }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Клиент').click();
    await page.getByRole('option').first().click();
    await form.getByLabel('Наименование сделки').fill(title);
    await form.getByLabel('Сумма').fill('100000');
    await form.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.getByLabel('Текущая стадия').click();
    await page.getByRole('option', { name: 'Сделка проиграна' }).click();

    const loss = page.getByRole('dialog');
    await expect(
      loss.getByRole('button', { name: 'Закрыть как проигранную' }),
    ).toBeDisabled();

    await loss.getByRole('button', { name: 'Отмена' }).click();
    // Стадия не изменилась: отказ не оставляет сделку в половинчатом виде.
    // Список стадий — не поле ввода, поэтому проверяется показанный текст
    await expect(page.getByLabel('Текущая стадия')).toHaveText(
      'Первичный контакт',
    );

    await page.getByRole('button', { name: 'Удалить' }).first().click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Удалить' })
      .click();
  });
});
