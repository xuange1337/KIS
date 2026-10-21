import { Currency, OfferDto, OfferStatus } from '@crm/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfferItemsDialog } from './OfferItemsDialog';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  useProducts: vi.fn(),
}));
vi.mock('../../api/hooks', () => ({
  useProducts: mocks.useProducts,
  useSaveOfferItems: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));

const offer: OfferDto = {
  offerId: 5,
  dealId: 2,
  number: 'КП-5',
  date: '2026-10-08',
  totalAmount: 20,
  currency: Currency.RUB,
  status: OfferStatus.DRAFT,
  fileRef: null,
  version: 7,
  items: [
    {
      itemId: 4,
      productId: 2,
      sku: 'SKU',
      name: 'Старое название',
      unit: 'шт.',
      quantity: 2,
      unitPrice: 10,
      totalAmount: 20,
    },
  ],
};

describe('Состав КП', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset().mockResolvedValue({});
    mocks.useProducts.mockReturnValue({
      data: {
        items: [
          {
            productId: 3,
            sku: 'NEW',
            name: 'Новый товар',
            unit: 'шт.',
            price: 15,
            currency: 'RUB',
          },
        ],
      },
      isFetching: false,
      isError: false,
    });
  });

  it('сохраняет снимок и версию при изменении количества', async () => {
    const close = vi.fn();
    render(<OfferItemsDialog offer={offer} onClose={close} />);
    fireEvent.change(screen.getByLabelText(/Количество: Старое название/), {
      target: { value: '3.125' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить состав' }));
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        offerId: 5,
        version: 7,
        items: [{ itemId: 4, productId: 2, quantity: 3.125, unitPrice: 10 }],
      }),
    );
    expect(close).toHaveBeenCalled();
  });

  it('добавляет товар из каталога в валюте КП', async () => {
    render(
      <OfferItemsDialog offer={{ ...offer, items: [] }} onClose={vi.fn()} />,
    );
    expect(mocks.useProducts).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'RUB', isActive: true }),
    );
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.click(
      await screen.findByRole('option', { name: 'NEW — Новый товар' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить состав' }));
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            { itemId: undefined, productId: 3, quantity: 1, unitPrice: 15 },
          ],
        }),
      ),
    );
  });

  it('позволяет явно очистить состав', async () => {
    render(<OfferItemsDialog offer={offer} onClose={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Удалить позицию Старое название' }),
    );
    expect(
      screen.getByText(/После сохранения сумма станет нулевой/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить состав' }));
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        offerId: 5,
        version: 7,
        items: [],
      }),
    );
  });

  it('после ошибки сохраняет введённое количество и не закрывается', async () => {
    const close = vi.fn();
    mocks.mutateAsync.mockRejectedValue(new Error('Network Error'));
    render(<OfferItemsDialog offer={offer} onClose={close} />);
    fireEvent.change(screen.getByLabelText(/Количество: Старое название/), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить состав' }));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(screen.getByLabelText(/Количество: Старое название/)).toHaveValue(5);
    expect(close).not.toHaveBeenCalled();
  });
});
