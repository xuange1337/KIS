import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import BlockIcon from '@mui/icons-material/Block';
import EditIcon from '@mui/icons-material/Edit';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { USER_ROLE_LABELS, UserDto, UserRole } from '@crm/shared';
import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate, formatDateTime } from '../components/formatters';
import { useDeactivateUser, useSaveUser, useUsers } from '../api/hooks';
import { api, extractErrorMessage } from '../api/client';
import { InviteDialog } from '../features/users/InviteDialog';
import { useAuth } from '../features/auth/AuthContext';

/** Экранная форма «Пользователи» — доступна только администратору (ТЗ п. 2.5). */
export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { data: users, isFetching } = useUsers();
  const deactivateUser = useDeactivateUser();

  const [formUser, setFormUser] = useState<UserDto | null | undefined>(
    undefined,
  );
  const [deactivateTarget, setDeactivateTarget] = useState<UserDto | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetLink, setResetLink] = useState<{
    user: UserDto;
    url: string;
    expiresAt: string;
  } | null>(null);

  /**
   * Выдача ссылки на смену пароля.
   *
   * Администратор передаёт ссылку сотруднику и сам нового пароля не
   * знает: раньше он придумывал пароль и диктовал его, после чего
   * пароль знали двое, а в переписке он оставался навсегда.
   */
  const issueReset = async (user: UserDto) => {
    setError(null);
    try {
      const response = await api.post<{ token: string; expiresAt: string }>(
        `/users/${user.userId}/password-reset`,
      );
      setResetLink({
        user,
        url: `${window.location.origin}/set-password?token=${response.data.token}`,
        expiresAt: response.data.expiresAt,
      });
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось выдать ссылку'));
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setError(null);
    try {
      await deactivateUser.mutateAsync(deactivateTarget.userId);
      setDeactivateTarget(null);
    } catch (caught) {
      setError(
        extractErrorMessage(caught, 'Не удалось заблокировать учётную запись'),
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Пользователи"
        subtitle="Учётные записи и роли сотрудников отдела продаж"
        actions={
          <>
            {/* Приглашение — обычный способ завести сотрудника: пароль
              он придумывает сам. Ручное заведение осталось для случая,
              когда ссылку передать некому */}
            <Button
              variant="outlined"
              startIcon={<PersonAddAltOutlinedIcon />}
              onClick={() => setInviteOpen(true)}
            >
              Пригласить
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setFormUser(null)}
            >
              Добавить пользователя
            </Button>
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ФИО</TableCell>
              <TableCell>Логин</TableCell>
              <TableCell>Роль</TableCell>
              <TableCell>Состояние</TableCell>
              <TableCell>Создан</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.userId} hover>
                <TableCell>{user.fullName}</TableCell>
                <TableCell>{user.login}</TableCell>
                <TableCell>{USER_ROLE_LABELS[user.role]}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={user.isActive ? 'Активен' : 'Заблокирован'}
                    color={user.isActive ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    title="Редактировать"
                    onClick={() => setFormUser(user)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    title="Выдать ссылку на смену пароля"
                    aria-label={`Ссылка на смену пароля: ${user.fullName}`}
                    disabled={!user.isActive}
                    onClick={() => void issueReset(user)}
                  >
                    <KeyOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    title="Заблокировать"
                    // Администратор не должен заблокировать сам себя
                    disabled={
                      !user.isActive || user.userId === currentUser?.userId
                    }
                    onClick={() => setDeactivateTarget(user)}
                  >
                    <BlockIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!isFetching && (users?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  Пользователи не заведены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <UserFormDialog
        open={formUser !== undefined}
        user={formUser ?? null}
        onClose={() => setFormUser(undefined)}
      />
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <Dialog
        open={Boolean(resetLink)}
        onClose={() => setResetLink(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Ссылка на смену пароля</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              Передайте ссылку сотруднику {resetLink?.user.fullName}. Она
              действует до{' '}
              {resetLink ? formatDateTime(resetLink.expiresAt) : ''} и
              срабатывает один раз. Новый пароль сотрудник задаёт сам — вам он
              не будет известен.
            </Typography>
            <TextField
              size="small"
              fullWidth
              value={resetLink?.url ?? ''}
              slotProps={{
                htmlInput: {
                  readOnly: true,
                  'aria-label': 'Ссылка на смену пароля',
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetLink(null)}>Закрыть</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (resetLink) void navigator.clipboard?.writeText(resetLink.url);
            }}
          >
            Скопировать
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Блокировка учётной записи"
        message={`Пользователь ${deactivateTarget?.fullName} не сможет войти в систему. Его записи и журнал действий сохраняются.`}
        confirmLabel="Заблокировать"
        loading={deactivateUser.isPending}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </>
  );
}

const EMPTY_FORM = {
  login: '',
  fullName: '',
  password: '',
  role: UserRole.MANAGER as string,
  isActive: 'true',
};

function UserFormDialog({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: UserDto | null;
  onClose: () => void;
}) {
  const saveUser = useSaveUser();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      user
        ? {
            login: user.login,
            fullName: user.fullName,
            password: '',
            role: user.role,
            isActive: String(user.isActive),
          }
        : EMPTY_FORM,
    );
  }, [open, user]);

  const setField = (field: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await saveUser.mutateAsync({
        userId: user?.userId,
        login: form.login.trim(),
        fullName: form.fullName.trim(),
        role: form.role as UserRole,
        isActive: form.isActive === 'true',
        // При редактировании пустое поле пароля оставляет прежний
        ...(form.password ? { password: form.password } : {}),
      });
      onClose();
    } catch (caught) {
      setError(
        extractErrorMessage(caught, 'Не удалось сохранить пользователя'),
      );
    }
  };

  const valid =
    form.login.trim() &&
    form.fullName.trim() &&
    (user || form.password.length >= 6);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {user ? 'Редактирование пользователя' : 'Новый пользователь'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            {error && (
              <Grid item xs={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                label="ФИО"
                value={form.fullName}
                onChange={(event) => setField('fullName')(event.target.value)}
                required
                fullWidth
                autoFocus
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Логин"
                value={form.login}
                onChange={(event) => setField('login')(event.target.value)}
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Пароль"
                type="password"
                value={form.password}
                onChange={(event) => setField('password')(event.target.value)}
                required={!user}
                fullWidth
                helperText={
                  user
                    ? 'Оставьте пустым, чтобы не менять'
                    : 'Не менее 6 символов'
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Роль"
                value={form.role}
                onChange={(event) => setField('role')(event.target.value)}
                fullWidth
              >
                {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Состояние"
                value={form.isActive}
                onChange={(event) => setField('isActive')(event.target.value)}
                fullWidth
              >
                <MenuItem value="true">Активен</MenuItem>
                <MenuItem value="false">Заблокирован</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saveUser.isPending || !valid}
          >
            Сохранить
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
