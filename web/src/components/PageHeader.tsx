import { Box, Breadcrumbs, Link, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

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

/** Единая шапка экрана: заголовок, хлебные крошки и действия. */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <Box sx={{ mb: 2.5 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs sx={{ mb: 1, fontSize: 14 }}>
          {breadcrumbs.map((crumb) =>
            crumb.to ? (
              <Link
                key={crumb.label}
                component={RouterLink}
                to={crumb.to}
                underline="hover"
                color="inherit"
              >
                {crumb.label}
              </Link>
            ) : (
              <Typography key={crumb.label} color="text.primary" fontSize={14}>
                {crumb.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      )}
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Typography variant="h5">{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} flexShrink={0}>
          {actions}
        </Stack>
      </Stack>
    </Box>
  );
}
