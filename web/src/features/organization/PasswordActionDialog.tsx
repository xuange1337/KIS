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
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/client';

interface PasswordActionDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Если задано, пользователь должен набрать это значение вручную. */
  confirmPhrase?: { label: string; value: string };
  /** Выполняет действие; ошибка показывается в диалоге. */
  onSubmit: (password: string, phrase: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Подтверждение опасного действия паролем.
 *
 * Общий для передачи владения и закрытия организации: оба действия
 * нельзя отменить одним кликом, поэтому оставленный без присмотра
 * сеанс не должен позволять их совершить.
 */
export function PasswordActionDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmPhrase,
  onSubmit,
  onClose,
}: PasswordActionDialogProps) {
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setPhrase('');
      setError(null);
    }
  }, [open]);

  const ready =
    password.length > 0 && (!confirmPhrase || phrase === confirmPhrase.value);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password, phrase);
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось выполнить действие'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <DialogContentText component="div" sx={{ fontSize: 13 }}>
              {description}
            </DialogContentText>
            {error && <Alert severity="error">{error}</Alert>}
            {confirmPhrase && (
              <TextField
                size="small"
                label={confirmPhrase.label}
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                autoComplete="off"
              />
            )}
            <TextField
              size="small"
              type="password"
              label="Ваш пароль"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button
            type="submit"
            color="error"
            variant="contained"
            disabled={!ready || busy}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
