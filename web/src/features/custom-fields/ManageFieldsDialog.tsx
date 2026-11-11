import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { CustomFieldType } from '@crm/shared';
import { FormEvent, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import {
  useCustomFields,
  useDeleteCustomField,
  useSaveCustomField,
} from '../../api/hooks';

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Текст',
  number: 'Число',
  date: 'Дата',
  boolean: 'Да / нет',
  select: 'Список',
};

/** Настройка полей: руководитель добавляет поля под свой процесс продаж. */
export function ManageFieldsDialog({
  open,
  entity,
  onClose,
}: {
  open: boolean;
  entity: 'client' | 'deal';
  onClose: () => void;
}) {
  const { data } = useCustomFields(entity);
  const save = useSaveCustomField(entity);
  const remove = useDeleteCustomField(entity);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState('');
  const [error, setError] = useState('');

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(extractErrorMessage(caught, fallback));
    }
  };

  const create = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await save.mutateAsync({
        name: name.trim(),
        type,
        options:
          type === 'select'
            ? options
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : undefined,
      });
      setName('');
      setOptions('');
      setType('text');
    }, 'Не удалось создать поле');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Поля {entity === 'client' ? 'клиента' : 'сделки'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <form onSubmit={create}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Название поля"
                  size="small"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  inputProps={{ maxLength: 80 }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  select
                  label="Тип"
                  size="small"
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as CustomFieldType)
                  }
                  sx={{ minWidth: 130 }}
                >
                  {(Object.keys(TYPE_LABELS) as CustomFieldType[]).map(
                    (key) => (
                      <MenuItem key={key} value={key}>
                        {TYPE_LABELS[key]}
                      </MenuItem>
                    ),
                  )}
                </TextField>
              </Stack>
              {type === 'select' && (
                <TextField
                  label="Значения через запятую"
                  size="small"
                  value={options}
                  onChange={(event) => setOptions(event.target.value)}
                  helperText="Например: SMB, Enterprise, Госсектор"
                />
              )}
              <div>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!name.trim() || save.isPending}
                >
                  Добавить поле
                </Button>
              </div>
            </Stack>
          </form>
          {data && data.length === 0 && (
            <Typography color="text.secondary">
              Своих полей пока нет. Добавьте, например, «Сайт», «Число
              сотрудников» или «Дата подписания».
            </Typography>
          )}
          {data?.map((field) => (
            <Stack
              key={field.fieldId}
              direction="row"
              alignItems="center"
              spacing={1}
            >
              <Typography sx={{ flex: 1 }}>{field.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {TYPE_LABELS[field.type]}
                {field.type === 'select' ? `: ${field.options.join(', ')}` : ''}
              </Typography>
              <IconButton
                aria-label={`Удалить поле ${field.name}`}
                disabled={remove.isPending}
                onClick={() =>
                  void run(
                    () => remove.mutateAsync(field.fieldId),
                    'Не удалось удалить поле',
                  )
                }
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}
