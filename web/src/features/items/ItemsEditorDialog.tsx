import {
  Currency,
  OfferItemDto,
  OfferItemInput,
  ProductDto,
} from '@crm/shared';
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useProducts } from '../../api/hooks';
import { extractErrorMessage } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { closeUnlessBackdrop } from '../../components/dialogClose';
import { formatMoney } from '../../components/formatters';
import { useUnsavedChanges } from '../../components/useUnsavedChanges';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface DraftItem {
  key: string;
  itemId?: number;
  productId: number;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

export interface ItemsEditorProps {
  title: string;
  currency: Currency;
  currentAmount: number;
  /** Пояснение над списком: что произойдёт с суммой при сохранении. */
  info: string;
  /** Что показать, если состав пуст. */
  emptyText: string;
  discardMessage: string;
  items: OfferItemDto[];
  saving: boolean;
  onSave: (items: OfferItemInput[]) => Promise<void>;
  onClose: () => void;
}

/**
 * Редактор состава из каталога. Общий для коммерческого предложения и
 * сделки: правила одинаковы, различаются только заголовки и то, куда
 * уходит результат.
 */
export function ItemsEditorDialog({
  title,
  currency,
  currentAmount,
  info,
  emptyText,
  discardMessage,
  items: initialItems,
  saving,
  onSave,
  onClose,
}: ItemsEditorProps) {
  const [items, setItems] = useState<DraftItem[]>(() =>
    initialItems.map((item) => ({
      key: String(item.itemId),
      itemId: item.itemId,
      productId: item.productId,
      name: item.name,
      unit: item.unit,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
  );
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, 350);
  const products = useProducts({
    q,
    currency,
    isActive: true,
    limit: 200,
    sort: 'name',
    order: 'ASC',
  });
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const { requestClose, confirmOpen, discard, keepEditing } = useUnsavedChanges(
    dirty,
    onClose,
  );
  const close = () => {
    if (!saving) requestClose();
  };
  const add = (product: ProductDto | null) => {
    if (!product) return;
    setItems((previous) => [
      ...previous,
      {
        key: crypto.randomUUID(),
        productId: product.productId,
        name: product.name,
        unit: product.unit,
        quantity: '1',
        unitPrice: String(product.price),
      },
    ]);
    setDirty(true);
    setSearch('');
  };

  return (
    <>
      <Dialog open onClose={closeUnlessBackdrop(close)} fullWidth maxWidth="md">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            try {
              await onSave(
                items.map((item) => ({
                  itemId: item.itemId,
                  productId: item.productId,
                  quantity: Number(item.quantity),
                  unitPrice: Number(item.unitPrice),
                })),
              );
              setDirty(false);
              onClose();
            } catch (cause) {
              setError(extractErrorMessage(cause));
            }
          }}
        >
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Alert severity="info">{info}</Alert>
              <Autocomplete<ProductDto>
                value={null}
                options={products.data?.items ?? []}
                loading={products.isFetching}
                disabled={saving || items.length >= 100}
                inputValue={search}
                onInputChange={(_event, value) => setSearch(value)}
                onChange={(_event, value) => add(value)}
                getOptionLabel={(product) => `${product.sku} — ${product.name}`}
                filterOptions={(options) => options}
                noOptionsText="Активных позиций в этой валюте не найдено"
                renderInput={(params) => (
                  <TextField {...params} label="Добавить из каталога" />
                )}
              />
              {products.isError && (
                <Alert severity="error">Не удалось загрузить каталог.</Alert>
              )}
              {items.length === 0 && (
                <Typography color="text.secondary">{emptyText}</Typography>
              )}
              {items.map((item, index) => (
                <Stack
                  key={item.key}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                >
                  <Typography sx={{ flex: 1 }}>
                    {item.name} ({item.unit})
                  </Typography>
                  <TextField
                    label={`Количество: ${item.name}`}
                    type="number"
                    size="small"
                    required
                    disabled={saving}
                    value={item.quantity}
                    inputProps={{ min: 0.001, max: 1000000, step: '0.001' }}
                    onChange={(event) => {
                      const value = event.target.value;
                      setItems((previous) =>
                        previous.map((row, i) =>
                          i === index ? { ...row, quantity: value } : row,
                        ),
                      );
                      setDirty(true);
                    }}
                    sx={{ width: { sm: 150 } }}
                  />
                  <TextField
                    label={`Цена: ${item.name}`}
                    type="number"
                    size="small"
                    required
                    disabled={saving}
                    value={item.unitPrice}
                    inputProps={{ min: 0, max: 999999999999.99, step: '0.01' }}
                    onChange={(event) => {
                      const value = event.target.value;
                      setItems((previous) =>
                        previous.map((row, i) =>
                          i === index ? { ...row, unitPrice: value } : row,
                        ),
                      );
                      setDirty(true);
                    }}
                    sx={{ width: { sm: 170 } }}
                  />
                  <Button
                    color="error"
                    disabled={saving}
                    aria-label={`Удалить позицию ${item.name}`}
                    onClick={() => {
                      setItems((previous) =>
                        previous.filter((_row, i) => i !== index),
                      );
                      setDirty(true);
                    }}
                  >
                    Убрать
                  </Button>
                </Stack>
              ))}
              <Typography>
                Текущая сумма: {formatMoney(currentAmount, currency)}. Новый
                итог сервер рассчитает при сохранении; каждая строка округляется
                до копеек.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={close} disabled={saving}>
              Отмена
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving || !dirty}
            >
              Сохранить состав
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        title="Закрыть без сохранения?"
        message={discardMessage}
        confirmLabel="Не сохранять"
        onConfirm={discard}
        onCancel={keepEditing}
      />
    </>
  );
}
