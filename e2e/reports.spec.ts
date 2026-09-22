import { expect, test } from '@playwright/test';
import { openSection, signIn } from './helpers';

test.describe('Отчёты и выгрузки', () => {
  test('строит воронку и считает итог', async ({ page }) => {
    await signIn(page, 'head');
    await openSection(page, 'Отчёты');

    await expect(page.getByText('Сумма сделок по стадиям')).toBeVisible();
    await expect(page.getByText('Итого')).toBeVisible();
  });

  test('выгружает отчёт в CSV', async ({ page }) => {
    await signIn(page, 'head');
    await openSection(page, 'Отчёты');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV' }).click();
    const file = await download;

    expect(file.suggestedFilename()).toMatch(/^funnel-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('формирует выгрузку в фоне и отдаёт файл', async ({ page }) => {
    await signIn(page, 'head');
    await openSection(page, 'Отчёты');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'В фоне' }).click();
    // Состояние задания показывается, пока файл формируется
    const file = await download;

    expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test('переключает отчёты по вкладкам', async ({ page }) => {
    await signIn(page, 'head');
    await openSection(page, 'Отчёты');

    await page.getByRole('tab', { name: 'Активности менеджеров' }).click();
    await expect(page.getByText('Орлов Григорий Николаевич')).toBeVisible();

    await page.getByRole('tab', { name: 'Просроченные активности' }).click();
    await expect(page.getByRole('heading', { name: 'Отчёты' })).toBeVisible();
  });
});
