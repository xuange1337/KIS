import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { FormEvent, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import { RecordType, useChecklist, useChecklistActions } from '../../api/hooks';

/** Чек-лист записи: подзадачи, которые нужно отметить выполненными. */
export function ChecklistPanel({ type, id }: { type: RecordType; id: number }) {
  const { data: items, isError } = useChecklist(type, id);
  const { add, update, remove } = useChecklistActions(type, id);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const done = items?.filter((item) => item.isDone).length ?? 0;
  const total = items?.length ?? 0;

  const run = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сохранить изменение'));
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    void run(async () => {
      await add.mutateAsync(value);
      setText('');
    });
  };

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
        sx={{ mb: 1 }}
      >
        <Typography variant="h6">Чек-лист</Typography>
        {total > 0 && (
          <Typography variant="body2" color="text.secondary">
            {done} из {total}
          </Typography>
        )}
      </Stack>
      {total > 0 && (
        <LinearProgress
          variant="determinate"
          value={(done / total) * 100}
          aria-label="Выполнено пунктов"
          sx={{ mb: 1 }}
        />
      )}
      {(error || isError) && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error || 'Не удалось загрузить чек-лист'}
        </Alert>
      )}
      {items && items.length === 0 && (
        <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
          Пунктов нет. Разбейте работу на шаги и отмечайте их по ходу дела.
        </Typography>
      )}
      {items?.map((item) => (
        <Stack key={item.itemId} direction="row" alignItems="center">
          <FormControlLabel
            sx={{ flex: 1, mr: 0 }}
            control={
              <Checkbox
                checked={item.isDone}
                disabled={update.isPending}
                onChange={(event) =>
                  void run(() =>
                    update.mutateAsync({
                      itemId: item.itemId,
                      isDone: event.target.checked,
                    }),
                  )
                }
              />
            }
            label={
              <span
                style={{
                  textDecoration: item.isDone ? 'line-through' : 'none',
                  opacity: item.isDone ? 0.6 : 1,
                }}
              >
                {item.text}
              </span>
            }
          />
          <IconButton
            size="small"
            aria-label={`Удалить пункт ${item.text}`}
            onClick={() => void run(() => remove.mutateAsync(item.itemId))}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <form onSubmit={submit}>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="Новый пункт"
            value={text}
            onChange={(event) => setText(event.target.value)}
            inputProps={{ maxLength: 255 }}
          />
          <Button
            type="submit"
            variant="outlined"
            disabled={!text.trim() || add.isPending}
          >
            Добавить
          </Button>
        </Stack>
      </form>
    </Box>
  );
}
