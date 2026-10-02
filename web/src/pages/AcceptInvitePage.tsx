import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { InvitationPreview, USER_ROLE_LABELS } from '@crm/shared';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, extractErrorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { TOKENS } from '../theme/tokens';

const MIN_LENGTH = 6;

/**
 * Принятие приглашения в организацию.
 *
 * Страница открытая: по ссылке приходит человек, которого в системе
 * ещё нет. Если он уже вошёл — ему предлагается присоединиться
 * текущей учётной записью, так партнёр получает доступ ко второму
 * заказчику, не заводя второй логин.
 */
export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { user, switchOrganization, organizations } = useAuth();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<InvitationPreview>('/invitations', { params: { token } })
      .then((response) => {
        setPreview(response.data);
        setFullName(response.data.fullName ?? '');
      })
      .catch((caught) =>
        setError(extractErrorMessage(caught, 'Приглашение недействительно')),
      )
      .finally(() => setLoading(false));
  }, [token]);

  const valid =
    login.trim().length >= 3 &&
    fullName.trim().length >= 3 &&
    password.length >= MIN_LENGTH;

  const acceptAsNew = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/invitations/accept', {
        token,
        login: login.trim(),
        password,
        fullName: fullName.trim(),
      });
      setDone(true);
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось принять приглашение'));
    } finally {
      setBusy(false);
    }
  };

  const joinAsExisting = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<{ organizationId: number }>(
        '/invitations/join',
        { token },
      );
      // Сразу переключаемся: человек перешёл по ссылке, чтобы начать
      // работать в новой организации, а не чтобы просто в неё вступить
      await switchOrganization(response.data.organizationId);
      navigate('/');
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось присоединиться'));
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
      <Card variant="outlined" sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Приглашение в организацию
          </Typography>

          {loading && <CircularProgress size={24} />}

          {!loading && !preview && (
            <Alert severity="error">
              {error ?? 'Ссылка недействительна или уже использована.'}
            </Alert>
          )}

          {preview && done && (
            <Stack spacing={2}>
              <Alert severity="success">
                Учётная запись создана. Войдите под своим логином.
              </Alert>
              <Button variant="contained" onClick={() => navigate('/login')}>
                Перейти ко входу
              </Button>
            </Stack>
          )}

          {preview && !done && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Вас приглашают в «{preview.organizationName}» с правами:{' '}
                {USER_ROLE_LABELS[preview.role]}.
              </Typography>
              {error && <Alert severity="error">{error}</Alert>}

              {user ? (
                <>
                  <Typography variant="body2">
                    Вы вошли как {user.fullName}. Можно присоединиться этой же
                    учётной записью — она останется и в прежних организациях
                    {organizations.length > 0
                      ? ` (сейчас их ${organizations.length})`
                      : ''}
                    .
                  </Typography>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() => void joinAsExisting()}
                  >
                    Присоединиться
                  </Button>
                </>
              ) : (
                <form onSubmit={acceptAsNew}>
                  <Stack spacing={2}>
                    <TextField
                      size="small"
                      label="ФИО"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                    />
                    <TextField
                      size="small"
                      label="Логин"
                      value={login}
                      onChange={(event) => setLogin(event.target.value)}
                      required
                    />
                    <TextField
                      size="small"
                      type="password"
                      label="Пароль"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      helperText={`Не менее ${MIN_LENGTH} символов`}
                      required
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={!valid || busy}
                    >
                      Принять приглашение
                    </Button>
                  </Stack>
                </form>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
