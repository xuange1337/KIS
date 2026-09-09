import { Box, Button, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <Typography variant="h5">Страница не найдена</Typography>
      <Typography color="text.secondary">
        Запрошенный раздел отсутствует в системе
      </Typography>
      <Button component={Link} to="/" variant="contained">
        На главную
      </Button>
    </Box>
  );
}
