import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../theme/theme';
import { TOKENS } from '../theme/tokens';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Цвета задаются CSS-переменными, и сравнивается именно ссылка на
 * переменную: конкретное значение зависит от схемы оформления, а
 * проверяется здесь не оттенок, а то, что кнопка взяла цвет опасного
 * действия, а не какой-то другой.
 */
function renderDialog() {
  render(
    <ThemeProvider theme={theme}>
      <ConfirmDialog
        open
        title="Удалить клиента?"
        message="Действие необратимо"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe('ConfirmDialog', () => {
  // Общий override слота contained перебивал containedError, и кнопка
  // необратимого действия выходила чёрной — неотличимой от обычной
  it('подтверждение удаления окрашено в цвет опасного действия', () => {
    renderDialog();
    const confirm = screen.getByRole('button', { name: 'Удалить' });
    expect(getComputedStyle(confirm).backgroundColor).toBe(TOKENS.danger);
  });

  it('отмена не выглядит как основное действие', () => {
    renderDialog();
    const cancel = screen.getByRole('button', { name: 'Отмена' });
    expect(getComputedStyle(cancel).backgroundColor).not.toBe(TOKENS.danger);
  });
});
