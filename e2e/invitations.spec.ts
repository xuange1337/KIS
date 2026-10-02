import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('Приглашение сотрудника', () => {
  test('администратор выдаёт ссылку, приглашённый заводит себя сам', async ({
    page,
    browser,
  }) => {
    const suffix = Date.now().toString().slice(-6);
    await signIn(page, 'admin');

    await page
      .getByRole('navigation', { name: 'Разделы системы' })
      .getByRole('link', { name: 'Пользователи', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Пользователи' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Пригласить' }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByLabel('Кому выдана ссылка (необязательно)')
      .fill(`Приглашённый ${suffix}`);
    await dialog.getByRole('button', { name: 'Создать ссылку' }).click();

    const url = await dialog.getByLabel('Ссылка приглашения').inputValue();
    expect(url).toContain('/invite?token=');
    await dialog.getByRole('button', { name: 'Закрыть' }).click();

    /**
     * Дальше действует приглашённый — в своём браузере: в текущем
     * открыт сеанс администратора, и страница предложила бы
     * присоединиться его учётной записью.
     */
    const invited = await browser.newContext();
    const invitedPage = await invited.newPage();
    await invitedPage.goto(url.replace(/^https?:\/\/[^/]+/, ''));

    await expect(invitedPage.getByText(/Вас приглашают/)).toBeVisible();
    await invitedPage.getByLabel('ФИО').fill(`Приглашённый ${suffix}`);
    await invitedPage.getByLabel('Логин').fill(`invited-${suffix}`);
    await invitedPage.getByLabel('Пароль').fill('parol-priglashyonnogo');
    await invitedPage
      .getByRole('button', { name: 'Принять приглашение' })
      .click();
    await expect(invitedPage.getByText(/Учётная запись создана/)).toBeVisible();

    // Администратор пароля не знает: сотрудник входит сам
    await invitedPage.getByRole('button', { name: 'Перейти ко входу' }).click();
    await invitedPage.getByLabel('Логин').fill(`invited-${suffix}`);
    await invitedPage.getByLabel('Пароль').fill('parol-priglashyonnogo');
    await invitedPage.getByRole('button', { name: 'Войти' }).click();
    await expect(invitedPage.getByRole('heading', { level: 4 })).toBeVisible();

    // Ссылка одноразовая
    const second = await browser.newContext();
    const secondPage = await second.newPage();
    await secondPage.goto(url.replace(/^https?:\/\/[^/]+/, ''));
    await expect(
      secondPage.getByText(/недействительна|недействительно/),
    ).toBeVisible();

    await invited.close();
    await second.close();
  });

  test('менеджеру приглашение недоступно', async ({ page }) => {
    await signIn(page, 'manager');
    // Раздела пользователей у менеджера нет вовсе
    await expect(page.getByRole('link', { name: 'Пользователи' })).toBeHidden();
  });
});
