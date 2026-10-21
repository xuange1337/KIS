import { Alert, Button, CircularProgress, Stack } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { api, extractErrorMessage } from '../api/client';
import { AuthCard } from '../components/AuthCard';
import { useAuth } from '../features/auth/AuthContext';

/** Подтверждение адреса по ссылке из письма. Страница открытая. */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState<'pending' | 'done' | 'error'>(
    token ? 'pending' : 'error',
  );
  const [message, setMessage] = useState(
    token ? '' : 'В ссылке нет одноразового кода',
  );
  // Эффект в строгом режиме запускается дважды, а ссылка одноразовая
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api
      .post<{ email: string }>('/auth/email/verify', { token })
      .then(() => {
        setState('done');
        if (user) void refreshUser().catch(() => undefined);
      })
      .catch((caught) => {
        setState('error');
        setMessage(extractErrorMessage(caught, 'Не удалось подтвердить адрес'));
      });
  }, [token, user, refreshUser]);

  return (
    <AuthCard title="Подтверждение адреса">
      <Stack spacing={2}>
        {state === 'pending' && <CircularProgress size={28} />}
        {state === 'done' && (
          <Alert severity="success">Адрес электронной почты подтверждён.</Alert>
        )}
        {state === 'error' && (
          <Alert severity="error">
            {message} Запросите новое письмо в системе: после входа оно
            отправляется из уведомления вверху страницы.
          </Alert>
        )}
        {state !== 'pending' && (
          <Button
            component={RouterLink}
            to={user ? '/' : '/login'}
            variant="contained"
          >
            {user ? 'Перейти в систему' : 'Перейти ко входу'}
          </Button>
        )}
      </Stack>
    </AuthCard>
  );
}
