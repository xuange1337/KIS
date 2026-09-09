import {
  Box,
  Alert,
  Grid,
  InputAdornment,
  MenuItem,
  TextField,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { OfferDto } from '@crm/shared';
import { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { OfferStatusChip } from '../components/StatusChip';
import { formatDate, formatMoney } from '../components/formatters';
import { useDictionaries, useOffers } from '../api/hooks';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

/** Сводный список коммерческих предложений (ТЗ п. 1.2.5). */
export function OffersPage() {
  const navigate = useNavigate();
  const { data: dictionaries } = useDictionaries();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pagination, setPagination] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'date', sort: 'desc' },
  ]);

  const debouncedSearch = useDebouncedValue(search, 400);

  const query = useMemo(
    () => ({
      page: pagination.page + 1,
      limit: pagination.pageSize,
      sort: sortModel[0]?.field,
      order: sortModel[0]?.sort?.toUpperCase(),
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      ...(status ? { status } : {}),
    }),
    [pagination, sortModel, debouncedSearch, status],
  );

  const { data, isFetching, isError } = useOffers(query);

  // Пустая выборка означает разное: предложений нет или фильтры узкие
  const hasFilters = Boolean(debouncedSearch || status);

  const columns: GridColDef[] = [
    { field: 'number', headerName: 'Номер', width: 150 },
    {
      field: 'date',
      headerName: 'Дата',
      width: 120,
      valueFormatter: (value: string) => formatDate(value),
    },
    {
      field: 'deal',
      headerName: 'Сделка',
      flex: 2,
      minWidth: 260,
      sortable: false,
      valueGetter: (_value, row: OfferDto) => row.deal?.title ?? '—',
    },
    {
      field: 'totalAmount',
      headerName: 'Сумма',
      width: 150,
      align: 'right',
      headerAlign: 'right',
      cellClassName: 'tabular',
      // Предложение наследует валюту своей сделки
      renderCell: (params) =>
        formatMoney(params.row.totalAmount, params.row.deal?.currency),
    },
    {
      field: 'status',
      headerName: 'Статус',
      width: 150,
      renderCell: (params) => <OfferStatusChip status={params.value} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Коммерческие предложения"
        subtitle="Учёт предложений и счетов по сделкам"
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Не удалось загрузить список коммерческих предложений. Проверьте соединение с сервером
        </Alert>
      )}

      <Box sx={{ mb: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <TextField
              label="Поиск по номеру или сделке"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              select
              label="Статус"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value="">Все</MenuItem>
              {dictionaries?.offerStatuses.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Box>

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
      <DataTable<OfferDto>
        rows={data?.items ?? []}
        columns={columns}
        rowCount={data?.total ?? 0}
        loading={isFetching}
        getRowId={(row) => row.offerId}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        emptyTitle={hasFilters ? 'Ничего не найдено' : 'Предложений пока нет'}
        emptyHint={
          hasFilters
            ? 'Измените условия поиска или сбросьте фильтры'
            : 'Коммерческие предложения оформляются в карточке сделки'
        }
        onRowClick={(params) => {
          const offer = data?.items.find((item) => item.offerId === params.id);
          // КП редактируются в карточке своей сделки
          if (offer) navigate(`/deals/${offer.dealId}`);
        }}
      />
      </Box>
    </>
  );
}
