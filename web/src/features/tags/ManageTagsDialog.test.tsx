import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManageTagsDialog } from './ManageTagsDialog';

const state = vi.hoisted(() => ({
  tags: [] as unknown[],
  save: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../../api/hooks', () => ({
  useTags: () => ({ data: state.tags }),
  useSaveTag: () => ({ mutateAsync: state.save, isPending: false }),
  useDeleteTag: () => ({ mutateAsync: state.remove, isPending: false }),
}));

describe('Справочник меток', () => {
  beforeEach(() => {
    state.tags = [];
    state.save.mockReset().mockResolvedValue({});
    state.remove.mockReset().mockResolvedValue({});
  });

  it('подсказывает примеры, пока меток нет', () => {
    render(<ManageTagsDialog open onClose={vi.fn()} />);
    expect(screen.getByText(/Меток пока нет/)).toBeInTheDocument();
  });

  it('создаёт метку с выбранным цветом', async () => {
    render(<ManageTagsDialog open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Новая метка'), {
      target: { value: 'VIP' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith({
        name: 'VIP',
        color: '#3B82F6',
      }),
    );
  });

  it('удаляет метку', async () => {
    state.tags = [
      { tagId: 7, name: 'Тендер', color: '#0000AA', clientsCount: 2 },
    ];
    render(<ManageTagsDialog open onClose={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Удалить метку Тендер' }),
    );
    await waitFor(() => expect(state.remove).toHaveBeenCalledWith(7));
  });
});
