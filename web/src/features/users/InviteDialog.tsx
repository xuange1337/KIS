import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { USER_ROLE_LABELS, UserRole } from '@crm/shared';
import { FormEvent, useEffect, useState } from 'react';
import { api, extractErrorMessage } from '../../api/client';
import { formatDateTime } from '../../components/formatters';

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Приглашение сотрудника по ссылке.
 *
 * Администратор задаёт только роль: логин и пароль приглашённый
 * придумывает сам. Раньше пароль придумывал администратор и диктовал
 * его — после чего пароль знали двое.
 */
export function InviteDialog({ open, onClose }: InviteDialogProps) {
  const [role, setRole] = useState<UserRole>(UserRole.MANAGER);
  const [fullName, setFullName] = useState('');
  const [issued, setIssued] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setRole(UserRole.MANAGER);
      setFullName('');
      setIssued(null);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<{ token: string; expiresAt: string }>(
        '/organizations/current/invitations',
        { role, fullName: fullName.trim() || undefined },
      );
      setIssued({
        url: `${window.location.origin}/invite?token=${response.data.token}`,
        expiresAt: response.data.expiresAt,
      });
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось создать приглашение'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Пригласить сотрудника</DialogTitle>
        <DialogContent>
          {issued ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                Передайте ссылку сотруднику. Она действует до{' '}
                {formatDateTime(issued.expiresAt)} и срабатывает один раз. Логин
                и пароль он придумает сам — вам они известны не будут.
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={issued.url}
                slotProps={{
                  htmlInput: {
                    readOnly: true,
                    'aria-label': 'Ссылка приглашения',
                  },
                }}
              />
            </Stack>
          ) : (
            <Stack spacing={2}>
              <DialogContentText sx={{ fontSize: 13 }}>
                Вы задаёте только роль. Учётную запись сотрудник создаёт сам по
                ссылке.
              </DialogContentText>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                select
                size="small"
                label="Роль"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((value) => (
                  <MenuItem key={value} value={value}>
                    {USER_ROLE_LABELS[value]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Кому выдана ссылка (необязательно)"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                helperText="Подсказка для вас: в списке приглашений будет видно, кому"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>{issued ? 'Закрыть' : 'Отмена'}</Button>
          {issued ? (
            <Button
              variant="contained"
              onClick={() => void navigator.clipboard?.writeText(issued.url)}
            >
              Скопировать
            </Button>
          ) : (
            <Button type="submit" variant="contained" disabled={busy}>
              Создать ссылку
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
