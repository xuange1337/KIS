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
import { ContactDto } from '@crm/shared';
import { FormEvent, useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import { useDictionaries, useSaveContact } from '../../api/hooks';
import { closeUnlessBackdrop } from '../../components/dialogClose';

interface ContactFormDialogProps {
  open: boolean;
  clientId: number;
  contact?: ContactDto | null;
  onClose: () => void;
}

const EMPTY = {
  fullName: '',
  position: '',
  phone: '',
  email: '',
  preferredChannel: '',
  notes: '',
};

/** Форма контактного лица (ТЗ п. 1.2.2). */
export function ContactFormDialog({
  open,
  clientId,
  contact,
  onClose,
}: ContactFormDialogProps) {
  const { data: dictionaries } = useDictionaries();
  const saveContact = useSaveContact(clientId);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      contact
        ? {
            fullName: contact.fullName,
            position: contact.position ?? '',
            phone: contact.phone ?? '',
            email: contact.email ?? '',
            preferredChannel: contact.preferredChannel ?? '',
            notes: contact.notes ?? '',
          }
        : EMPTY,
    );
  }, [open, contact]);

  const setField = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await saveContact.mutateAsync({
        contactId: contact?.contactId,
        fullName: form.fullName.trim(),
        position: form.position.trim() || null,
        phone: form.phone.trim() || null,
        // Пустую почту отправляем как null: пустая строка не пройдёт
        // проверку формата на сервере
        email: form.email.trim() || null,
        preferredChannel: (form.preferredChannel ||
          null) as ContactDto['preferredChannel'],
        notes: form.notes.trim() || null,
      });
      onClose();
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сохранить контакт'));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={closeUnlessBackdrop(onClose)}
      maxWidth="sm"
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {contact ? 'Редактирование контакта' : 'Новое контактное лицо'}
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
                label="Должность"
                value={form.position}
                onChange={(event) => setField('position')(event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Предпочитаемый канал связи"
                value={form.preferredChannel}
                onChange={(event) =>
                  setField('preferredChannel')(event.target.value)
                }
                fullWidth
              >
                <MenuItem value="">Не указан</MenuItem>
                {dictionaries?.preferredChannels.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Телефон"
                value={form.phone}
                onChange={(event) => setField('phone')(event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Электронная почта"
                type="email"
                value={form.email}
                onChange={(event) => setField('email')(event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Примечания"
                value={form.notes}
                onChange={(event) => setField('notes')(event.target.value)}
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
            disabled={saveContact.isPending || !form.fullName.trim()}
          >
            Сохранить
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
