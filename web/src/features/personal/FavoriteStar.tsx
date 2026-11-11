import { IconButton, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { FavoriteType, useFavorites, useToggleFavorite } from '../../api/hooks';

/** Звёздочка «в избранное» для строки списка или карточки. */
export function FavoriteStar({
  type,
  id,
  label,
}: {
  type: FavoriteType;
  id: number;
  /** Название записи для подписи кнопки: читалка экрана должна знать, о чём речь. */
  label: string;
}) {
  const { data: favorites } = useFavorites(type);
  const toggle = useToggleFavorite(type);
  const active = favorites?.has(id) ?? false;
  const title = active ? 'Убрать из избранного' : 'В избранное';
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          aria-label={`${title}: ${label}`}
          aria-pressed={active}
          disabled={!favorites || toggle.isPending}
          color={active ? 'warning' : 'default'}
          onClick={(event) => {
            // Клик по звезде не должен открывать карточку строки
            event.stopPropagation();
            toggle.mutate({ id, favorite: !active });
          }}
        >
          {active ? (
            <StarIcon fontSize="small" />
          ) : (
            <StarBorderIcon fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
}
