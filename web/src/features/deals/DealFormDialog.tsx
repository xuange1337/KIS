import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  MenuItem,
  TextField,
} from '@mui/material';
import { DealDto } from '@crm/shared';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { FormEvent, useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import { parseDateValue, toIsoDate } from '../../components/formatters';
import {
  useClients,
  useDictionaries,
  useSaveDeal,
  useUsers,
} from '../../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { closeUnlessBackdrop } from '../../components/dialogClose';

interface DealFormDialogProps {
  open: boolean;
  deal?: DealDto | null;
  /** Предзаполненный клиент — при создании сделки из карточки клиента. */
  clientId?: number;
  onClose: () => void;
  onSaved?: (deal: DealDto) => void;
}

const EMPTY = {
  clientId: '',
  title: '',
  stage: 'new',
  amount: '',
  currency: 'RUB',
  plannedClose: '',
  ownerUserId: '',
};

/** Форма создания и редактирования сделки (ТЗ п. 1.2.3). */
export function DealFormDialog({
  open,
  deal,
  clientId,
  onClose,
  onSaved,
}: DealFormDialogProps) {
  const { canSeeAll } = useAuth();
  const { data: dictionaries } = useDictionaries();
  const { data: users } = useUsers(canSeeAll);
  // Для выбора клиента достаточно первых 200 доступных записей
  const { data: clients } = useClients({
    limit: 200,
    sort: 'name',
    order: 'ASC',
  });
  const saveDeal = useSaveDeal();

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      deal
        ? {
            clientId: String(deal.clientId),
            title: deal.title,
            stage: deal.stage,
            amount: String(deal.amount),
            currency: deal.currency,
            plannedClose: deal.plannedClose ?? '',
            ownerUserId: deal.ownerUserId ? String(deal.ownerUserId) : '',
          }
        : { ...EMPTY, clientId: clientId ? String(clientId) : '' },
    );
  }, [open, deal, clientId]);

  const setField = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const saved = await saveDeal.mutateAsync({
        dealId: deal?.dealId,
        // Клиент и стадия задаются только при создании: стадия меняется
        // отдельной операцией, чтобы попадать в историю
        ...(deal
          ? {}
          : {
              clientId: Number(form.clientId),
              stage: form.stage as DealDto['stage'],
            }),
        title: form.title.trim(),
        amount: Number(form.amount),
        currency: form.currency as DealDto['currency'],
        plannedClose: form.plannedClose || null,
        ...(canSeeAll && form.ownerUserId
          ? { ownerUserId: Number(form.ownerUserId) }
          : {}),
        // Версия открытой карточки: см. ClientFormDialog
        ...(deal ? { version: deal.version } : {}),
      });
      onSaved?.(saved);
      onClose();
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сохранить сделку'));
    }
  };

  const valid =
    form.title.trim() && form.amount !== '' && (deal || form.clientId);

  return (
    <Dialog
      open={open}
      onClose={closeUnlessBackdrop(onClose)}
      maxWidth="sm"
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {deal ? 'Редактирование сделки' : 'Новая сделка'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            {error && (
              <Grid item xs={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}
            {!deal && (
              <Grid item xs={12}>
                <TextField
                  select
                  label="Клиент"
                  value={form.clientId}
                  onChange={(event) => setField('clientId')(event.target.value)}
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
            <Grid item xs={12}>
              <TextField
                label="Наименование сделки"
                value={form.title}
                onChange={(event) => setField('title')(event.target.value)}
                required
                fullWidth
                autoFocus
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Сумма"
                type="number"
                value={form.amount}
                onChange={(event) => setField('amount')(event.target.value)}
                required
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {form.currency === 'RUB' ? '₽' : form.currency}
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Валюта"
                value={form.currency}
                onChange={(event) => setField('currency')(event.target.value)}
                fullWidth
              >
                {dictionaries?.currencies.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {!deal && (
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Начальная стадия"
                  value={form.stage}
                  onChange={(event) => setField('stage')(event.target.value)}
                  fullWidth
                  helperText="Вероятность подставится автоматически"
                >
                  {dictionaries?.dealStages.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Плановая дата закрытия"
                value={parseDateValue(form.plannedClose)}
                onChange={(value) => setField('plannedClose')(toIsoDate(value))}
                slotProps={{
                  textField: { fullWidth: true },
                  field: { clearable: true },
                }}
              />
            </Grid>
            {canSeeAll && (
              <Grid item xs={12}>
                <TextField
                  select
                  label="Ответственный менеджер"
                  value={form.ownerUserId}
                  onChange={(event) =>
                    setField('ownerUserId')(event.target.value)
                  }
                  fullWidth
                >
                  <MenuItem value="">Не назначен</MenuItem>
                  {users?.map((item) => (
                    <MenuItem key={item.userId} value={String(item.userId)}>
                      {item.fullName}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saveDeal.isPending || !valid}
          >
            Сохранить
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
