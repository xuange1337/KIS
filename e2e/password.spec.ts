import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('Пароль пользователя', () => {
  test('администратор выдаёт ссылку, сотрудник сам задаёт пароль', async ({
    page,
    browser,
  }) => {
    const suffix = Date.now().toString().slice(-6);
    const login = `e2e-reset-${suffix}`;
    const fullName = `Сотрудник Проверки ${suffix}`;
    await signIn(page, 'admin');

    await page
      .getByRole('navigation', { name: 'Разделы системы' })
      .getByRole('link', { name: 'Пользователи', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Пользователи' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Добавить пользователя' }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Логин').fill(login);
    await form.getByLabel('Пароль').fill('nachalnyy-parol');
    await form.getByLabel('ФИО').fill(fullName);
    await form.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText(fullName)).toBeVisible();

    // Администратор передаёт ссылку и нового пароля не знает
    await page
      .getByRole('button', { name: `Ссылка на смену пароля: ${fullName}` })
      .click();
    const linkDialog = page.getByRole('dialog');
    const url = await linkDialog
      .getByLabel('Ссылка на смену пароля')
      .inputValue();
    expect(url).toContain('/set-password?token=');
    await linkDialog.getByRole('button', { name: 'Закрыть' }).click();

    /**
     * Дальше действует сам сотрудник — в своём браузере.
     * Отдельный контекст нужен не для чистоты сценария: в текущем
     * открыта сессия администратора, и переход на страницу входа
     * возвращал бы на его рабочий стол.
     */
    const employee = await browser.newContext();
    const employeePage = await employee.newPage();
    const path = url.replace(/^https?:\/\/[^/]+/, '');

    await employeePage.goto(path);
    await employeePage
      .getByRole('textbox', { name: 'Новый пароль', exact: true })
      .fill('moy-novyy-parol');
    await employeePage
      .getByRole('textbox', { name: 'Новый пароль ещё раз' })
      .fill('moy-novyy-parol');
    await employeePage
      .getByRole('button', { name: 'Установить пароль' })
      .click();
    await expect(employeePage.getByText(/Пароль установлен/)).toBeVisible();

    await employeePage.getByRole('link', { name: 'Перейти ко входу' }).click();
    await employeePage.getByLabel('Логин').fill(login);
    await employeePage.getByLabel('Пароль').fill('moy-novyy-parol');
    await employeePage.getByRole('button', { name: 'Войти' }).click();
    await expect(employeePage.getByRole('heading', { level: 4 })).toBeVisible();

    // Ссылка одноразовая: повторный переход по ней не срабатывает
    const second = await browser.newContext();
    const secondPage = await second.newPage();
    await secondPage.goto(path);
    await secondPage
      .getByRole('textbox', { name: 'Новый пароль', exact: true })
      .fill('eshchyo-parol');
    await secondPage
      .getByRole('textbox', { name: 'Новый пароль ещё раз' })
      .fill('eshchyo-parol');
    await secondPage.getByRole('button', { name: 'Установить пароль' }).click();
    await expect(
      secondPage.getByText(/недействительна или уже использована/),
    ).toBeVisible();

    await employee.close();
    await second.close();
  });

  test('меняет собственный пароль через меню', async ({ page }) => {
    await signIn(page, 'manager2');

    await page.getByRole('button', { name: 'Выйти из системы' }).click();
    await page.getByRole('menuitem', { name: 'Сменить пароль' }).click();

    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('textbox', { name: 'Текущий пароль' })
      .fill('manager123');
    await dialog
      .getByRole('textbox', { name: 'Новый пароль', exact: true })
      .fill('novyy-manager-parol');
    await dialog
      .getByRole('textbox', { name: 'Новый пароль ещё раз' })
      .fill('novyy-manager-parol');
    await dialog.getByRole('button', { name: 'Сменить пароль' }).click();
    await expect(dialog.getByText(/Пароль изменён/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Закрыть' }).click();

    // Возвращаем прежний пароль, чтобы стенд оставался пригодным
    // для показа и для остальных сценариев
    await page.getByRole('button', { name: 'Выйти из системы' }).click();
    await page.getByRole('menuitem', { name: 'Сменить пароль' }).click();
    const back = page.getByRole('dialog');
    await back
      .getByRole('textbox', { name: 'Текущий пароль' })
      .fill('novyy-manager-parol');
    await back
      .getByRole('textbox', { name: 'Новый пароль', exact: true })
      .fill('manager123');
    await back
      .getByRole('textbox', { name: 'Новый пароль ещё раз' })
      .fill('manager123');
    await back.getByRole('button', { name: 'Сменить пароль' }).click();
    await expect(back.getByText(/Пароль изменён/)).toBeVisible();
  });
});
