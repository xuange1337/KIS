import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { TRIAL_DAYS } from '@crm/shared';
import { FormEvent, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../api/client';
import { AuthCard } from '../components/AuthCard';
import { useAuth } from '../features/auth/AuthContext';

const MIN_PASSWORD = 6;

/**
 * Самостоятельная регистрация организации.
 *
 * Создаёт организацию с пробным периодом и учётную запись её
 * администратора. Вход потом выполняется по логину, адрес почты нужен
 * для писем и восстановления пароля.
 */
export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    organizationName: '',
    fullName: '',
    login: '',
    email: '',
    password: '',
  });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set =
    (field: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));

  const valid =
    form.organizationName.trim().length >= 2 &&
    form.fullName.trim().length >= 3 &&
    form.login.trim().length >= 3 &&
    form.email.includes('@') &&
    form.password.length >= MIN_PASSWORD &&
    accepted;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await register({ ...form, acceptTerms: true });
      navigate('/', { replace: true });
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось зарегистрироваться'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Регистрация организации">
      <form onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {TRIAL_DAYS} дней бесплатно, без привязки карты. Вход потом
            выполняется по логину.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            autoFocus
            size="small"
            label="Название организации"
            value={form.organizationName}
            onChange={set('organizationName')}
            required
          />
          <TextField
            size="small"
            label="Ваше имя и фамилия"
            value={form.fullName}
            onChange={set('fullName')}
            autoComplete="name"
            required
          />
          <TextField
            size="small"
            type="email"
            label="Электронная почта"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            helperText="Пришлём письмо для подтверждения адреса"
            required
          />
          <TextField
            size="small"
            label="Логин"
            value={form.login}
            onChange={set('login')}
            autoComplete="username"
            helperText="По нему вы будете входить в систему"
            required
          />
          <TextField
            size="small"
            type="password"
            label="Пароль"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            helperText={`Не менее ${MIN_PASSWORD} символов`}
            required
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                Принимаю условия использования и согласие на обработку
                персональных данных
              </Typography>
            }
          />
          <Button type="submit" variant="contained" disabled={!valid || busy}>
            {busy ? 'Создаём…' : 'Создать организацию'}
          </Button>
          <Typography variant="body2" color="text.secondary">
            Уже есть учётная запись?{' '}
            <Link component={RouterLink} to="/login">
              Войти
            </Link>
          </Typography>
        </Stack>
      </form>
    </AuthCard>
  );
}
