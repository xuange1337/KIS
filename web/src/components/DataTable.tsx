import { Box } from '@mui/material';
import {
  DataGrid,
  GridCellParams,
  GridColDef,
  GridPaginationModel,
  GridRowParams,
  GridSortModel,
} from '@mui/x-data-grid';
import { KeyboardEvent } from 'react';
import { EmptyState } from './EmptyState';
import { NEUTRAL, TOKENS } from '../theme/tokens';

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
  /** Сообщение, когда выборка пуста. */
  emptyTitle?: string;
  emptyHint?: string;
}

/**
 * Таблица списков с серверной постраничной выборкой и сортировкой.
 *
 * Оформление намеренно «бесшовное»: внешняя рамка убрана, строки разделены
 * светлой линией, заголовки набраны капителью. Плотность данных выше, чем
 * у типовой таблицы, поэтому на экран помещается больше записей.
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
  height = 600,
  emptyTitle = 'Записей не найдено',
  emptyHint,
}: DataTableProps<T>) {
  const handleCellKeyDown = (
    params: GridCellParams,
    event: KeyboardEvent<HTMLElement>,
  ) => {
    if (!onRowClick || event.key !== 'Enter') return;
    event.preventDefault();
    onRowClick({ id: params.id, row: params.row } as GridRowParams);
  };

  return (
    <Box sx={{ height, width: '100%' }}>
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
        onCellKeyDown={handleCellKeyDown}
        pageSizeOptions={[10, 25, 50, 100]}
        rowHeight={46}
        columnHeaderHeight={38}
        disableRowSelectionOnClick
        disableColumnMenu
        // Пустая таблица без подписи читается как сбой загрузки
        slots={{
          noRowsOverlay: () => (
            <EmptyState title={emptyTitle} hint={emptyHint} dense />
          ),
        }}
        sx={{
          border: 'none',
          fontSize: 13,
          '--DataGrid-rowBorderColor': NEUTRAL[100],

          '& .MuiDataGrid-columnHeaders': {
            borderBottom: `1px solid ${NEUTRAL[200]}`,
          },
          // Кольцо фокуса рисуется внутрь: outline снаружи обрезался бы
          // границей ячейки и на краях таблицы был бы не виден.
          // Правило идёт после сброса — при равной специфичности решает порядок
          '& .MuiDataGrid-columnHeader': {
            '&:focus, &:focus-within': { outline: 'none' },
            '&:focus-visible': {
              outline: `2px solid ${TOKENS.accent}`,
              outlineOffset: -2,
            },
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: TOKENS.textSecondary,
          },

          '& .MuiDataGrid-cell': {
            borderBottom: `1px solid ${NEUTRAL[100]}`,
            // Мышью фокус ячейки показывать незачем — он приходит от щелчка;
            // с клавиатуры без него не понять, где находишься
            '&:focus, &:focus-within': { outline: 'none' },
            '&:focus-visible': {
              outline: `2px solid ${TOKENS.accent}`,
              outlineOffset: -2,
              backgroundColor: TOKENS.accentSoft,
            },
          },
          '& .MuiDataGrid-row': {
            cursor: onRowClick ? 'pointer' : 'default',
            '&:hover': { backgroundColor: TOKENS.surfaceHover },
          },

          '& .MuiDataGrid-overlayWrapper': { height: 'auto', minHeight: 160 },
          '& .MuiDataGrid-overlayWrapperInner': { height: 'auto !important' },

          '& .MuiDataGrid-footerContainer': {
            borderTop: `1px solid ${NEUTRAL[200]}`,
            minHeight: 44,
          },
          '& .MuiTablePagination-root': { fontSize: 12 },
        }}
      />
    </Box>
  );
}
