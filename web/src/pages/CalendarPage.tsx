import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import {
  ACTIVITY_TYPE_LABELS,
  ActivityDto,
  ActivityStatus,
  ActivityType,
} from '@crm/shared';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ActivityStatusChip } from '../components/StatusChip';
import { formatDateTime } from '../components/formatters';
import { ActivityFormDialog } from '../features/activities/ActivityFormDialog';
import { CompleteActivityDialog } from '../features/activities/CompleteActivityDialog';
import { useCalendarActivities, useUsers } from '../api/hooks';
import { DATA, TOKENS } from '../theme/tokens';
import { useAuth } from '../features/auth/AuthContext';

type ViewMode = 'month' | 'week' | 'day';

/** Цвета типов активностей — из общей палитры данных. */
const TYPE_COLORS: Record<ActivityType, string> = {
  [ActivityType.CALL]: DATA.slate,
  [ActivityType.MEETING]: DATA.violet,
  [ActivityType.EMAIL]: DATA.teal,
};

/** Экранная форма «Календарь/планировщик» (ТЗ п. 2.5). */
export function CalendarPage() {
  const { canSeeAll } = useAuth();
  const { data: users } = useUsers(canSeeAll);

  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [ownerUserId, setOwnerUserId] = useState('');
  const [formState, setFormState] = useState<{
    open: boolean;
    plannedAt?: Date;
  }>({ open: false });
  const [completing, setCompleting] = useState<ActivityDto | null>(null);

  // Границы выборки зависят от режима: месяц дополняется до целых недель,
  // чтобы сетка не обрывалась посреди строки
  const { from, to, days } = useMemo(() => {
    if (view === 'day') {
      return {
        from: startOfDay(anchor),
        to: endOfDay(anchor),
        days: [anchor],
      };
    }
    if (view === 'week') {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      const end = endOfWeek(anchor, { weekStartsOn: 1 });
      return {
        from: start,
        to: end,
        days: Array.from({ length: 7 }, (_, index) => addDays(start, index)),
      };
    }
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    const length = Math.round(
      (end.getTime() - start.getTime()) / (24 * 3600 * 1000) + 1,
    );
    return {
      from: start,
      to: end,
      days: Array.from({ length }, (_, index) => addDays(start, index)),
    };
  }, [view, anchor]);

  const { data: activities, isError } = useCalendarActivities({
    from: from.toISOString(),
    to: to.toISOString(),
    ...(ownerUserId ? { ownerUserId: Number(ownerUserId) } : {}),
  });

  const shift = (direction: 1 | -1) => {
    setAnchor((current) =>
      view === 'month'
        ? addMonths(current, direction)
        : view === 'week'
          ? addWeeks(current, direction)
          : addDays(current, direction),
    );
  };

  const activitiesOn = (day: Date): ActivityDto[] =>
    (activities ?? []).filter((activity) =>
      isSameDay(new Date(activity.plannedAt), day),
    );

  const periodLabel =
    view === 'day'
      ? format(anchor, 'd MMMM yyyy', { locale: ru })
      : view === 'week'
        ? `${format(from, 'd MMM', { locale: ru })} — ${format(to, 'd MMM yyyy', { locale: ru })}`
        : format(anchor, 'LLLL yyyy', { locale: ru });

  return (
    <>
      <PageHeader
        title="Календарь активностей"
        subtitle="Планирование звонков, встреч и писем"
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormState({ open: true, plannedAt: new Date() })}
          >
            Запланировать
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Не удалось загрузить активности за период
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          useFlexGap
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={() => shift(-1)} size="small">
              <ChevronLeftIcon />
            </IconButton>
            <Typography
              variant="subtitle1"
              sx={{
                minWidth: 200,
                textAlign: 'center',
                textTransform: 'capitalize',
              }}
            >
              {periodLabel}
            </Typography>
            <IconButton onClick={() => shift(1)} size="small">
              <ChevronRightIcon />
            </IconButton>
            <Button size="small" onClick={() => setAnchor(new Date())}>
              Сегодня
            </Button>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            {canSeeAll && (
              <TextField
                select
                label="Ответственный"
                value={ownerUserId}
                onChange={(event) => setOwnerUserId(event.target.value)}
                size="small"
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">Все</MenuItem>
                {users?.map((item) => (
                  <MenuItem key={item.userId} value={String(item.userId)}>
                    {item.fullName}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <ToggleButtonGroup
              size="small"
              exclusive
              value={view}
              onChange={(_event, value: ViewMode | null) =>
                value && setView(value)
              }
            >
              <ToggleButton value="month">Месяц</ToggleButton>
              <ToggleButton value="week">Неделя</ToggleButton>
              <ToggleButton value="day">День</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>
      </Paper>

      {view === 'day' ? (
        <DayAgenda
          activities={activitiesOn(anchor)}
          onComplete={setCompleting}
          onAdd={() => setFormState({ open: true, plannedAt: anchor })}
        />
      ) : (
        <Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 1,
              mb: 1,
            }}
          >
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label) => (
              <Typography
                key={label}
                variant="caption"
                color="text.secondary"
                align="center"
              >
                {label}
              </Typography>
            ))}
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 1,
            }}
          >
            {days.map((day) => {
              const dayActivities = activitiesOn(day);
              const outsideMonth =
                view === 'month' && !isSameMonth(day, anchor);
              const today = isSameDay(day, new Date());

              return (
                <Paper
                  key={day.toISOString()}
                  variant="outlined"
                  onDoubleClick={() =>
                    setFormState({
                      open: true,
                      // Новая активность по умолчанию на 10:00 выбранного дня
                      plannedAt: new Date(day.setHours(10, 0, 0, 0)),
                    })
                  }
                  sx={{
                    minHeight: view === 'week' ? 220 : 132,
                    minWidth: 0,
                    p: 1,
                    bgcolor: outsideMonth
                      ? TOKENS.surfaceSunken
                      : TOKENS.surface,
                    borderColor: today ? TOKENS.primary : undefined,
                    opacity: outsideMonth ? 0.6 : 1,
                    cursor: 'pointer',
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={today ? 700 : 400}
                    color={today ? 'primary.main' : 'text.secondary'}
                  >
                    {format(day, 'd')}
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    {dayActivities
                      .slice(0, view === 'week' ? 8 : 3)
                      .map((activity) => (
                        <Tooltip
                          key={activity.activityId}
                          title={`${ACTIVITY_TYPE_LABELS[activity.type]} · ${formatDateTime(activity.plannedAt)}${activity.client ? ` · ${activity.client.name}` : ''}`}
                        >
                          <Chip
                            size="small"
                            label={`${format(new Date(activity.plannedAt), 'HH:mm')} ${activity.subject}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (activity.status === ActivityStatus.PLANNED) {
                                setCompleting(activity);
                              }
                            }}
                            sx={{
                              justifyContent: 'flex-start',
                              fontSize: 11,
                              height: 22,
                              bgcolor:
                                activity.status === ActivityStatus.DONE
                                  ? TOKENS.border
                                  : `${TYPE_COLORS[activity.type]}18`,
                              color:
                                activity.status === ActivityStatus.DONE
                                  ? 'text.disabled'
                                  : TYPE_COLORS[activity.type],
                              textDecoration:
                                activity.status === ActivityStatus.DONE
                                  ? 'line-through'
                                  : 'none',
                              maxWidth: '100%',
                              '& .MuiChip-label': {
                                px: 0.75,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              },
                            }}
                          />
                        </Tooltip>
                      ))}
                    {dayActivities.length > (view === 'week' ? 8 : 3) && (
                      <Typography variant="caption" color="text.secondary">
                        ещё {dayActivities.length - (view === 'week' ? 8 : 3)}
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1.5 }}
          >
            Двойной щелчок по дню — запланировать активность. Щелчок по
            запланированной активности — отметить результат.
          </Typography>
        </Box>
      )}

      <ActivityFormDialog
        open={formState.open}
        plannedAt={formState.plannedAt}
        onClose={() => setFormState({ open: false })}
      />
      <CompleteActivityDialog
        open={Boolean(completing)}
        activity={completing}
        onClose={() => setCompleting(null)}
      />
    </>
  );
}

/** Режим одного дня — список активностей по времени. */
function DayAgenda({
  activities,
  onComplete,
  onAdd,
}: {
  activities: ActivityDto[];
  onComplete: (activity: ActivityDto) => void;
  onAdd: () => void;
}) {
  if (activities.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary" gutterBottom>
            На этот день активностей не запланировано
          </Typography>
          <Button startIcon={<AddIcon />} onClick={onAdd}>
            Запланировать
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={1}>
      {activities.map((activity) => (
        <Paper key={activity.activityId} variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="h6" sx={{ minWidth: 64 }}>
                {format(new Date(activity.plannedAt), 'HH:mm')}
              </Typography>
              <Box>
                <Typography variant="body1">{activity.subject}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {ACTIVITY_TYPE_LABELS[activity.type]}
                  {activity.client && ` · ${activity.client.name}`}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <ActivityStatusChip status={activity.status} />
              {activity.status === ActivityStatus.PLANNED && (
                <IconButton
                  size="small"
                  title="Отметить выполнение"
                  onClick={() => onComplete(activity)}
                >
                  <TaskAltIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
