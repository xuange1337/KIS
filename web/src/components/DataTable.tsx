import { Paper } from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridPaginationModel,
  GridRowParams,
  GridSortModel,
} from '@mui/x-data-grid';

interface DataTableProps<T> {
  rows: T[];
  columns: GridColDef[];
  rowCount: number;
  loading?: boolean;
  /** Извлечение идентификатора строки — у сущностей разные имена ключей. */
  getRowId: (row: T) => number;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  sortModel?: GridSortModel;
  onSortModelChange?: (model: GridSortModel) => void;
  onRowClick?: (params: GridRowParams) => void;
  height?: number;
}

/**
 * Таблица списков с серверной постраничной выборкой и сортировкой.
 * Используется всеми разделами (клиенты, сделки, активности, КП),
 * поэтому настройки пагинации и локализации заданы в одном месте.
 */
export function DataTable<T extends object>({
  rows,
  columns,
  rowCount,
  loading,
  getRowId,
  paginationModel,
  onPaginationModelChange,
  sortModel,
  onSortModelChange,
  onRowClick,
  height = 560,
}: DataTableProps<T>) {
  return (
    <Paper variant="outlined" sx={{ height, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(row) => getRowId(row as T)}
        rowCount={rowCount}
        loading={loading}
        paginationMode="server"
        sortingMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        sortModel={sortModel}
        onSortModelChange={onSortModelChange}
        onRowClick={onRowClick}
        pageSizeOptions={[10, 25, 50, 100]}
        disableRowSelectionOnClick
        disableColumnMenu
        sx={{
          border: 'none',
          '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' },
          '& .MuiDataGrid-row': onRowClick ? { cursor: 'pointer' } : undefined,
        }}
      />
    </Paper>
  );
}
