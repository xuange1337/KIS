import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('Поиск по всем разделам', () => {
  test('открывается по Ctrl+K и ведёт к найденному клиенту', async ({
    page,
  }) => {
    await signIn(page, 'head');

    // Сочетание привычно по другим рабочим системам: во время разговора
    // с клиентом тянуться к мыши неудобно
    await page.keyboard.press('Control+k');
    const search = page.getByRole('dialog');
    await expect(search).toBeVisible();

    await page.getByLabel('Строка поиска').fill('ЦифраСофт');
    await expect(search.getByText('ООО «ЦифраСофт»').first()).toBeVisible();

    // Стрелка и Enter: выдача управляется с клавиатуры
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('heading', { name: 'ООО «ЦифраСофт»' }),
    ).toBeVisible();
  });

  test('показывает совпадения по разделам и сообщает о пустой выдаче', async ({
    page,
  }) => {
    await signIn(page, 'head');
    await page.getByRole('button', { name: 'Поиск по всем разделам' }).click();

    await page.getByLabel('Строка поиска').fill('ЦифраСофт');
    const search = page.getByRole('dialog');
    await expect(search.getByText('Клиенты')).toBeVisible();
    await expect(search.getByText('Сделки')).toBeVisible();

    await page.getByLabel('Строка поиска').fill('такого-точно-нет-12345');
    await expect(search.getByText('Ничего не найдено')).toBeVisible();
  });
});
