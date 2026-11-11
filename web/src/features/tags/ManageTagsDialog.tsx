import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { FormEvent, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import { useDeleteTag, useSaveTag, useTags } from '../../api/hooks';
import { TagChip } from './TagChip';

/** Справочник меток: создание, переименование, перекраска, удаление. */
export function ManageTagsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data } = useTags();
  const save = useSaveTag();
  const remove = useDeleteTag();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
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
      await save.mutateAsync({ name: name.trim(), color });
      setName('');
    }, 'Не удалось создать метку');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Метки клиентов</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <form onSubmit={create}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Новая метка"
                size="small"
                value={name}
                onChange={(event) => setName(event.target.value)}
                inputProps={{ maxLength: 40 }}
                sx={{ flex: 1 }}
              />
              <input
                type="color"
                aria-label="Цвет новой метки"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                style={{ width: 40, height: 40, border: 0, background: 'none' }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={!name.trim() || save.isPending}
              >
                Добавить
              </Button>
            </Stack>
          </form>
          {data && data.length === 0 && (
            <Typography color="text.secondary">
              Меток пока нет. Например: «VIP», «Тендер», «Партнёр».
            </Typography>
          )}
          {data?.map((tag) => (
            <Stack
              key={tag.tagId}
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <input
                type="color"
                aria-label={`Цвет метки ${tag.name}`}
                value={tag.color.toLowerCase()}
                onChange={(event) =>
                  void run(
                    () =>
                      save.mutateAsync({
                        tagId: tag.tagId,
                        name: tag.name,
                        color: event.target.value,
                      }),
                    'Не удалось изменить цвет',
                  )
                }
                style={{ width: 32, height: 32, border: 0, background: 'none' }}
              />
              <div style={{ flex: 1 }}>
                <TagChip tag={tag} />
              </div>
              <Typography variant="body2" color="text.secondary">
                клиентов: {tag.clientsCount ?? 0}
              </Typography>
              <IconButton
                aria-label={`Удалить метку ${tag.name}`}
                disabled={remove.isPending}
                onClick={() =>
                  void run(
                    () => remove.mutateAsync(tag.tagId),
                    'Не удалось удалить метку',
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
