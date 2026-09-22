import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { DEAL_LOSS_REASON_LABELS, DealLossReason } from '@crm/shared';
import { FormEvent, useEffect, useState } from 'react';

interface LossReasonDialogProps {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: DealLossReason, comment: string) => void;
}

/**
 * Причина проигрыша при закрытии сделки.
 *
 * Спрашивается один раз и в тот момент, когда менеджер ещё помнит
 * разговор: заполнить причину «потом» не заполняет никто, а отчёт по
 * проигрышам без причин отвечает только на вопрос «сколько», тогда как
 * разбирают проигрыши ради вопроса «почему».
 */
export function LossReasonDialog({
  open,
  loading,
  onCancel,
  onConfirm,
}: LossReasonDialogProps) {
  const [reason, setReason] = useState<DealLossReason | ''>('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setComment('');
    }
  }, [open]);

  // Для «другого» пояснение обязательно: иначе причина становится свалкой
  const commentRequired = reason === DealLossReason.OTHER;
  const valid =
    reason !== '' && (!commentRequired || comment.trim().length > 0);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    onConfirm(reason as DealLossReason, comment.trim());
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Почему сделка проиграна?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2, fontSize: 13 }}>
            Причина попадает в отчёт по проигрышам — по ней видно, что мешает
            закрывать сделки.
          </DialogContentText>
          <Stack spacing={2}>
            <TextField
              select
              required
              autoFocus
              size="small"
              label="Причина"
              value={reason}
              onChange={(event) =>
                setReason(event.target.value as DealLossReason)
              }
            >
              {(Object.keys(DEAL_LOSS_REASON_LABELS) as DealLossReason[]).map(
                (value) => (
                  <MenuItem key={value} value={value}>
                    {DEAL_LOSS_REASON_LABELS[value]}
                  </MenuItem>
                ),
              )}
            </TextField>
            <TextField
              size="small"
              label={
                commentRequired ? 'Пояснение' : 'Пояснение (необязательно)'
              }
              required={commentRequired}
              multiline
              minRows={2}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onCancel} disabled={loading}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="error"
            disabled={!valid || loading}
          >
            Закрыть как проигранную
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
