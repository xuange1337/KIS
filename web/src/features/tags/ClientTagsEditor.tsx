import { TagDto } from '@crm/shared';
import {
  Alert,
  Autocomplete,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import { useClientTags, useSetClientTags, useTags } from '../../api/hooks';
import { TagChip } from './TagChip';

/** Метки в карточке клиента: выбор из справочника, сохранение сразу. */
export function ClientTagsEditor({ clientId }: { clientId: number }) {
  const { data: all } = useTags();
  const { data: current } = useClientTags(clientId);
  const save = useSetClientTags(clientId);
  const [error, setError] = useState('');

  const change = async (tags: TagDto[]) => {
    setError('');
    try {
      await save.mutateAsync(tags.map((tag) => tag.tagId));
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сохранить метки'));
    }
  };

  if (!all) return null;
  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        Метки
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Autocomplete<TagDto, true>
        multiple
        size="small"
        options={all}
        value={all.filter((tag) =>
          (current ?? []).some((item) => item.tagId === tag.tagId),
        )}
        disabled={save.isPending}
        getOptionLabel={(tag) => tag.name}
        isOptionEqualToValue={(a, b) => a.tagId === b.tagId}
        onChange={(_event, value) => void change(value)}
        noOptionsText="Меток нет: руководитель создаёт их в разделе «Метки»"
        renderTags={(value, getTagProps) =>
          value.map((tag, index) => {
            const { key, onDelete } = getTagProps({ index });
            return <TagChip key={key} tag={tag} onDelete={onDelete} />;
          })
        }
        renderInput={(params) => (
          <TextField {...params} placeholder="Добавить метку" />
        )}
      />
    </Stack>
  );
}
