import { Box, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { DURATION, TOKENS } from '../theme/tokens';

export type MetricTone = 'neutral' | 'success' | 'danger' | 'accent';

interface MetricTileProps {
  label: string;
  /** Главное число показателя. */
  value: string;
  /** Уточнение под числом: сумма, срок, пояснение. */
  context: string;
  icon?: ReactNode;
  tone?: MetricTone;
  /** Если задан, плитка становится ссылкой на отфильтрованный список. */
  to?: string;
  last?: boolean;
}

const TONE_COLOR: Record<MetricTone, string> = {
  neutral: TOKENS.textPrimary,
  success: TOKENS.success,
  danger: TOKENS.danger,
  accent: TOKENS.accent,
};

/**
 * Показатель сводки.
 *
 * Цветом выделяется только число и значок — целиком окрашенная плитка
 * читается как системная ошибка, хотя просроченные задачи это обычная
 * рабочая ситуация, требующая внимания, а не тревоги.
 */
export function MetricTile({
  label,
  value,
  context,
  icon,
  tone = 'neutral',
  to,
  last,
}: MetricTileProps) {
  const color = TONE_COLOR[tone];
  const interactive = Boolean(to);

  return (
    <Box
      {...(interactive ? { component: RouterLink, to } : {})}
      aria-label={interactive ? `${label}: ${value}. ${context}` : undefined}
      sx={{
        display: 'block',
        px: 2.5,
        py: 2.25,
        textDecoration: 'none',
        color: 'inherit',
        transition: `background-color ${DURATION.fast}ms`,
        borderRight: {
          xs: 'none',
          lg: last ? 'none' : `1px solid ${TOKENS.border}`,
        },
        borderBottom: {
          xs: last ? 'none' : `1px solid ${TOKENS.border}`,
          lg: 'none',
        },
        ...(interactive && {
          cursor: 'pointer',
          '&:hover': { bgcolor: TOKENS.surfaceHover },
        }),
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.875} sx={{ mb: 1 }}>
        {icon && (
          <Box sx={{ display: 'flex', color, '& svg': { fontSize: 15 } }}>
            {icon}
          </Box>
        )}
        <Typography variant="overline" component="span">
          {label}
        </Typography>
      </Stack>

      <Typography
        className="tabular"
        sx={{ fontSize: 30, fontWeight: 600, lineHeight: 1, color }}
      >
        {value}
      </Typography>

      <Typography
        variant="caption"
        sx={{ display: 'block', mt: 0.75 }}
        color="text.secondary"
      >
        {context}
      </Typography>
    </Box>
  );
}

/** Контейнер строки показателей: рамка и сетка 4 → 2 → 1. */
export function MetricRow({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 2,
        bgcolor: TOKENS.surface,
        overflow: 'hidden',
        // На средних экранах плитки идут парами: правая граница внутри пары
        '& > *:nth-of-type(odd)': {
          borderRight: { sm: `1px solid ${TOKENS.border}`, lg: undefined },
        },
        '& > *:nth-of-type(-n+2)': {
          borderBottom: { sm: `1px solid ${TOKENS.border}`, lg: 'none' },
        },
      }}
    >
      {children}
    </Box>
  );
}
