import { Box, Skeleton, Stack } from '@mui/material';
import { TOKENS } from '../theme/tokens';

/**
 * Заглушки на время загрузки.
 *
 * Крутящийся индикатор в центре пустого экрана не подсказывает, что именно
 * появится, и создаёт скачок разметки. Заглушка повторяет будущую структуру,
 * поэтому переход к данным происходит без смещения содержимого.
 */

/** Строка сводки показателей. */
export function MetricsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: '1fr 1fr',
          lg: `repeat(${count}, 1fr)`,
        },
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 2,
        bgcolor: TOKENS.surface,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={index}
          sx={{
            px: 2.5,
            py: 2.25,
            borderRight: {
              lg: index < count - 1 ? `1px solid ${TOKENS.border}` : 'none',
            },
          }}
        >
          <Skeleton variant="text" width={110} height={12} />
          <Skeleton variant="text" width={64} height={34} sx={{ mt: 1 }} />
          <Skeleton variant="text" width={88} height={12} />
        </Box>
      ))}
    </Box>
  );
}

/** Список строк одинаковой высоты: активности, история, вложенные таблицы. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Stack spacing={0}>
      {Array.from({ length: rows }).map((_, index) => (
        <Stack
          key={index}
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{
            py: 1.25,
            borderBottom:
              index < rows - 1 ? `1px solid ${TOKENS.border}` : 'none',
          }}
        >
          <Skeleton variant="circular" width={16} height={16} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="55%" height={14} />
            <Skeleton variant="text" width="35%" height={12} />
          </Box>
          <Skeleton variant="text" width={72} height={14} />
        </Stack>
      ))}
    </Stack>
  );
}

/** Блок карточки произвольной высоты. */
export function BlockSkeleton({ height = 220 }: { height?: number }) {
  return (
    <Skeleton
      variant="rectangular"
      height={height}
      sx={{ borderRadius: 2, bgcolor: TOKENS.surfaceHover }}
    />
  );
}
