import { Chip } from '@mui/material';
import { TagDto } from '@crm/shared';

/** Относительная яркость цвета: по ней выбирается читаемый цвет текста. */
function textColorFor(hex: string): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111111' : '#FFFFFF';
}

/** Цветная метка клиента. */
export function TagChip({
  tag,
  onDelete,
}: {
  tag: Pick<TagDto, 'name' | 'color'>;
  onDelete?: (event: unknown) => void;
}) {
  return (
    <Chip
      size="small"
      label={tag.name}
      onDelete={onDelete}
      sx={{
        bgcolor: tag.color,
        color: textColorFor(tag.color),
        '& .MuiChip-deleteIcon': { color: 'inherit', opacity: 0.7 },
      }}
    />
  );
}
