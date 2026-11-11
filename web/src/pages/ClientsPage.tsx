import {
  Box,
  Alert,
  Button,
  Chip,
  Grid,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import SearchIcon from '@mui/icons-material/Search';
import { InputAdornment } from '@mui/material';
import { ClientDto } from '@crm/shared';
import {
  GridColDef,
  GridPaginationModel,
  GridSortModel,
} from '@mui/x-data-grid';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { ClientStatusChip } from '../components/StatusChip';
import { formatDate } from '../components/formatters';
import { ClientFormDialog } from '../features/clients/ClientFormDialog';
import {
  useAddTagToClients,
  useBulkUpdateClients,
  useClients,
  useDictionaries,
  useTags,
  useUsers,
} from '../api/hooks';
import { ManageTagsDialog } from '../features/tags/ManageTagsDialog';
import { TagChip } from '../features/tags/TagChip';
import { FavoriteStar } from '../features/personal/FavoriteStar';
import { SavedFiltersBar } from '../features/personal/SavedFiltersBar';
import { BulkActionsBar } from '../features/clients/BulkActionsBar';
import { ImportDialog } from '../features/clients/ImportDialog';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

/** Экранная форма «Клиенты: список + фильтры» (ТЗ п. 2.5). */
export function ClientsPage() {
  const navigate = useNavigate();
  const { canSeeAll } = useAuth();
  const { data: dictionaries } = useDictionaries();
  const { data: users } = useUsers(canSeeAll);

  const [importOpen, setImportOpen] = useState(false);
  const [selection, setSelection] = useState<number[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const bulkUpdate = useBulkUpdateClients();

  const runBulk = async (
    payload: Parameters<typeof bulkUpdate.mutateAsync>[0],
  ) => {
    setBulkError(null);
    try {
      await bulkUpdate.mutateAsync(payload);
      // Отметки снимаются только после успеха: при отказе пользователь
      // видит тот же выбор и может исправить действие, а не собирать
      // десяток карточек заново
      setSelection([]);
    } catch (caught) {
      setBulkError(
        extractErrorMessage(caught, 'Не удалось изменить выбранные карточки'),
      );
    }
  };

  const runBulkTag = async (tagId: number) => {
    setBulkError(null);
    try {
      await addTag.mutateAsync({ tagId, clientIds: selection });
      setSelection([]);
    } catch (caught) {
      setBulkError(extractErrorMessage(caught, 'Не удалось добавить метку'));
    }
  };

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [industry, setIndustry] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [tagId, setTagId] = useState('');
  const [tagsOpen, setTagsOpen] = useState(false);
  const { data: tags } = useTags();
  const addTag = useAddTagToClients();
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
      ...(onlyFavorite ? { favorite: true } : {}),
      ...(tagId ? { tagId: Number(tagId) } : {}),
    }),
    [
      pagination,
      sortModel,
      debouncedSearch,
      status,
      source,
      industry,
      ownerUserId,
      onlyFavorite,
      tagId,
    ],
  );

  const { data, isFetching, isError } = useClients(query);

  // Пустая выборка означает разное: база пуста или фильтры слишком узкие
  const hasFilters = Boolean(
    debouncedSearch ||
    status ||
    source ||
    industry ||
    ownerUserId ||
    onlyFavorite,
  );

  // Набор для сохранения собирается из того, что видит пользователь
  const currentFilters: Record<string, string | number | boolean> = {
    ...(search ? { q: search } : {}),
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
    ...(industry ? { industry } : {}),
    ...(ownerUserId ? { ownerUserId: Number(ownerUserId) } : {}),
    ...(onlyFavorite ? { favorite: true } : {}),
    ...(tagId ? { tagId: Number(tagId) } : {}),
  };
  const applyFilters = (filters: Record<string, string | number | boolean>) => {
    setSearch(String(filters.q ?? ''));
    setStatus(String(filters.status ?? ''));
    setSource(String(filters.source ?? ''));
    setIndustry(String(filters.industry ?? ''));
    setOwnerUserId(filters.ownerUserId ? String(filters.ownerUserId) : '');
    setOnlyFavorite(filters.favorite === true);
    setTagId(filters.tagId ? String(filters.tagId) : '');
    setPagination((previous) => ({ ...previous, page: 0 }));
  };

  const columns: GridColDef[] = [
    {
      field: 'favorite',
      headerName: '',
      width: 52,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <FavoriteStar
          type="client"
          id={params.row.clientId}
          label={params.row.name}
        />
      ),
    },
    { field: 'name', headerName: 'Наименование', flex: 2, minWidth: 240 },
    {
      field: 'tags',
      headerName: 'Метки',
      flex: 1,
      minWidth: 140,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          {(params.row as ClientDto).tags?.map((tag) => (
            <TagChip key={tag.tagId} tag={tag} />
          ))}
        </Stack>
      ),
    },
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
          <>
            {/* Загрузка базы меняет состав данных отдела: действие
                руководителя, а не рядовая правка */}
            {canSeeAll && (
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => setImportOpen(true)}
              >
                Загрузить из файла
              </Button>
            )}
            {canSeeAll && (
              <Button variant="outlined" onClick={() => setTagsOpen(true)}>
                Метки
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<MergeTypeIcon />}
              onClick={() => navigate('/clients/duplicates')}
            >
              Поиск дублей
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setFormOpen(true)}
            >
              Добавить клиента
            </Button>
          </>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Не удалось загрузить список клиентов. Проверьте соединение с сервером
        </Alert>
      )}

      <SavedFiltersBar
        entity="clients"
        current={currentFilters}
        onApply={applyFilters}
      />

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
          <Grid item xs={6} md={2}>
            <TextField
              select
              label="Метка"
              value={tagId}
              onChange={(event) => setTagId(event.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value="">Все</MenuItem>
              {tags?.map((item) => (
                <MenuItem key={item.tagId} value={String(item.tagId)}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <Chip
              label="Только избранные"
              color={onlyFavorite ? 'primary' : 'default'}
              variant={onlyFavorite ? 'filled' : 'outlined'}
              onClick={() => setOnlyFavorite((value) => !value)}
              aria-pressed={onlyFavorite}
              sx={{ height: 40 }}
            />
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

      <BulkActionsBar
        count={selection.length}
        canAssignOwner={canSeeAll}
        users={users ?? []}
        busy={bulkUpdate.isPending}
        error={bulkError}
        onAssignOwner={(ownerUserId) =>
          void runBulk({
            clientIds: selection,
            action: 'assign-owner',
            ownerUserId,
          })
        }
        onSetStatus={(status) =>
          void runBulk({ clientIds: selection, action: 'set-status', status })
        }
        tags={tags}
        onAddTag={(tag) => void runBulkTag(tag)}
        onClear={() => setSelection([])}
      />

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
          checkboxSelection
          selectionModel={selection}
          onSelectionModelChange={(model) =>
            setSelection(model as unknown as number[])
          }
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
          emptyTitle={hasFilters ? 'Ничего не найдено' : 'Клиентов пока нет'}
          emptyHint={
            hasFilters
              ? 'Измените условия поиска или сбросьте фильтры'
              : 'Добавьте первого клиента, чтобы начать вести базу'
          }
        />
      </Box>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => setSelection([])}
      />

      <ManageTagsDialog open={tagsOpen} onClose={() => setTagsOpen(false)} />
      <ClientFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(client) => navigate(`/clients/${client.clientId}`)}
      />
    </>
  );
}
