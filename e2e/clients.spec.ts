import { expect, test } from '@playwright/test';
import { openSection, signIn, uniqueName } from './helpers';

test.describe('Работа с клиентом', () => {
  test('заводит клиента, правит и удаляет', async ({ page }) => {
    const name = uniqueName('ООО «Браузерная проверка»');
    await signIn(page, 'manager');
    await openSection(page, 'Клиенты');

    await page.getByRole('button', { name: 'Добавить клиента' }).click();
    // Поля ищутся внутри формы: на странице есть ещё поиск, подпись
    // которого тоже содержит «ИНН»
    const form = page.getByRole('dialog');
    await form.getByLabel('Наименование организации').fill(name);
    await form.getByLabel('ИНН').fill('7701234599');
    await form.getByRole('button', { name: 'Сохранить' }).click();

    // После сохранения приложение открывает карточку заведённого клиента
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('7701234599')).toBeVisible();

    await page.getByRole('button', { name: 'Редактировать' }).click();
    const editForm = page.getByRole('dialog');
    await editForm.getByLabel('Адрес').fill('Москва, Тверская, 1');
    await editForm.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('Москва, Тверская, 1')).toBeVisible();

    await page.getByRole('button', { name: 'Удалить' }).first().click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Удалить' })
      .click();

    await expect(page.getByRole('heading', { name: 'Клиенты' })).toBeVisible();
    await expect(page.getByText(name)).toBeHidden();
  });

  test('предупреждает о потере правок при закрытии формы', async ({ page }) => {
    await signIn(page, 'manager');
    await openSection(page, 'Клиенты');

    await page.getByRole('button', { name: 'Добавить клиента' }).click();
    const form = page.getByRole('dialog');
    await form
      .getByLabel('Наименование организации')
      .fill('ООО «Незавершённая правка»');
    await form.getByRole('button', { name: 'Отмена' }).click();

    // Форма на десяток полей не должна теряться от одного промаха
    await expect(
      page.getByRole('heading', { name: 'Закрыть без сохранения?' }),
    ).toBeVisible();

    // Подтверждение — второй диалог поверх формы
    const confirm = page.getByRole('dialog').filter({
      hasText: 'Закрыть без сохранения?',
    });
    await confirm.getByRole('button', { name: 'Отмена' }).click();
    await expect(form.getByLabel('Наименование организации')).toHaveValue(
      'ООО «Незавершённая правка»',
    );

    await form.getByRole('button', { name: 'Отмена' }).click();
    await confirm.getByRole('button', { name: 'Закрыть' }).click();
    await expect(page.getByText('ООО «Незавершённая правка»')).toBeHidden();
  });

  test('ищет клиента по наименованию', async ({ page }) => {
    await signIn(page, 'manager');
    await openSection(page, 'Клиенты');

    await page.getByLabel('Поиск по наименованию или ИНН').fill('ЦифраСофт');
    await expect(page.getByText('ООО «ЦифраСофт»')).toBeVisible();
    await expect(page.getByText('ПАО «Финанс-Инвест Групп»')).toBeHidden();
  });
});
