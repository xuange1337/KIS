import {
  Box,
  Alert,
  Button,
  Grid,
  InputAdornment,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ViewListIcon from '@mui/icons-material/ViewList';
import { DealDto, DealStage } from '@crm/shared';
import { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { DealStageChip } from '../components/StatusChip';
import { formatDate, formatMoney } from '../components/formatters';
import { DealFormDialog } from '../features/deals/DealFormDialog';
import { DealKanban } from '../features/deals/DealKanban';
import {
  useChangeDealStage,
  useDeals,
  useDictionaries,
  useUsers,
} from '../api/hooks';
import { useAuth } from '../features/auth/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { extractErrorMessage } from '../api/client';

type ViewMode = 'list' | 'kanban';

/** Экранная форма «Сделки» со списком и канбан-доской (ТЗ п. 2.5). */
export function DealsPage() {
  const navigate = useNavigate();
  const { canSeeAll } = useAuth();
  const { data: dictionaries } = useDictionaries();
  const { data: users } = useUsers(canSeeAll);
  const changeStage = useChangeDealStage();

  const [view, setView] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'createdAt', sort: 'desc' },
  ]);

  const debouncedSearch = useDebouncedValue(search, 400);

  const query = useMemo(
    () => ({
      // Канбан показывает все стадии сразу, поэтому берёт выборку целиком
      page: view === 'kanban' ? 1 : pagination.page + 1,
      limit: view === 'kanban' ? 200 : pagination.pageSize,
      sort: sortModel[0]?.field,
      order: sortModel[0]?.sort?.toUpperCase(),
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      ...(stage && view === 'list' ? { stage } : {}),
      ...(ownerUserId ? { ownerUserId: Number(ownerUserId) } : {}),
    }),
    [view, pagination, sortModel, debouncedSearch, stage, ownerUserId],
  );

  const { data, isFetching, isError } = useDeals(query);

  // Пустая выборка означает разное: сделок нет или фильтры слишком узкие
  const hasFilters = Boolean(debouncedSearch || stage || ownerUserId);

  const handleStageChange = async (dealId: number, nextStage: DealStage) => {
    setError(null);
    try {
      await changeStage.mutateAsync({ dealId, stage: nextStage });
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сменить стадию сделки'));
    }
  };

  const columns: GridColDef[] = [
    { field: 'title', headerName: 'Сделка', flex: 2, minWidth: 260 },
    {
      field: 'client',
      headerName: 'Клиент',
      flex: 1.5,
      minWidth: 200,
      sortable: false,
      valueGetter: (_value, row: DealDto) => row.client?.name ?? '—',
    },
    {
      field: 'stage',
      headerName: 'Стадия',
      width: 170,
      renderCell: (params) => <DealStageChip stage={params.value} />,
    },
    {
      field: 'amount',
      headerName: 'Сумма',
      width: 150,
      align: 'right',
      headerAlign: 'right',
      cellClassName: 'tabular',
      // Валюта берётся из самой сделки: в списке могут быть разные
      renderCell: (params) =>
        formatMoney(params.row.amount, params.row.currency),
    },
    {
      field: 'probability',
      headerName: 'Вероятность',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      valueFormatter: (value: number) => `${value}%`,
    },
    {
      field: 'plannedClose',
      headerName: 'План. закрытие',
      width: 140,
      valueFormatter: (value: string) => formatDate(value),
    },
    {
      field: 'owner',
      headerName: 'Ответственный',
      flex: 1,
      minWidth: 180,
      sortable: false,
      valueGetter: (_value, row: DealDto) => row.owner?.fullName ?? '—',
    },
  ];

  return (
    <>
      <PageHeader
        title="Сделки"
        subtitle="Сопровождение сделок по стадиям воронки продаж"
        actions={
          <>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={view}
              onChange={(_event, value: ViewMode | null) =>
                value && setView(value)
              }
            >
              <ToggleButton value="list" title="Списком">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="kanban" title="Канбан по стадиям">
                <ViewKanbanIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setFormOpen(true)}
            >
              Создать сделку
            </Button>
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Не удалось загрузить список сделок. Проверьте соединение с сервером
        </Alert>
      )}

      <Box sx={{ mb: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <TextField
              label="Поиск по сделке или клиенту"
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
          {view === 'list' && (
            <Grid item xs={6} md={3}>
              <TextField
                select
                label="Стадия"
                value={stage}
                onChange={(event) => setStage(event.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value="">Все стадии</MenuItem>
                {dictionaries?.dealStages.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
          {canSeeAll && (
            <Grid item xs={6} md={3}>
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

      {view === 'list' ? (
        <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <DataTable<DealDto>
          rows={data?.items ?? []}
          columns={columns}
          rowCount={data?.total ?? 0}
          loading={isFetching}
          getRowId={(row) => row.dealId}
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          onRowClick={(params) => navigate(`/deals/${params.id}`)}
          emptyTitle={hasFilters ? 'Ничего не найдено' : 'Сделок пока нет'}
          emptyHint={
            hasFilters
              ? 'Измените условия поиска или сбросьте фильтры'
              : 'Создайте сделку по одному из клиентов'
          }
        />
        </Box>
      ) : (
        <>
          {data && data.total > data.items.length && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Показаны {data.items.length} сделок из {data.total}: доска
              ограничена размером выборки, поэтому суммы по колонкам неполные.
              Уточните фильтры или воспользуйтесь списком.
            </Alert>
          )}
          <DealKanban
            deals={data?.items ?? []}
            onStageChange={handleStageChange}
            disabled={changeStage.isPending}
          />
        </>
      )}

      <DealFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(deal) => navigate(`/deals/${deal.dealId}`)}
      />
    </>
  );
}
