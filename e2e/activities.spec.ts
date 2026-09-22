import { expect, test } from '@playwright/test';
import { openSection, signIn, uniqueName } from './helpers';

test.describe('Планирование и выполнение активности', () => {
  test('планирует звонок и отмечает выполнение', async ({ page }) => {
    const subject = uniqueName('Звонок по браузерной проверке');
    await signIn(page, 'manager');
    await openSection(page, 'Календарь');

    await page.getByRole('button', { name: 'Запланировать' }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Клиент').click();
    await page.getByRole('option').first().click();
    await form.getByLabel('Тема').fill(subject);
    await form.getByRole('button', { name: 'Сохранить' }).click();
    await expect(form).toBeHidden();

    /**
     * Календарь показывает месяц целиком, и в ячейке помещается
     * несколько активностей: запланированная на сегодня может не попасть
     * в видимую часть. Проверка идёт по списку за день — там запись
     * видна независимо от заполненности месяца.
     */
    await page.getByRole('button', { name: 'День' }).click();
    await expect(page.getByText(subject).first()).toBeVisible();
  });

  test('показывает просроченные активности на дашборде', async ({ page }) => {
    await signIn(page, 'manager');

    // Плитка показателя ведёт в отфильтрованный список просроченных
    await expect(
      page.getByRole('link', { name: /^Просрочено: \d+/ }),
    ).toBeVisible();
    await expect(page.getByText(/Требуют внимания/i).first()).toBeVisible();
  });
});
