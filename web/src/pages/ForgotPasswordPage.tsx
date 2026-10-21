import {
  Alert,
  Button,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FormEvent, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { api, extractErrorMessage } from '../api/client';
import { AuthCard } from '../components/AuthCard';

/**
 * Запрос ссылки восстановления пароля по адресу почты.
 *
 * Сообщение об успехе одинаково для любого адреса: форма не должна
 * подсказывать, зарегистрирован ли он.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/password/forgot', { email: email.trim() });
      setSent(true);
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось отправить запрос'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Восстановление пароля">
      {sent ? (
        <Stack spacing={2}>
          <Alert severity="success">
            Если этот адрес подтверждён в системе, мы отправили на него ссылку
            для установки пароля. Она действует сутки.
          </Alert>
          <Button component={RouterLink} to="/login" variant="contained">
            Вернуться ко входу
          </Button>
        </Stack>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Укажите адрес почты, подтверждённый в профиле. Если адрес не
              подтверждён, обратитесь к администратору организации.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              autoFocus
              size="small"
              type="email"
              label="Электронная почта"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Button
              type="submit"
              variant="contained"
              disabled={busy || !email.includes('@')}
            >
              Отправить ссылку
            </Button>
            <Link component={RouterLink} to="/login" variant="body2">
              Вернуться ко входу
            </Link>
          </Stack>
        </form>
      )}
    </AuthCard>
  );
}
