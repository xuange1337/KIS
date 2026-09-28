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
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { api, extractErrorMessage } from '../api/client';
import { TOKENS } from '../theme/tokens';

const MIN_LENGTH = 6;

/**
 * Установка пароля по одноразовой ссылке.
 *
 * Страница открытая: ею пользуются именно тогда, когда войти нельзя.
 * Ссылку выдаёт администратор и передаёт лично — почтовой рассылки в
 * развёртывании может не быть.
 */
export function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const mismatch = repeat.length > 0 && password !== repeat;
  const valid = token.length > 0 && password.length >= MIN_LENGTH && !mismatch;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/password/reset', { token, newPassword: password });
      setDone(true);
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось установить пароль'));
    } finally {
      setBusy(false);
    }
  };

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
      <Card variant="outlined" sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Установка пароля
          </Typography>

          {!token && (
            <Alert severity="error">
              Ссылка неполная: в ней нет одноразового кода. Запросите новую у
              администратора.
            </Alert>
          )}

          {done ? (
            <Stack spacing={2}>
              <Alert severity="success">
                Пароль установлен. Прежние входы в систему закрыты.
              </Alert>
              <Button component={RouterLink} to="/login" variant="contained">
                Перейти ко входу
              </Button>
            </Stack>
          ) : (
            token && (
              <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Придумайте пароль. Администратор его не увидит.
                  </Typography>
                  {error && <Alert severity="error">{error}</Alert>}
                  <TextField
                    autoFocus
                    size="small"
                    type="password"
                    label="Новый пароль"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    helperText={`Не менее ${MIN_LENGTH} символов`}
                    required
                  />
                  <TextField
                    size="small"
                    type="password"
                    label="Новый пароль ещё раз"
                    value={repeat}
                    onChange={(event) => setRepeat(event.target.value)}
                    error={mismatch}
                    helperText={mismatch ? 'Пароли не совпадают' : ' '}
                    required
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!valid || busy}
                  >
                    Установить пароль
                  </Button>
                </Stack>
              </form>
            )
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
