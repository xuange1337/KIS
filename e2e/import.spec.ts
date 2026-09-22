import { expect, test } from '@playwright/test';
import { openSection, signIn } from './helpers';

test.describe('Загрузка клиентов из файла', () => {
  test('показывает предпросмотр с ошибками и загружает годные строки', async ({
    page,
  }) => {
    await signIn(page, 'head');
    await openSection(page, 'Клиенты');

    await page.getByRole('button', { name: 'Загрузить из файла' }).click();
    const dialog = page.getByRole('dialog');

    await dialog
      .getByLabel('Файл для загрузки')
      .setInputFiles('e2e/fixtures/clients.csv');

    // Сначала видно, что именно будет создано и что отбраковано:
    // разбирать кривые строки в уже загруженной базе некому
    await expect(dialog.getByText('Готовы к загрузке: 2')).toBeVisible();
    await expect(dialog.getByText('С ошибками: 1')).toBeVisible();
    await expect(
      dialog.getByText(/Наименование короче двух символов/),
    ).toBeVisible();

    await dialog.getByRole('button', { name: /Загрузить 2 строк/ }).click();
    await expect(dialog.getByText(/Загружено карточек: 2/)).toBeVisible();

    await dialog.getByRole('button', { name: 'Закрыть' }).click();

    // Уборка: загруженные карточки удаляются, чтобы повторный прогон
    // не упирался в дубли
    const rows = page.locator('.MuiDataGrid-row');
    for (const name of ['Импорт из браузера А', 'Импорт из браузера Б']) {
      await page.getByLabel('Поиск по наименованию или ИНН').fill(name);
      await expect.poll(() => rows.count()).toBe(1);
      await rows.first().click();
      await page.getByRole('button', { name: 'Удалить' }).first().click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Удалить' })
        .click();
      await expect(
        page.getByRole('heading', { name: 'Клиенты' }),
      ).toBeVisible();
    }
  });

  test('менеджеру загрузка недоступна', async ({ page }) => {
    await signIn(page, 'manager');
    await openSection(page, 'Клиенты');

    await expect(
      page.getByRole('button', { name: 'Загрузить из файла' }),
    ).toBeHidden();
  });
});
