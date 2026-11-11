import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedFiltersBar } from './SavedFiltersBar';

const state = vi.hoisted(() => ({
  saved: [] as unknown[],
  create: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../../api/hooks', () => ({
  useSavedFilters: () => ({ data: state.saved }),
  useCreateSavedFilter: () => ({
    mutateAsync: state.create,
    isPending: false,
  }),
  useDeleteSavedFilter: () => ({ mutate: state.remove }),
}));

describe('Сохранённые фильтры', () => {
  beforeEach(() => {
    state.saved = [];
    state.create.mockReset().mockResolvedValue({});
    state.remove.mockReset();
  });

  it('ничего не показывает, пока нет ни наборов, ни выбранных фильтров', () => {
    const { container } = render(
      <SavedFiltersBar entity="clients" current={{}} onApply={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('сохраняет текущие фильтры под введённым названием', async () => {
    render(
      <SavedFiltersBar
        entity="clients"
        current={{ status: 'lead' }}
        onApply={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Сохранить текущие/ }));
    fireEvent.change(screen.getByLabelText(/Название набора/), {
      target: { value: 'Горячие лиды' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(state.create).toHaveBeenCalledWith({
        entity: 'clients',
        name: 'Горячие лиды',
        filters: { status: 'lead' },
      }),
    );
  });

  it('применяет сохранённый набор по клику', () => {
    state.saved = [
      {
        savedFilterId: 1,
        name: 'Крупные',
        filters: { industry: 'Производство' },
      },
    ];
    const onApply = vi.fn();
    render(<SavedFiltersBar entity="clients" current={{}} onApply={onApply} />);
    fireEvent.click(screen.getByText('Крупные'));
    expect(onApply).toHaveBeenCalledWith({ industry: 'Производство' });
  });
});
