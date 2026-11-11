import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChecklistPanel } from './ChecklistPanel';

const state = vi.hoisted(() => ({
  items: [] as unknown[],
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../../api/hooks', () => ({
  useChecklist: () => ({ data: state.items, isError: false }),
  useChecklistActions: () => ({
    add: { mutateAsync: state.add, isPending: false },
    update: { mutateAsync: state.update, isPending: false },
    remove: { mutateAsync: state.remove, isPending: false },
  }),
}));

describe('Чек-лист', () => {
  beforeEach(() => {
    state.items = [];
    state.add.mockReset().mockResolvedValue({});
    state.update.mockReset().mockResolvedValue({});
    state.remove.mockReset().mockResolvedValue({});
  });

  it('подсказывает, что делать с пустым списком', () => {
    render(<ChecklistPanel type="deal" id={1} />);
    expect(screen.getByText(/Пунктов нет/)).toBeInTheDocument();
  });

  it('добавляет пункт и очищает поле', async () => {
    render(<ChecklistPanel type="deal" id={1} />);
    const input = screen.getByLabelText('Новый пункт');
    fireEvent.change(input, { target: { value: 'Позвонить' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    await waitFor(() => expect(state.add).toHaveBeenCalledWith('Позвонить'));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('показывает ход выполнения и отмечает пункт', async () => {
    state.items = [
      { itemId: 1, text: 'Первый', isDone: true, position: 1, doneAt: null },
      { itemId: 2, text: 'Второй', isDone: false, position: 2, doneAt: null },
    ];
    render(<ChecklistPanel type="client" id={5} />);
    expect(screen.getByText('1 из 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Второй' }));
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({ itemId: 2, isDone: true }),
    );
  });
});
