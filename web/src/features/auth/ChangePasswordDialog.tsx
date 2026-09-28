import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { api, extractErrorMessage } from '../../api/client';

/** Минимальная длина пароля — та же, что на сервере. */
const MIN_LENGTH = 6;

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Смена собственного пароля.
 *
 * Раньше сменить пароль мог только администратор через карточку
 * пользователя — то есть пароль сотрудника всегда знал кто-то ещё.
 */
export function ChangePasswordDialog({
  open,
  onClose,
}: ChangePasswordDialogProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrent('');
      setNext('');
      setRepeat('');
      setError(null);
      setDone(false);
    }
  }, [open]);

  const mismatch = repeat.length > 0 && next !== repeat;
  const valid = current.length > 0 && next.length >= MIN_LENGTH && !mismatch;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/password', {
        currentPassword: current,
        newPassword: next,
      });
      setDone(true);
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сменить пароль'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Смена пароля</DialogTitle>
        <DialogContent>
          {done ? (
            <Alert severity="success">
              Пароль изменён. Другие входы в систему закрыты.
            </Alert>
          ) : (
            <Stack spacing={2}>
              <DialogContentText sx={{ fontSize: 13 }}>
                Текущий пароль спрашивается, чтобы сменить его не смог тот, кто
                подошёл к оставленному без присмотра компьютеру. Остальные входы
                будут закрыты.
              </DialogContentText>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                autoFocus
                size="small"
                type="password"
                label="Текущий пароль"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                required
              />
              <TextField
                size="small"
                type="password"
                label="Новый пароль"
                value={next}
                onChange={(event) => setNext(event.target.value)}
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
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>{done ? 'Закрыть' : 'Отмена'}</Button>
          {!done && (
            <Button type="submit" variant="contained" disabled={!valid || busy}>
              Сменить пароль
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
