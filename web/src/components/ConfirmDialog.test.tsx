import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../theme/theme';
import { TOKENS } from '../theme/tokens';
import { ConfirmDialog } from './ConfirmDialog';

/** #B3352C → rgb(179, 53, 44): jsdom отдаёт вычисленный цвет в rgb(). */
const toRgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

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
    expect(getComputedStyle(confirm).backgroundColor).toBe(toRgb(TOKENS.danger));
  });

  it('отмена не выглядит как основное действие', () => {
    renderDialog();
    const cancel = screen.getByRole('button', { name: 'Отмена' });
    expect(getComputedStyle(cancel).backgroundColor).not.toBe(toRgb(TOKENS.danger));
  });
});
