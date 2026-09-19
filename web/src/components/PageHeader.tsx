import { Box, Breadcrumbs, Link, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { NEUTRAL, TOKENS } from '../theme/tokens';

interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  /** Кнопки действий, выравниваются по правому краю. */
  actions?: ReactNode;
}

/**
 * Шапка экрана.
 *
 * Заголовок отделён от содержимого не рамкой, а воздухом и одной линией:
 * так экран читается как страница, а не как набор вложенных панелей.
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <Box sx={{ mb: 3, pb: 2.5, borderBottom: `1px solid ${NEUTRAL[200]}` }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          aria-label="Путь по разделам"
          separator="/"
          sx={{
            mb: 1,
            fontSize: 12,
            color: TOKENS.textMuted,
            '& .MuiBreadcrumbs-separator': { mx: 0.75 },
          }}
        >
          {breadcrumbs.map((crumb) =>
            crumb.to ? (
              <Link
                key={crumb.label}
                component={RouterLink}
                to={crumb.to}
                underline="none"
                sx={{
                  fontSize: 12,
                  color: TOKENS.textSecondary,
                  '&:hover': { color: NEUTRAL[900] },
                }}
              >
                {crumb.label}
              </Link>
            ) : (
              <Typography
                key={crumb.label}
                sx={{ fontSize: 12, color: TOKENS.textMuted }}
              >
                {crumb.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      )}

      {/*
        На узком экране заголовок и действия становятся в столбец.
        В строке подпись зажималась в колонку шириной в два слова и
        читалась хуже, чем если бы её не было вовсе.
      */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
        justifyContent="space-between"
        spacing={{ xs: 1.5, sm: 3 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ mb: subtitle ? 0.5 : 0 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Stack
          direction="row"
          spacing={1}
          flexShrink={0}
          alignItems="center"
          // Кнопок бывает несколько: на узком экране они переносятся,
          // а не сжимаются до нечитаемых
          flexWrap="wrap"
          useFlexGap
        >
          {actions}
        </Stack>
      </Stack>
    </Box>
  );
}
