import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { NEUTRAL } from '../theme/tokens';

interface LocationState {
  from?: { pathname: string };
}

/** Демонстрационные учётные записи, показываемые под формой. */
const DEMO_ACCOUNTS = [
  { role: 'Менеджер', login: 'manager', password: 'manager123' },
  { role: 'Руководитель', login: 'head', password: 'head123' },
  { role: 'Администратор', login: 'admin', password: 'admin123' },
];

/**
 * Экранная форма «Авторизация пользователя» (ТЗ п. 2.5).
 *
 * Страница разделена надвое: слева — назначение системы, справа — форма.
 * Так вход не выглядит одинокой карточкой посреди пустого экрана.
 */
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

  /** Подставляет учётные данные в форму по клику на строку. */
  const fill = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setLoginName(account.login);
    setPassword(account.password);
    setError(null);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        bgcolor: 'background.paper',
      }}
    >
      {/* Левая половина: назначение системы */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          bgcolor: NEUTRAL[900],
          color: NEUTRAL[0],
          p: 6,
        }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em' }}>
          АРМ · CRM
        </Typography>

        <Box>
          <Typography
            sx={{
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: '-0.035em',
              lineHeight: 1.1,
              mb: 2,
            }}
          >
            Автоматизированное
            <br />
            рабочее место менеджера
            <br />
            по работе с клиентами
          </Typography>
          <Typography sx={{ fontSize: 14, color: NEUTRAL[400], maxWidth: 420 }}>
            Клиентская база, история взаимодействий, контроль сделок
            и отчётность отдела продаж.
          </Typography>
        </Box>

        <Stack direction="row" spacing={4}>
          {[
            ['Клиенты', 'и контактные лица'],
            ['Сделки', 'по стадиям воронки'],
            ['Отчёты', 'и выгрузки'],
          ].map(([title, note]) => (
            <Box key={title}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{title}</Typography>
              <Typography sx={{ fontSize: 12, color: NEUTRAL[500] }}>{note}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Правая половина: форма */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, md: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 360 }}>
          <Typography variant="h5" sx={{ mb: 0.75 }}>
            Вход в систему
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Укажите учётные данные, выданные администратором
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
                sx={{ py: 1.25 }}
              >
                {submitting ? 'Выполняется вход…' : 'Войти'}
              </Button>
            </Stack>
          </form>

          <Divider sx={{ my: 4 }} />

          <Typography variant="overline" sx={{ display: 'block', mb: 1.5 }}>
            Демонстрационные учётные записи
          </Typography>
          <Stack spacing={0.25}>
            {DEMO_ACCOUNTS.map((account) => (
              <Stack
                key={account.login}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                onClick={() => fill(account)}
                sx={{
                  px: 1,
                  py: 0.75,
                  mx: -1,
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: NEUTRAL[100] },
                }}
              >
                <Typography sx={{ fontSize: 12.5 }}>{account.role}</Typography>
                <Typography className="tabular" sx={{ fontSize: 12, color: NEUTRAL[500] }}>
                  {account.login} / {account.password}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5 }}>
            Нажмите на строку, чтобы подставить данные в форму
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
