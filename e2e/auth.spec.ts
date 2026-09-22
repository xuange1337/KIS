import { expect, test } from '@playwright/test';
import { ACCOUNTS, signIn } from './helpers';

test.describe('Вход и разграничение доступа', () => {
  test('отклоняет неверный пароль и не пускает дальше формы', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('Логин').fill(ACCOUNTS.manager.login);
    await page.getByLabel('Пароль').fill('nevernyy-parol');
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page.getByText(/Неверный логин или пароль/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Клиенты' })).toBeHidden();
  });

  test('пускает менеджера и показывает его имя', async ({ page }) => {
    await signIn(page, 'manager');
    await expect(page.getByText('Орлов Григорий Николаевич')).toBeVisible();
  });

  test('менеджер не видит раздел пользователей, администратор видит', async ({
    page,
  }) => {
    await signIn(page, 'manager');
    // Раздел закрыт ролью: его нет в меню, а прямой переход не открывает
    await expect(page.getByRole('link', { name: 'Пользователи' })).toBeHidden();

    await page.goto('/users');
    await expect(
      page.getByRole('heading', { name: 'Пользователи' }),
    ).toBeHidden();

    await page.context().clearCookies();
    await signIn(page, 'admin');
    await expect(
      page.getByRole('link', { name: 'Пользователи' }),
    ).toBeVisible();
  });

  test('выход возвращает на форму входа', async ({ page }) => {
    await signIn(page, 'manager');
    await page.getByRole('button', { name: 'Выйти из системы' }).click();
    await page.getByRole('menuitem', { name: 'Выйти из системы' }).click();

    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  });
});
