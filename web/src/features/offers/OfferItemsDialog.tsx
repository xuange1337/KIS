import { OfferDto, ProductDto } from '@crm/shared';
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
import { useProducts, useSaveOfferItems } from '../../api/hooks';
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

export function OfferItemsDialog({
  offer,
  onClose,
}: {
  offer: OfferDto;
  onClose: () => void;
}) {
  const [items, setItems] = useState<DraftItem[]>(() =>
    (offer.items ?? []).map((item) => ({
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
    currency: offer.currency,
    isActive: true,
    limit: 200,
    sort: 'name',
    order: 'ASC',
  });
  const save = useSaveOfferItems();
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const { requestClose, confirmOpen, discard, keepEditing } = useUnsavedChanges(
    dirty,
    onClose,
  );
  const close = () => {
    if (!save.isPending) requestClose();
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
              await save.mutateAsync({
                offerId: offer.offerId,
                version: offer.version,
                items: items.map((item) => ({
                  itemId: item.itemId,
                  productId: item.productId,
                  quantity: Number(item.quantity),
                  unitPrice: Number(item.unitPrice),
                })),
              });
              setDirty(false);
              onClose();
            } catch (cause) {
              setError(extractErrorMessage(cause));
            }
          }}
        >
          <DialogTitle>Состав предложения {offer.number}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Alert severity="info">
                Сохранение заменит сумму предложения итогом позиций в{' '}
                {offer.currency}. Цена и название сохраняются в документе
                независимо от каталога.
              </Alert>
              <Autocomplete<ProductDto>
                value={null}
                options={products.data?.items ?? []}
                loading={products.isFetching}
                disabled={save.isPending || items.length >= 100}
                inputValue={search}
                onInputChange={(_event, value) => setSearch(value)}
                onChange={(_event, value) => add(value)}
                getOptionLabel={(product) => `${product.sku} — ${product.name}`}
                filterOptions={(options) => options}
                noOptionsText="Активных позиций в валюте предложения не найдено"
                renderInput={(params) => (
                  <TextField {...params} label="Добавить из каталога" />
                )}
              />
              {products.isError && (
                <Alert severity="error">Не удалось загрузить каталог.</Alert>
              )}
              {items.length === 0 && (
                <Typography color="text.secondary">
                  Список пуст. После сохранения сумма станет нулевой.
                </Typography>
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
                    disabled={save.isPending}
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
                    disabled={save.isPending}
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
                    disabled={save.isPending}
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
                Текущая сумма: {formatMoney(offer.totalAmount, offer.currency)}.
                Новый итог сервер рассчитает при сохранении; каждая строка
                округляется до копеек.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={close} disabled={save.isPending}>
              Отмена
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={save.isPending || !dirty}
            >
              Сохранить состав
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        title="Закрыть без сохранения?"
        message="Изменения состава предложения будут потеряны."
        confirmLabel="Не сохранять"
        onConfirm={discard}
        onCancel={keepEditing}
      />
    </>
  );
}
