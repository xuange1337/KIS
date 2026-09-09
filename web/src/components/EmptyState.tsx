import { Box, Button, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { TOKENS } from '../theme/tokens';

interface EmptyStateProps {
  /** Что именно отсутствует — одной короткой фразой. */
  title: string;
  /** Подсказка о следующем шаге; необязательна. */
  hint?: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** Компактный вариант — для блоков внутри карточек. */
  dense?: boolean;
}

/**
 * Сообщение о пустом списке.
 *
 * Отсутствие данных и отказ загрузки выглядят одинаково, если ничего не
 * показывать: пустая таблица читается как «данных нет», хотя сервис мог быть
 * недоступен. Поэтому пустое состояние всегда подписано явно и занимает
 * немного места — это рабочий экран, а не приветственная страница.
 */
export function EmptyState({
  title,
  hint,
  icon,
  action,
  dense,
}: EmptyStateProps) {
  return (
    <Stack
      alignItems="center"
      spacing={dense ? 0.5 : 1}
      sx={{ py: dense ? 3 : 5, px: 2, textAlign: 'center' }}
    >
      {icon && (
        <Box sx={{ color: TOKENS.textMuted, display: 'flex', mb: 0.5 }}>
          {icon}
        </Box>
      )}
      <Typography sx={{ fontSize: 13.5, fontWeight: 500 }}>{title}</Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 340 }}>
          {hint}
        </Typography>
      )}
      {action && (
        <Button size="small" onClick={action.onClick} sx={{ mt: 1 }}>
          {action.label}
        </Button>
      )}
    </Stack>
  );
}
