import { Box, Stack, Tooltip, Typography, IconButton } from '@mui/material';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import {
  ACTIVITY_TYPE_LABELS,
  ActivityDto,
  ActivityStatus,
  ActivityType,
} from '@crm/shared';
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from './EmptyState';
import { DURATION, TOKENS } from '../theme/tokens';

const TYPE_ICONS: Record<ActivityType, ReactNode> = {
  [ActivityType.CALL]: <CallOutlinedIcon sx={{ fontSize: 16 }} />,
  [ActivityType.MEETING]: <EventOutlinedIcon sx={{ fontSize: 16 }} />,
  [ActivityType.EMAIL]: <EmailOutlinedIcon sx={{ fontSize: 16 }} />,
};

/**
 * Срок активности словами: сегодня, завтра, просрочено или дата.
 *
 * Статус учитывается обязательно: выполненная активность с прошедшей датой
 * не просрочена, и помечать её красным — вводить в заблуждение.
 */
function describeDue(
  plannedAt: string,
  status: ActivityStatus,
): { text: string; tone: 'danger' | 'accent' | 'muted' | 'done' } {
  const planned = new Date(plannedAt);
  const now = new Date();

  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round(
    (startOfDay(planned) - startOfDay(now)) / (24 * 3600 * 1000),
  );

  const time = planned.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const shortDate = `${planned.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })} · ${time}`;

  if (status === ActivityStatus.DONE) {
    return { text: `Выполнено · ${shortDate}`, tone: 'done' };
  }
  if (status === ActivityStatus.CANCELED) {
    return { text: `Отменено · ${shortDate}`, tone: 'muted' };
  }

  if (planned.getTime() < now.getTime()) {
    // Для просроченного важнее давность, чем время суток: она определяет,
    // за что браться первым
    const overdueDays = -dayDiff;
    if (overdueDays <= 0) {
      return { text: `Просрочено · ${time}`, tone: 'danger' };
    }
    const suffix =
      overdueDays === 1 ? 'день' : overdueDays < 5 ? 'дня' : 'дней';
    return { text: `Просрочено · ${overdueDays} ${suffix}`, tone: 'danger' };
  }
  if (dayDiff === 0) return { text: `Сегодня · ${time}`, tone: 'accent' };
  if (dayDiff === 1) return { text: `Завтра · ${time}`, tone: 'muted' };

  return { text: shortDate, tone: 'muted' };
}

const TONE_COLOR = {
  danger: TOKENS.danger,
  accent: TOKENS.accent,
  muted: TOKENS.textSecondary,
  done: TOKENS.success,
} as const;

interface ActivityListProps {
  activities: ActivityDto[];
  /** Текст, если список пуст; пустая строка скрывает сообщение. */
  emptyText: string;
  emptyHint?: string;
  /** Обработчик отметки о выполнении; без него быстрое действие не выводится. */
  onComplete?: (activity: ActivityDto) => void;
  /**
   * Что писать во второй строке. По умолчанию — клиент, но в карточке
   * самого клиента это повтор, и полезнее показать сделку.
   */
  secondaryOf?: (activity: ActivityDto) => string;
  /** Показывать результат выполненных активностей (история взаимодействий). */
  showResult?: boolean;
  /** Скрывает переход к клиенту — например, когда он уже открыт. */
  hideOpenAction?: boolean;
}

/**
 * Лента активностей.
 *
 * Строка сканируется слева направо: тип, тема, клиент, срок. Срок подписан
 * словами, потому что «Просрочено» и «Сегодня» — это разные приоритеты, а
 * по одной дате их приходится вычислять в уме. Быстрые действия появляются
 * при наведении: постоянные кнопки в каждой строке создают шум.
 */
export function ActivityList({
  activities,
  emptyText,
  emptyHint,
  onComplete,
  secondaryOf,
  showResult,
  hideOpenAction,
}: ActivityListProps) {
  const navigate = useNavigate();

  if (activities.length === 0) {
    return emptyText ? <EmptyState title={emptyText} hint={emptyHint} dense /> : null;
  }

  return (
    <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {activities.map((activity, index) => {
        const due = describeDue(activity.plannedAt, activity.status);
        const target =
          hideOpenAction || !activity.client
            ? undefined
            : `/clients/${activity.client.clientId}`;
        const secondary =
          secondaryOf?.(activity) ??
          activity.client?.name ??
          ACTIVITY_TYPE_LABELS[activity.type];

        return (
          <Stack
            key={activity.activityId}
            component="li"
            direction="row"
            alignItems={showResult ? 'flex-start' : 'center'}
            spacing={1.5}
            sx={{
              py: 1.125,
              px: 1,
              mx: -1,
              borderRadius: 1,
              borderBottom:
                index < activities.length - 1 ? `1px solid ${TOKENS.border}` : 'none',
              transition: `background-color ${DURATION.fast}ms`,
              '&:hover': { bgcolor: TOKENS.surfaceHover },
              '&:hover .quick-actions': { opacity: 1, pointerEvents: 'auto' },
            }}
          >
            <Tooltip title={ACTIVITY_TYPE_LABELS[activity.type]}>
              <Box sx={{ color: TOKENS.textMuted, display: 'flex' }}>
                {TYPE_ICONS[activity.type]}
              </Box>
            </Tooltip>

            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 500 }} noWrap>
                {activity.subject}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {secondary}
              </Typography>
              {showResult && activity.result && (
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 0.25, color: TOKENS.textMuted }}
                >
                  Результат: {activity.result}
                </Typography>
              )}
            </Box>

            {/* Быстрые действия появляются при наведении и не сдвигают разметку */}
            <Stack
              className="quick-actions"
              direction="row"
              spacing={0.25}
              sx={{ opacity: 0, pointerEvents: 'none', transition: `opacity ${DURATION.fast}ms` }}
            >
              {onComplete && activity.status === ActivityStatus.PLANNED && (
                <Tooltip title="Отметить выполнение">
                  <IconButton
                    size="small"
                    aria-label={`Отметить выполнение: ${activity.subject}`}
                    onClick={() => onComplete(activity)}
                  >
                    <CheckCircleOutlineIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              )}
              {target && (
                <Tooltip title="Открыть карточку клиента">
                  <IconButton
                    size="small"
                    aria-label={`Открыть клиента: ${activity.client?.name}`}
                    onClick={() => navigate(target)}
                  >
                    <NorthEastIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            <Typography
              className="tabular"
              sx={{
                fontSize: 12,
                flexShrink: 0,
                fontWeight: due.tone === 'danger' ? 600 : 400,
                color: TONE_COLOR[due.tone],
              }}
            >
              {due.text}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}
