import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import { FormEvent, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import {
  useCreateSavedFilter,
  useDeleteSavedFilter,
  useSavedFilters,
} from '../../api/hooks';

type Filters = Record<string, string | number | boolean>;

interface SavedFiltersBarProps {
  entity: 'clients' | 'deals';
  /** Фильтры, выбранные сейчас; пустой объект — сохранять нечего. */
  current: Filters;
  onApply: (filters: Filters) => void;
}

/**
 * Личные наборы фильтров: один клик возвращает сложную выборку,
 * которую менеджер каждый день собирает заново.
 */
export function SavedFiltersBar({
  entity,
  current,
  onApply,
}: SavedFiltersBarProps) {
  const { data } = useSavedFilters(entity);
  const create = useCreateSavedFilter();
  const remove = useDeleteSavedFilter(entity);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const canSave = Object.keys(current).length > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await create.mutateAsync({ entity, name: name.trim(), filters: current });
      setOpen(false);
      setName('');
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сохранить фильтры'));
    }
  };

  if (!data?.length && !canSave) return null;

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          Мои фильтры:
        </Typography>
        {data?.map((saved) => (
          <Chip
            key={saved.savedFilterId}
            label={saved.name}
            onClick={() => onApply(saved.filters)}
            onDelete={() => remove.mutate(saved.savedFilterId)}
            deleteIcon={
              <span aria-label={`Удалить набор «${saved.name}»`} role="img">
                ×
              </span>
            }
            variant="outlined"
            size="small"
          />
        ))}
        <Button
          size="small"
          startIcon={<BookmarkAddOutlinedIcon />}
          disabled={!canSave}
          onClick={() => setOpen(true)}
        >
          Сохранить текущие
        </Button>
      </Stack>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={submit}>
          <DialogTitle>Сохранить набор фильтров</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Название набора"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                required
                fullWidth
                inputProps={{ maxLength: 80 }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Отмена</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!name.trim() || create.isPending}
            >
              Сохранить
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
