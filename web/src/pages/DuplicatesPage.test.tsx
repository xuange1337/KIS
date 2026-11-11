import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DuplicatesPage } from './DuplicatesPage';

const state = vi.hoisted(() => ({
  data: [] as unknown[],
  mutateAsync: vi.fn(),
}));
vi.mock('../api/hooks', () => ({
  useDuplicateClients: () => ({
    data: state.data,
    isLoading: false,
    isError: false,
  }),
  useMergeClients: () => ({
    mutateAsync: state.mutateAsync,
    isPending: false,
  }),
}));

const group = {
  key: 1,
  reasons: ['inn', 'name'],
  clients: [
    {
      clientId: 1,
      name: 'ООО Альфа',
      inn: '7701',
      status: 'lead',
      ownerName: 'Иванов',
      contactsCount: 0,
      dealsCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      clientId: 2,
      name: 'Альфа',
      inn: '7701',
      status: 'lead',
      ownerName: 'Иванов',
      contactsCount: 2,
      dealsCount: 3,
      createdAt: '2026-02-01T00:00:00Z',
    },
  ],
};

describe('Дубли клиентов', () => {
  beforeEach(() => {
    state.data = [];
    state.mutateAsync.mockReset().mockResolvedValue({
      mergedCount: 1,
      movedContacts: 0,
      movedDeals: 0,
      movedActivities: 0,
    });
  });

  it('сообщает, что дублей нет', () => {
    render(
      <MemoryRouter>
        <DuplicatesPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Дублей не найдено')).toBeInTheDocument();
  });

  it('предлагает основной карточкой запись с большим числом связей и просит подтверждение', async () => {
    state.data = [group];
    render(
      <MemoryRouter>
        <DuplicatesPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('radio', { name: 'Основная карточка: Альфа' }),
    ).toBeChecked();
    fireEvent.click(
      screen.getByRole('button', { name: 'Объединить в выбранную' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Объединить' }));
    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith({
        targetId: 2,
        sourceIds: [1],
      }),
    );
  });
});
