import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsPage } from './ProductsPage';

const state = vi.hoisted(() => ({
  canEdit: true,
  mutateAsync: vi.fn(),
  useProducts: vi.fn(),
}));
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ hasRole: () => state.canEdit }),
}));
vi.mock('../api/hooks', () => ({
  useProducts: state.useProducts,
  useSaveProduct: () => ({ mutateAsync: state.mutateAsync, isPending: false }),
}));

describe('Каталог', () => {
  beforeEach(() => {
    state.canEdit = true;
    state.mutateAsync.mockReset().mockResolvedValue({});
    state.useProducts.mockReturnValue({
      data: { items: [], total: 0 },
      isFetching: false,
      isError: false,
    });
  });

  it('менеджеру не предлагает создание позиции', () => {
    state.canEdit = false;
    render(<ProductsPage />);
    expect(
      screen.queryByRole('button', { name: 'Добавить позицию' }),
    ).not.toBeInTheDocument();
  });

  it('сохраняет артикул, название и цену с копейками', async () => {
    render(<ProductsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    fireEvent.change(screen.getByLabelText(/Артикул/), {
      target: { value: ' SKU-1 ' },
    });
    fireEvent.change(screen.getByLabelText(/Название/), {
      target: { value: ' Услуга ' },
    });
    fireEvent.change(screen.getByLabelText(/Цена/), {
      target: { value: '19.95' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sku: 'SKU-1',
          name: 'Услуга',
          price: 19.95,
          currency: 'RUB',
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('сохраняет введённые данные после ошибки сервера', async () => {
    state.mutateAsync.mockRejectedValue(new Error('Network Error'));
    render(<ProductsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    fireEvent.change(screen.getByLabelText(/Артикул/), {
      target: { value: 'SKU-1' },
    });
    fireEvent.change(screen.getByLabelText(/Название/), {
      target: { value: 'Услуга' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByLabelText(/Название/)).toHaveValue('Услуга');
  });

  it('подтверждает потерю несохранённых изменений', async () => {
    render(<ProductsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    fireEvent.change(screen.getByLabelText(/Артикул/), {
      target: { value: 'SKU-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.getByText('Закрыть без сохранения?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Не сохранять' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(state.mutateAsync).not.toHaveBeenCalled();
  });
});
