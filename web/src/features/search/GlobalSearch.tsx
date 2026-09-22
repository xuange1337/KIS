import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  InputAdornment,
  List,
  ListItemButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { GlobalSearchResult, SearchHit } from '@crm/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '../../api/hooks';
import { TOKENS } from '../../theme/tokens';
import { EmptyState } from '../../components/EmptyState';

/** Порядок и подписи разделов выдачи. */
const GROUPS: { key: keyof GlobalSearchResult; label: string }[] = [
  { key: 'clients', label: 'Клиенты' },
  { key: 'deals', label: 'Сделки' },
  { key: 'activities', label: 'Активности' },
  { key: 'offers', label: 'Коммерческие предложения' },
];

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Поиск по всем разделам сразу.
 *
 * Менеджеру звонят и называют фамилию или номер предложения — найти
 * запись, не зная заранее, в каком она разделе, было нельзя. Окно
 * открывается с клавиатуры и управляется стрелками: во время разговора
 * тянуться к мыши неудобно.
 */
export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching } = useGlobalSearch(query, open);

  /** Плоский список: стрелки ходят по выдаче, а не по разделам. */
  const hits = useMemo(() => {
    if (!data) return [] as SearchHit[];
    return GROUPS.flatMap((group) => data[group.key]);
  }, [data]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [data]);

  const openHit = (hit: SearchHit) => {
    onClose();
    navigate(hit.url);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (hits.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % hits.length);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + hits.length) % hits.length);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      openHit(hits[active]);
    }
  };

  let flatIndex = -1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      // Окно поиска открывается сверху: выдача растёт вниз и не
      // перескакивает по экрану при вводе
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
      PaperProps={{ sx: { mt: 8 } }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, pb: 1.5 }}>
          <TextField
            inputRef={inputRef}
            autoFocus
            fullWidth
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Клиент, сделка, активность или номер КП"
            // Имя задаётся самому полю ввода: на корне TextField атрибут
            // достаётся обёртке, и поле остаётся без доступного имени
            slotProps={{ htmlInput: { 'aria-label': 'Строка поиска' } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18 }} />
                </InputAdornment>
              ),
              endAdornment: isFetching ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} />
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>

        {query.trim().length >= 2 && hits.length === 0 && !isFetching && (
          <Box sx={{ pb: 2 }}>
            <EmptyState
              title="Ничего не найдено"
              hint="Измените запрос"
              dense
            />
          </Box>
        )}

        {hits.length > 0 && (
          <List dense sx={{ pt: 0, pb: 1, maxHeight: 420, overflowY: 'auto' }}>
            {GROUPS.map((group) => {
              const items = data?.[group.key] ?? [];
              if (items.length === 0) return null;
              return (
                <Box key={group.key}>
                  <Typography
                    variant="overline"
                    sx={{ px: 2, color: TOKENS.textMuted }}
                  >
                    {group.label}
                  </Typography>
                  {items.map((hit) => {
                    flatIndex += 1;
                    const index = flatIndex;
                    return (
                      <ListItemButton
                        key={`${group.key}-${hit.id}`}
                        selected={index === active}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => openHit(hit)}
                      >
                        <Stack sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13.5 }} noWrap>
                            {hit.title}
                          </Typography>
                          {hit.subtitle && (
                            <Typography variant="caption" noWrap>
                              {hit.subtitle}
                            </Typography>
                          )}
                        </Stack>
                      </ListItemButton>
                    );
                  })}
                </Box>
              );
            })}
          </List>
        )}

        <Stack
          direction="row"
          spacing={1}
          sx={{
            px: 2,
            py: 1,
            borderTop: `1px solid ${TOKENS.border}`,
            color: TOKENS.textMuted,
          }}
        >
          <Chip size="small" variant="outlined" label="↑ ↓ выбор" />
          <Chip size="small" variant="outlined" label="Enter открыть" />
          <Chip size="small" variant="outlined" label="Esc закрыть" />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
