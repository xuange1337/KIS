import '@testing-library/jest-dom/vitest';
import { Currency, DealDto, DealStage } from '@crm/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DealItemsDialog } from './DealItemsDialog';

const state = vi.hoisted(() => ({
  items: undefined as unknown,
  save: vi.fn(),
}));
vi.mock('../../api/hooks', () => ({
  useDealItems: () => ({ data: state.items }),
  useSaveDealItems: () => ({ mutateAsync: state.save, isPending: false }),
  useProducts: () => ({
    data: { items: [] },
    isFetching: false,
    isError: false,
  }),
}));

const deal = {
  dealId: 9,
  currency: Currency.RUB,
  amount: 100,
  version: 4,
  stage: DealStage.NEW,
} as DealDto;

describe('Состав сделки', () => {
  beforeEach(() => {
    state.items = undefined;
    state.save.mockReset().mockResolvedValue([]);
  });

  it('не открывается, пока состав не загружен, чтобы не стереть его пустой формой', () => {
    const { container } = render(
      <DealItemsDialog deal={deal} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('сохраняет изменённое количество вместе с версией сделки', async () => {
    state.items = [
      {
        itemId: 1,
        productId: 2,
        sku: 'S',
        name: 'Услуга',
        unit: 'шт.',
        quantity: 1,
        unitPrice: 50,
        totalAmount: 50,
      },
    ];
    const onClose = vi.fn();
    render(<DealItemsDialog deal={deal} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/Количество: Услуга/), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить состав' }));
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith({
        dealId: 9,
        version: 4,
        items: [{ itemId: 1, productId: 2, quantity: 3, unitPrice: 50 }],
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
