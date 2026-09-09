import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
} from '@mui/material';
import { ActivityDto } from '@crm/shared';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { FormEvent, useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import { parseDateValue, toIsoDateTime } from '../../components/formatters';
import {
  useClients,
  useDeals,
  useDictionaries,
  useSaveActivity,
} from '../../api/hooks';

interface ActivityFormDialogProps {
  open: boolean;
  activity?: ActivityDto | null;
  /** Предзаполнение при создании из карточки клиента или сделки. */
  clientId?: number;
  dealId?: number;
  /** Предустановленное время — при создании из ячейки календаря. */
  plannedAt?: Date;
  onClose: () => void;
}

const EMPTY = {
  clientId: '',
  dealId: '',
  type: 'call',
  subject: '',
  plannedAt: '',
  comment: '',
};

/** Форма планирования активности (ТЗ п. 1.2.4). */
export function ActivityFormDialog({
  open,
  activity,
  clientId,
  dealId,
  plannedAt,
  onClose,
}: ActivityFormDialogProps) {
  const { data: dictionaries } = useDictionaries();
  const { data: clients } = useClients({ limit: 200, sort: 'name', order: 'ASC' });
  const saveActivity = useSaveActivity();

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  // Список сделок ограничен выбранным клиентом: активность привязывается
  // только к сделке того же клиента
  const selectedClientId = form.clientId ? Number(form.clientId) : undefined;
  const { data: deals } = useDeals(
    { clientId: selectedClientId, limit: 100 },
    Boolean(selectedClientId),
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      activity
        ? {
            clientId: String(activity.clientId),
            dealId: activity.dealId ? String(activity.dealId) : '',
            type: activity.type,
            subject: activity.subject,
            plannedAt: activity.plannedAt,
            comment: activity.comment ?? '',
          }
        : {
            ...EMPTY,
            clientId: clientId ? String(clientId) : '',
            dealId: dealId ? String(dealId) : '',
            plannedAt: (plannedAt ?? new Date()).toISOString(),
          },
    );
  }, [open, activity, clientId, dealId, plannedAt]);

  const setField = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await saveActivity.mutateAsync({
        activityId: activity?.activityId,
        // Клиент фиксируется при создании и далее не меняется
        ...(activity ? {} : { clientId: Number(form.clientId) }),
        dealId: form.dealId ? Number(form.dealId) : null,
        type: form.type as ActivityDto['type'],
        subject: form.subject.trim(),
        plannedAt: form.plannedAt,
        comment: form.comment.trim() || null,
      });
      onClose();
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сохранить активность'));
    }
  };

  const valid = form.subject.trim() && form.plannedAt && (activity || form.clientId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {activity ? 'Редактирование активности' : 'Новая активность'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            {error && (
              <Grid item xs={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}
            {!activity && (
              <Grid item xs={12}>
                <TextField
                  select
                  label="Клиент"
                  value={form.clientId}
                  onChange={(event) => {
                    setField('clientId')(event.target.value);
                    // Смена клиента сбрасывает выбранную сделку
                    setForm((previous) => ({ ...previous, dealId: '' }));
                  }}
                  required
                  fullWidth
                  disabled={Boolean(clientId)}
                >
                  {clients?.items.map((item) => (
                    <MenuItem key={item.clientId} value={String(item.clientId)}>
                      {item.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Тип"
                value={form.type}
                onChange={(event) => setField('type')(event.target.value)}
                required
                fullWidth
              >
                {dictionaries?.activityTypes.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <DateTimePicker
                label="Дата и время"
                value={parseDateValue(form.plannedAt)}
                onChange={(value) => setField('plannedAt')(toIsoDateTime(value))}
                ampm={false}
                slotProps={{ textField: { required: true, fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Тема"
                value={form.subject}
                onChange={(event) => setField('subject')(event.target.value)}
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Сделка"
                value={form.dealId}
                onChange={(event) => setField('dealId')(event.target.value)}
                fullWidth
                disabled={!selectedClientId}
                helperText="Необязательно: активность может быть вне сделки"
              >
                <MenuItem value="">Без привязки к сделке</MenuItem>
                {deals?.items.map((item) => (
                  <MenuItem key={item.dealId} value={String(item.dealId)}>
                    {item.title}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Комментарий"
                value={form.comment}
                onChange={(event) => setField('comment')(event.target.value)}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saveActivity.isPending || !valid}
          >
            Сохранить
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
