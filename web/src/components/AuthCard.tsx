import { Box, Card, CardContent, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { TOKENS } from '../theme/tokens';

/** Карточка по центру экрана для открытых страниц: вход, регистрация, ссылки из писем. */
export function AuthCard({
  title,
  children,
  maxWidth = 420,
}: {
  title: string;
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: TOKENS.background,
        p: 2,
      }}
    >
      <Card variant="outlined" sx={{ width: '100%', maxWidth }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}
