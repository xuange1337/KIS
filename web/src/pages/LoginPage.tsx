import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';

interface LocationState {
  from?: { pathname: string };
}

/** Экранная форма «Авторизация пользователя» (ТЗ п. 2.5). */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(loginName.trim(), password);
      // Возвращаем пользователя туда, куда он шёл до перехода на форму входа
      const target =
        (location.state as LocationState | null)?.from?.pathname ?? '/';
      navigate(target, { replace: true });
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось войти в систему'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ width: 420, maxWidth: '100%' }} variant="outlined">
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            Вход в систему
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            АРМ менеджера по работе с клиентами
          </Typography>

          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}

              <TextField
                label="Логин"
                value={loginName}
                onChange={(event) => setLoginName(event.target.value)}
                autoFocus
                required
                fullWidth
                autoComplete="username"
              />
              <TextField
                label="Пароль"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                fullWidth
                autoComplete="current-password"
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting || !loginName || !password}
              >
                {submitting ? 'Выполняется вход…' : 'Войти'}
              </Button>
            </Stack>
          </form>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 3, lineHeight: 1.8 }}
          >
            Демонстрационные учётные записи:
            <br />
            менеджер — manager / manager123
            <br />
            руководитель — head / head123
            <br />
            администратор — admin / admin123
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
