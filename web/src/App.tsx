import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './features/auth/AuthContext';
import { AppRoutes } from './routes';

export function App() {
  const { initializing } = useAuth();

  // До окончания проверки сохранённой сессии не показываем ни приложение,
  // ни форму входа — иначе экран входа мигает при каждой перезагрузке
  if (initializing) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <AppRoutes />;
}
