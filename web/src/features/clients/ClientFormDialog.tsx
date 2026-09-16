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
import { ClientDto } from '@crm/shared';
import { FormEvent, useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import { useDictionaries, useSaveClient, useUsers } from '../../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { closeUnlessBackdrop } from '../../components/dialogClose';

interface ClientFormDialogProps {
  open: boolean;
  client?: ClientDto | null;
  onClose: () => void;
  onSaved?: (client: ClientDto) => void;
}

type FormState = {
  name: string;
  inn: string;
  industry: string;
  status: string;
  source: string;
  address: string;
  ownerUserId: string;
};

const EMPTY: FormState = {
  name: '',
  inn: '',
  industry: '',
  status: 'lead',
  source: '',
  address: '',
  ownerUserId: '',
};

/** Форма создания и редактирования карточки клиента (ТЗ п. 1.2.1). */
export function ClientFormDialog({
  open,
  client,
  onClose,
  onSaved,
}: ClientFormDialogProps) {
  const { canSeeAll } = useAuth();
  const { data: dictionaries } = useDictionaries();
  // Список ответственных нужен только руководителю и администратору
  const { data: users } = useUsers(canSeeAll);
  const saveClient = useSaveClient();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      client
        ? {
            name: client.name,
            inn: client.inn ?? '',
            industry: client.industry ?? '',
            status: client.status,
            source: client.source ?? '',
            address: client.address ?? '',
            ownerUserId: client.ownerUserId ? String(client.ownerUserId) : '',
          }
        : EMPTY,
    );
  }, [open, client]);

  const setField = (field: keyof FormState) => (value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const saved = await saveClient.mutateAsync({
        clientId: client?.clientId,
        name: form.name.trim(),
        // Пустые необязательные поля отправляются как null, а не как ''
        inn: form.inn.trim() || null,
        industry: form.industry || null,
        status: form.status as ClientDto['status'],
        source: (form.source || null) as ClientDto['source'],
        address: form.address.trim() || null,
        ...(canSeeAll && form.ownerUserId
          ? { ownerUserId: Number(form.ownerUserId) }
          : {}),
      });
      onSaved?.(saved);
      onClose();
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сохранить клиента'));
    }
  };

  return (
    <Dialog open={open} onClose={closeUnlessBackdrop(onClose)} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {client ? 'Редактирование клиента' : 'Новый клиент'}
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
                label="Наименование организации"
                value={form.name}
                onChange={(event) => setField('name')(event.target.value)}
                required
                fullWidth
                autoFocus
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="ИНН"
                value={form.inn}
                onChange={(event) => setField('inn')(event.target.value)}
                fullWidth
                helperText="10 цифр для организации, 12 для ИП"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Отрасль"
                value={form.industry}
                onChange={(event) => setField('industry')(event.target.value)}
                fullWidth
              >
                <MenuItem value="">Не указана</MenuItem>
                {dictionaries?.industries.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Статус"
                value={form.status}
                onChange={(event) => setField('status')(event.target.value)}
                fullWidth
                required
              >
                {dictionaries?.clientStatuses.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Источник"
                value={form.source}
                onChange={(event) => setField('source')(event.target.value)}
                fullWidth
              >
                <MenuItem value="">Не указан</MenuItem>
                {dictionaries?.clientSources.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Адрес"
                value={form.address}
                onChange={(event) => setField('address')(event.target.value)}
                fullWidth
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
            disabled={saveClient.isPending || !form.name.trim()}
          >
            Сохранить
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
