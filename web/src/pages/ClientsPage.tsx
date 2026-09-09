import {
  Box,
  Alert,
  Button,
  Grid,
  MenuItem,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { InputAdornment } from '@mui/material';
import { ClientDto } from '@crm/shared';
import { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { ClientStatusChip } from '../components/StatusChip';
import { formatDate } from '../components/formatters';
import { ClientFormDialog } from '../features/clients/ClientFormDialog';
import { useClients, useDictionaries, useUsers } from '../api/hooks';
import { useAuth } from '../features/auth/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

/** Экранная форма «Клиенты: список + фильтры» (ТЗ п. 2.5). */
export function ClientsPage() {
  const navigate = useNavigate();
  const { canSeeAll } = useAuth();
  const { data: dictionaries } = useDictionaries();
  const { data: users } = useUsers(canSeeAll);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [industry, setIndustry] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [pagination, setPagination] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'createdAt', sort: 'desc' },
  ]);

  // Запрос уходит не на каждое нажатие клавиши, а после паузы в наборе
  const debouncedSearch = useDebouncedValue(search, 400);

  const query = useMemo(
    () => ({
      page: pagination.page + 1,
      limit: pagination.pageSize,
      sort: sortModel[0]?.field,
      order: sortModel[0]?.sort?.toUpperCase(),
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(industry ? { industry } : {}),
      ...(ownerUserId ? { ownerUserId: Number(ownerUserId) } : {}),
    }),
    [pagination, sortModel, debouncedSearch, status, source, industry, ownerUserId],
  );

  const { data, isFetching, isError } = useClients(query);

  // Пустая выборка означает разное: база пуста или фильтры слишком узкие
  const hasFilters = Boolean(
    debouncedSearch || status || source || industry || ownerUserId,
  );

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Наименование', flex: 2, minWidth: 240 },
    {
      field: 'status',
      headerName: 'Статус',
      width: 150,
      sortable: true,
      renderCell: (params) => <ClientStatusChip status={params.value} />,
    },
    { field: 'industry', headerName: 'Отрасль', flex: 1, minWidth: 160 },
    {
      field: 'inn',
      headerName: 'ИНН',
      width: 130,
      sortable: false,
      cellClassName: 'tabular',
    },
    {
      field: 'owner',
      headerName: 'Ответственный',
      flex: 1,
      minWidth: 180,
      sortable: false,
      valueGetter: (_value, row: ClientDto) => row.owner?.fullName ?? '—',
    },
    {
      field: 'createdAt',
      headerName: 'Создан',
      width: 120,
      valueFormatter: (value: string) => formatDate(value),
    },
  ];

  return (
    <>
      <PageHeader
        title="Клиенты"
        subtitle={
          canSeeAll
            ? 'Клиентская база отдела продаж'
            : 'Клиенты, закреплённые за вами'
        }
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
          >
            Добавить клиента
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Не удалось загрузить список клиентов. Проверьте соединение с сервером
        </Alert>
      )}

      <Box sx={{ mb: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              label="Поиск по наименованию или ИНН"
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
          <Grid item xs={6} md={2}>
            <TextField
              select
              label="Статус"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value="">Все</MenuItem>
              {dictionaries?.clientStatuses.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              select
              label="Источник"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value="">Все</MenuItem>
              {dictionaries?.clientSources.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              select
              label="Отрасль"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value="">Все</MenuItem>
              {dictionaries?.industries.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          {canSeeAll && (
            <Grid item xs={6} md={2}>
              <TextField
                select
                label="Ответственный"
                value={ownerUserId}
                onChange={(event) => setOwnerUserId(event.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value="">Все</MenuItem>
                {users?.map((item) => (
                  <MenuItem key={item.userId} value={String(item.userId)}>
                    {item.fullName}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
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
      <DataTable<ClientDto>
        rows={data?.items ?? []}
        columns={columns}
        rowCount={data?.total ?? 0}
        loading={isFetching}
        getRowId={(row) => row.clientId}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        onRowClick={(params) => navigate(`/clients/${params.id}`)}
        emptyTitle={
          hasFilters ? 'Ничего не найдено' : 'Клиентов пока нет'
        }
        emptyHint={
          hasFilters
            ? 'Измените условия поиска или сбросьте фильтры'
            : 'Добавьте первого клиента, чтобы начать вести базу'
        }
      />
      </Box>

      <ClientFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(client) => navigate(`/clients/${client.clientId}`)}
      />
    </>
  );
}
