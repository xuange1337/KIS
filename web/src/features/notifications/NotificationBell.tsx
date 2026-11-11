import {
  Badge,
  Box,
  Button,
  Divider,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useMarkNotificationsRead,
  useNotifications,
  useUnreadNotifications,
} from '../../api/hooks';
import { formatDateTime } from '../../components/formatters';
import { TOKENS } from '../../theme/tokens';

/** Колокольчик с числом непрочитанных и списком последних уведомлений. */
export function NotificationBell({ compact }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { data: unread } = useUnreadNotifications();
  const { data: items } = useNotifications(Boolean(anchor));
  const markRead = useMarkNotificationsRead();
  const count = unread ?? 0;

  return (
    <>
      <Tooltip title="Уведомления">
        <Box
          component="button"
          type="button"
          aria-label={
            count > 0 ? `Уведомления, непрочитанных: ${count}` : 'Уведомления'
          }
          onClick={(event: React.MouseEvent<HTMLElement>) =>
            setAnchor(event.currentTarget)
          }
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            width: '100%',
            height: 32,
            px: compact ? 0 : 1.25,
            justifyContent: compact ? 'center' : 'flex-start',
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 1,
            bgcolor: TOKENS.surface,
            color: TOKENS.textMuted,
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 13,
            '&:hover': { borderColor: TOKENS.borderControl },
          }}
        >
          <Badge color="error" badgeContent={count} max={99}>
            <NotificationsNoneIcon sx={{ fontSize: 17 }} />
          </Badge>
          {!compact && <span>Уведомления</span>}
        </Box>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 340, maxWidth: '92vw' } } }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ px: 2, py: 1 }}
        >
          <Typography sx={{ fontWeight: 600 }}>Уведомления</Typography>
          <Button
            size="small"
            disabled={count === 0 || markRead.isPending}
            onClick={() => markRead.mutate('all')}
          >
            Прочитать все
          </Button>
        </Stack>
        <Divider />
        <Box sx={{ maxHeight: 380, overflowY: 'auto' }}>
          {items && items.length === 0 && (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              Пока ничего нового: просроченные дела и назначения появятся здесь
            </Typography>
          )}
          {items?.map((item) => (
            <Box
              key={item.notificationId}
              component="button"
              type="button"
              onClick={() => {
                if (!item.readAt) markRead.mutate(item.notificationId);
                setAnchor(null);
                if (item.link) navigate(item.link);
              }}
              sx={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                px: 2,
                py: 1.25,
                border: 0,
                borderBottom: `1px solid ${TOKENS.border}`,
                bgcolor: item.readAt ? 'transparent' : TOKENS.surfaceSunken,
                color: 'inherit',
                cursor: 'pointer',
                font: 'inherit',
                '&:hover': { bgcolor: TOKENS.surfaceSunken },
              }}
            >
              <Typography
                sx={{ fontSize: 13, fontWeight: item.readAt ? 400 : 600 }}
              >
                {item.title}
              </Typography>
              {item.body && (
                <Typography variant="body2" color="text.secondary">
                  {item.body}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(item.createdAt)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
}
