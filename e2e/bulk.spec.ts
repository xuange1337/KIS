import { expect, test } from '@playwright/test';
import { openSection, signIn, uniqueName } from './helpers';

test.describe('Массовые операции над клиентами', () => {
  test('меняет статус у нескольких карточек сразу', async ({ page }) => {
    const prefix = uniqueName('ООО «Пачка»');
    await signIn(page, 'head');
    await openSection(page, 'Клиенты');

    // Три карточки с общим началом названия: их легко найти поиском
    for (const suffix of ['А', 'Б']) {
      await page.getByRole('button', { name: 'Добавить клиента' }).click();
      const form = page.getByRole('dialog');
      await form
        .getByLabel('Наименование организации')
        .fill(`${prefix} ${suffix}`);
      await form.getByRole('button', { name: 'Сохранить' }).click();
      await expect(
        page.getByRole('heading', { name: `${prefix} ${suffix}` }),
      ).toBeVisible();
      await openSection(page, 'Клиенты');
    }

    await page.getByLabel('Поиск по наименованию или ИНН').fill(prefix);
    const rows = page.locator('.MuiDataGrid-row');
    await expect.poll(() => rows.count()).toBe(2);

    // Панель действий появляется только когда что-то отмечено
    await expect(page.getByText(/^Отмечено:/)).toBeHidden();
    await page.getByRole('checkbox', { name: 'Выбрать все строки' }).check();
    await expect(page.getByText('Отмечено: 2')).toBeVisible();

    await page.getByLabel('Статус').last().click();
    await page.getByRole('option', { name: 'Архив' }).click();
    await page.getByRole('button', { name: 'Применить' }).click();

    // После успеха отметки сняты, статус изменился у обеих карточек
    await expect(page.getByText(/^Отмечено:/)).toBeHidden();
    await expect(page.getByText('Архив').first()).toBeVisible();

    // Уборка: карточки удаляются, чтобы демонстрационные данные
    // оставались пригодными для показа
    for (const suffix of ['А', 'Б']) {
      await page
        .getByLabel('Поиск по наименованию или ИНН')
        .fill(`${prefix} ${suffix}`);
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

  test('менеджеру не предлагает смену ответственного', async ({ page }) => {
    await signIn(page, 'manager');
    await openSection(page, 'Клиенты');

    const rows = page.locator('.MuiDataGrid-row');
    await expect.poll(() => rows.count()).toBeGreaterThan(0);
    await page
      .getByRole('checkbox', { name: 'Выбрать строку' })
      .first()
      .check();

    await expect(page.getByText(/^Отмечено:/)).toBeVisible();
    // Права те же, что в карточке: менеджер не переназначает записи
    await expect(page.getByRole('button', { name: 'Назначить' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Применить' })).toBeVisible();
  });
});
