import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material';
import { CLIENT_STATUS_LABELS, ClientStatus, UserDto } from '@crm/shared';
import { useState } from 'react';
import { TOKENS } from '../../theme/tokens';

interface BulkActionsBarProps {
  /** Сколько карточек отмечено. */
  count: number;
  /** Назначать ответственного может руководитель и администратор. */
  canAssignOwner: boolean;
  users: UserDto[];
  busy?: boolean;
  error?: string | null;
  onAssignOwner: (ownerUserId: number) => void;
  onSetStatus: (status: ClientStatus) => void;
  onClear: () => void;
}

/**
 * Действия над отмеченными карточками.
 *
 * Панель появляется только когда что-то отмечено: постоянная строка с
 * выключенными кнопками занимает место на каждом экране и ничего не
 * сообщает. Число отмеченных показано явно — операция затрагивает
 * записи, которых может не быть на экране после прокрутки.
 */
export function BulkActionsBar({
  count,
  canAssignOwner,
  users,
  busy,
  error,
  onAssignOwner,
  onSetStatus,
  onClear,
}: BulkActionsBarProps) {
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');

  if (count === 0) return null;

  return (
    <Stack
      spacing={1}
      sx={{
        mb: 1.5,
        p: 1.5,
        border: `1px solid ${TOKENS.borderStrong}`,
        borderRadius: 2,
        bgcolor: TOKENS.surfaceSunken,
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <strong style={{ fontSize: 13 }}>Отмечено: {count}</strong>

        {canAssignOwner && (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              size="small"
              label="Ответственный"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              sx={{ minWidth: 220 }}
            >
              {users.map((user) => (
                <MenuItem key={user.userId} value={String(user.userId)}>
                  {user.fullName}
                </MenuItem>
              ))}
            </TextField>
            <Button
              size="small"
              variant="outlined"
              disabled={!owner || busy}
              onClick={() => onAssignOwner(Number(owner))}
            >
              Назначить
            </Button>
          </Stack>
        )}

        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            select
            size="small"
            label="Статус"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            {(Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).map(
              (value) => (
                <MenuItem key={value} value={value}>
                  {CLIENT_STATUS_LABELS[value]}
                </MenuItem>
              ),
            )}
          </TextField>
          <Button
            size="small"
            variant="outlined"
            disabled={!status || busy}
            onClick={() => onSetStatus(status as ClientStatus)}
          >
            Применить
          </Button>
        </Stack>

        <Button size="small" onClick={onClear} disabled={busy}>
          Снять отметки
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
