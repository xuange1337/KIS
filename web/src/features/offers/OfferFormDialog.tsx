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
import { OfferDto } from '@crm/shared';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { FormEvent, useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import { parseDateValue, toIsoDate } from '../../components/formatters';
import { useDictionaries, useSaveOffer } from '../../api/hooks';

interface OfferFormDialogProps {
  open: boolean;
  dealId: number;
  offer?: OfferDto | null;
  /** Сумма сделки — подставляется в новое КП как значение по умолчанию. */
  defaultAmount?: number;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Форма коммерческого предложения (ТЗ п. 1.2.5). */
export function OfferFormDialog({
  open,
  dealId,
  offer,
  defaultAmount,
  onClose,
}: OfferFormDialogProps) {
  const { data: dictionaries } = useDictionaries();
  const saveOffer = useSaveOffer();
  const [form, setForm] = useState({
    number: '',
    date: today(),
    totalAmount: '',
    status: 'draft',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      offer
        ? {
            number: offer.number,
            date: offer.date,
            totalAmount: String(offer.totalAmount),
            status: offer.status,
          }
        : {
            // Номер по умолчанию формируется из года и номера сделки
            number: `КП-${new Date().getFullYear()}/${dealId}`,
            date: today(),
            totalAmount: defaultAmount ? String(defaultAmount) : '',
            status: 'draft',
          },
    );
  }, [open, offer, dealId, defaultAmount]);

  const setField = (field: keyof typeof form) => (value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await saveOffer.mutateAsync({
        offerId: offer?.offerId,
        ...(offer ? {} : { dealId }),
        number: form.number.trim(),
        date: form.date,
        totalAmount: Number(form.totalAmount),
        status: form.status as OfferDto['status'],
      });
      onClose();
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сохранить предложение'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {offer ? 'Редактирование предложения' : 'Новое коммерческое предложение'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            {error && (
              <Grid item xs={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Номер"
                value={form.number}
                onChange={(event) => setField('number')(event.target.value)}
                required
                fullWidth
                autoFocus
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Дата"
                value={parseDateValue(form.date)}
                onChange={(value) => setField('date')(toIsoDate(value))}
                slotProps={{ textField: { required: true, fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Сумма предложения"
                type="number"
                value={form.totalAmount}
                onChange={(event) => setField('totalAmount')(event.target.value)}
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Статус"
                value={form.status}
                onChange={(event) => setField('status')(event.target.value)}
                fullWidth
              >
                {dictionaries?.offerStatuses.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              saveOffer.isPending || !form.number.trim() || form.totalAmount === ''
            }
          >
            Сохранить
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
