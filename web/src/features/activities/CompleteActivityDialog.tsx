import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ACTIVITY_TYPE_LABELS, ActivityDto } from '@crm/shared';
import { FormEvent, useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import { useCompleteActivity } from '../../api/hooks';
import { formatDateTime } from '../../components/formatters';
import { closeUnlessBackdrop } from '../../components/dialogClose';

interface CompleteActivityDialogProps {
  open: boolean;
  activity: ActivityDto | null;
  onClose: () => void;
}

/** Отметка о выполнении активности с фиксацией результата (ТЗ п. 1.2.4). */
export function CompleteActivityDialog({
  open,
  activity,
  onClose,
}: CompleteActivityDialogProps) {
  const completeActivity = useCompleteActivity();
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setResult('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activity) return;
    setError(null);
    try {
      await completeActivity.mutateAsync({
        activityId: activity.activityId,
        result: result.trim(),
      });
      onClose();
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось отметить выполнение'));
    }
  };

  return (
    <Dialog open={open} onClose={closeUnlessBackdrop(onClose)} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Результат активности</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {activity && (
              <Typography variant="body2" color="text.secondary">
                {ACTIVITY_TYPE_LABELS[activity.type]} · {activity.subject}
                <br />
                Запланирована на {formatDateTime(activity.plannedAt)}
              </Typography>
            )}
            <TextField
              label="Результат"
              value={result}
              onChange={(event) => setResult(event.target.value)}
              required
              fullWidth
              multiline
              rows={3}
              autoFocus
              placeholder="Что удалось выяснить и о чём договорились"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={completeActivity.isPending || !result.trim()}
          >
            Отметить выполненной
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
