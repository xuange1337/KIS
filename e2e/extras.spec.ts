import { expect, test } from '@playwright/test';
import { openSection, signIn, uniqueName } from './helpers';

/** Создаёт клиента через форму и возвращается на список клиентов. */
async function createClient(
  page: import('@playwright/test').Page,
  name: string,
): Promise<void> {
  await openSection(page, 'Клиенты');
  await page.getByRole('button', { name: 'Добавить клиента' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Наименование организации').fill(name);
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test.describe('Дополнительные возможности рабочего места', () => {
  test('находит дубли клиентов и объединяет их', async ({ page }) => {
    const base = uniqueName('Дубль');
    await signIn(page, 'head');
    await createClient(page, `ООО «${base}»`);
    await createClient(page, `${base}, ООО`);

    await openSection(page, 'Клиенты');
    await page.getByRole('button', { name: 'Поиск дублей' }).click();
    await expect(
      page.getByRole('heading', { name: 'Дубли клиентов' }),
    ).toBeVisible();
    await expect(page.getByText(`ООО «${base}»`)).toBeVisible();

    await page
      .getByRole('button', { name: 'Объединить в выбранную' })
      .last()
      .click();
    await page.getByRole('button', { name: 'Объединить', exact: true }).click();
    await expect(page.getByText(/Объединено карточек: 1/)).toBeVisible();
    await expect(page.getByText(`ООО «${base}»`)).toBeHidden();
  });

  test('метка и избранное: ставит метку, фильтрует и сохраняет набор', async ({
    page,
  }) => {
    const name = uniqueName('ООО «Метка»');
    const tag = uniqueName('Метка');
    await signIn(page, 'head');
    await createClient(page, name);

    await openSection(page, 'Клиенты');
    await page.getByRole('button', { name: 'Метки', exact: true }).click();
    await page.getByLabel('Новая метка').fill(tag);
    await page.getByRole('button', { name: 'Добавить', exact: true }).click();
    await expect(page.getByText('клиентов: 0')).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть' }).click();

    await page.getByLabel('Поиск по наименованию или ИНН').fill(name);
    await page.getByText(name).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await page.getByPlaceholder('Добавить метку').click();
    await page.getByRole('option', { name: tag }).click();
    await expect(page.getByText(tag).first()).toBeVisible();

    // Звёздочка в карточке и фильтр «Только избранные» в списке
    await page.getByRole('button', { name: /^В избранное/ }).click();
    await openSection(page, 'Клиенты');
    await page.getByRole('button', { name: 'Только избранные' }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.getByRole('button', { name: /Сохранить текущие/ }).click();
    await page.getByLabel('Название набора').fill('Мои избранные');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Мои избранные')).toBeVisible();

    // Уборка: набор и метка удаляются, избранное снимается вместе с клиентом
    await page.getByLabel('Удалить набор «Мои избранные»').click();
    await page.getByRole('button', { name: 'Метки', exact: true }).click();
    await page.getByLabel(`Удалить метку ${tag}`).click();
    await page.getByRole('button', { name: 'Закрыть' }).click();
  });

  test('сделка: состав из каталога задаёт сумму, чек-лист и комментарий', async ({
    page,
  }) => {
    await signIn(page, 'head');
    await openSection(page, 'Сделки');
    await page.locator('.MuiDataGrid-row').first().click();
    await expect(page.getByText('Состав сделки')).toBeVisible();

    await page.getByRole('button', { name: 'Чек-лист' }).count();
    const item = uniqueName('Пункт');
    await page.getByLabel('Новый пункт').fill(item);
    await page.getByRole('button', { name: 'Добавить', exact: true }).click();
    await expect(page.getByText(item)).toBeVisible();
    await page.getByRole('checkbox', { name: item }).check();
    await expect(page.getByText(/\d из \d/)).toBeVisible();
    await page.getByLabel(`Удалить пункт ${item}`).click();
    await expect(page.getByText(item)).toBeHidden();

    const note = uniqueName('Заметка');
    await page.getByLabel('Новый комментарий').fill(note);
    await page.getByRole('button', { name: 'Отправить' }).click();
    await expect(page.getByText(note)).toBeVisible();
    await page
      .getByRole('button', { name: 'Удалить комментарий' })
      .first()
      .click();
    await expect(page.getByText(note)).toBeHidden();
  });

  test('воронки: руководитель создаёт воронку, она появляется в фильтре', async ({
    page,
  }) => {
    const name = uniqueName('Воронка');
    await signIn(page, 'head');
    await openSection(page, 'Сделки');
    await page.getByRole('button', { name: 'Воронки' }).click();
    await page.getByLabel('Название новой воронки').fill(name);
    await page.getByRole('button', { name: 'Создать воронку' }).click();
    await expect(page.getByText(name)).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть' }).click();
    await expect(page.getByLabel('Воронка')).toBeVisible();

    // Уборка
    await page.getByRole('button', { name: 'Воронки' }).click();
    await page.getByLabel(`Удалить воронку ${name}`).click();
    await expect(page.getByText(name)).toBeHidden();
  });

  test('аналитика, справка и уведомления открываются', async ({ page }) => {
    await signIn(page, 'head');
    await openSection(page, 'Аналитика');
    await expect(page.getByText('Прогноз по месяцам')).toBeVisible();
    await expect(page.getByText('Конверсия воронки')).toBeVisible();
    await expect(page.getByText('Менеджеры', { exact: true })).toBeVisible();

    await openSection(page, 'Справка');
    await expect(page.getByText('Горячие клавиши')).toBeVisible();

    await page.getByRole('button', { name: /^Уведомления/ }).click();
    await expect(
      page.getByRole('button', { name: 'Прочитать все' }),
    ).toBeVisible();
  });

  test('менеджер не видит настроек руководителя', async ({ page }) => {
    await signIn(page, 'manager');
    await openSection(page, 'Клиенты');
    await expect(page.getByRole('button', { name: 'Поля' })).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Метки', exact: true }),
    ).toBeHidden();
    await openSection(page, 'Сделки');
    await expect(page.getByRole('button', { name: 'Воронки' })).toBeHidden();
  });
});
