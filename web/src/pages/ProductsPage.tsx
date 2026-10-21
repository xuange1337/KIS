import { Currency, ProductDto, ProductInput, UserRole } from '@crm/shared';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import {
  GridColDef,
  GridPaginationModel,
  GridSortModel,
} from '@mui/x-data-grid';
import { useState } from 'react';
import { useProducts, useSaveProduct } from '../api/hooks';
import { extractErrorMessage } from '../api/client';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { formatMoney } from '../components/formatters';
import { useAuth } from '../features/auth/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useUnsavedChanges } from '../components/useUnsavedChanges';
import { closeUnlessBackdrop } from '../components/dialogClose';

const empty: ProductInput = {
  sku: '',
  name: '',
  description: '',
  unit: 'шт.',
  price: 0,
  currency: Currency.RUB,
  isActive: true,
};

export function ProductsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole(UserRole.HEAD, UserRole.ADMIN);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, 400);
  const [active, setActive] = useState('true');
  const [pagination, setPagination] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sort, setSort] = useState<GridSortModel>([
    { field: 'name', sort: 'asc' },
  ]);
  const { data, isFetching, isError } = useProducts({
    page: pagination.page + 1,
    limit: pagination.pageSize,
    q,
    sort: sort[0]?.field,
    order: sort[0]?.sort?.toUpperCase(),
    ...(active ? { isActive: active } : {}),
  });
  const save = useSaveProduct();
  const [editing, setEditing] = useState<ProductDto | null | undefined>();
  const [form, setForm] = useState<ProductInput>(empty);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const { requestClose, confirmOpen, discard, keepEditing } = useUnsavedChanges(
    dirty && editing !== undefined,
    () => {
      setEditing(undefined);
      setDirty(false);
    },
  );

  const open = (product: ProductDto | null) => {
    setEditing(product);
    setForm(
      product
        ? {
            sku: product.sku,
            name: product.name,
            description: product.description,
            unit: product.unit,
            price: product.price,
            currency: product.currency,
            isActive: product.isActive,
          }
        : { ...empty },
    );
    setDirty(false);
    setError('');
  };
  const close = () => {
    if (save.isPending) return;
    requestClose();
  };
  const change = <K extends keyof ProductInput>(
    key: K,
    value: ProductInput[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  };
  const columns: GridColDef[] = [
    { field: 'sku', headerName: 'Артикул', width: 150 },
    { field: 'name', headerName: 'Название', flex: 1, minWidth: 200 },
    { field: 'unit', headerName: 'Ед.', width: 80, sortable: false },
    {
      field: 'price',
      headerName: 'Цена',
      width: 170,
      renderCell: ({ row }) => formatMoney(row.price, row.currency),
    },
    {
      field: 'isActive',
      headerName: 'Статус',
      width: 130,
      valueFormatter: (value: boolean) => (value ? 'Активен' : 'В архиве'),
    },
    ...(canEdit
      ? [
          {
            field: 'actions',
            headerName: '',
            width: 130,
            sortable: false,
            renderCell: ({ row }: { row: ProductDto }) => (
              <Button onClick={() => open(row)}>Изменить</Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Каталог товаров и услуг"
        subtitle="Цены и единицы измерения вашей организации"
        actions={
          canEdit ? (
            <Button variant="contained" onClick={() => open(null)}>
              Добавить позицию
            </Button>
          ) : undefined
        }
      />
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Не удалось загрузить каталог. Проверьте соединение с сервером.
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Поиск по названию или артикулу"
          size="small"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPagination((previous) => ({ ...previous, page: 0 }));
          }}
          fullWidth
        />
        <TextField
          select
          label="Статус"
          size="small"
          value={active}
          sx={{ minWidth: 160 }}
          onChange={(event) => {
            setActive(event.target.value);
            setPagination((previous) => ({ ...previous, page: 0 }));
          }}
        >
          <MenuItem value="true">Активные</MenuItem>
          <MenuItem value="false">В архиве</MenuItem>
          <MenuItem value="">Все</MenuItem>
        </TextField>
      </Stack>
      <DataTable<ProductDto>
        rows={data?.items ?? []}
        columns={columns}
        rowCount={data?.total ?? 0}
        loading={isFetching}
        getRowId={(row) => row.productId}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        sortModel={sort}
        onSortModelChange={setSort}
        emptyTitle="Позиций не найдено"
        emptyHint="Измените фильтры или добавьте товары и услуги"
      />
      <Dialog
        open={editing !== undefined}
        onClose={closeUnlessBackdrop(close)}
        fullWidth
        maxWidth="sm"
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            try {
              await save.mutateAsync({
                ...form,
                sku: form.sku.trim(),
                name: form.name.trim(),
                unit: form.unit.trim(),
                productId: editing?.productId,
                version: editing?.version,
              });
              setEditing(undefined);
              setDirty(false);
            } catch (cause) {
              setError(extractErrorMessage(cause));
            }
          }}
        >
          <DialogTitle>
            {editing ? 'Изменить позицию' : 'Добавить позицию'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Артикул"
                required
                autoFocus
                value={form.sku}
                inputProps={{ maxLength: 64 }}
                onChange={(event) => change('sku', event.target.value)}
              />
              <TextField
                label="Название"
                required
                value={form.name}
                inputProps={{ maxLength: 200 }}
                onChange={(event) => change('name', event.target.value)}
              />
              <TextField
                label="Описание"
                multiline
                minRows={2}
                value={form.description ?? ''}
                inputProps={{ maxLength: 2000 }}
                onChange={(event) => change('description', event.target.value)}
              />
              <TextField
                label="Единица измерения"
                required
                value={form.unit}
                inputProps={{ maxLength: 32 }}
                onChange={(event) => change('unit', event.target.value)}
              />
              <TextField
                label="Цена"
                type="number"
                required
                value={form.price}
                inputProps={{ min: 0, max: 999999999999.99, step: '0.01' }}
                onChange={(event) =>
                  change('price', Number(event.target.value))
                }
              />
              <TextField
                label="Валюта"
                select
                value={form.currency}
                onChange={(event) =>
                  change('currency', event.target.value as Currency)
                }
              >
                {Object.values(Currency).map((currency) => (
                  <MenuItem key={currency} value={currency}>
                    {currency}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Статус"
                select
                value={String(form.isActive)}
                onChange={(event) =>
                  change('isActive', event.target.value === 'true')
                }
              >
                <MenuItem value="true">Активен</MenuItem>
                <MenuItem value="false">В архиве</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={close} disabled={save.isPending}>
              Отмена
            </Button>
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Сохранить
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        title="Закрыть без сохранения?"
        message="Изменения позиции будут потеряны."
        confirmLabel="Не сохранять"
        onConfirm={discard}
        onCancel={keepEditing}
      />
    </>
  );
}
