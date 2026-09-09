import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import CallIcon from '@mui/icons-material/Call';
import EmailIcon from '@mui/icons-material/Email';
import EventIcon from '@mui/icons-material/Event';
import {
  ACTIVITY_TYPE_LABELS,
  ActivityDto,
  ActivityType,
  Currency,
  DEAL_STAGE_LABELS,
  DEAL_FUNNEL_STAGES,
  DealStage,
  FunnelRow,
} from '@crm/shared';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import {
  formatMoney,
  formatNumber,
  formatShortDateTime,
} from '../components/formatters';
import { useDashboard } from '../api/hooks';
import { useAuth } from '../features/auth/AuthContext';

const ACTIVITY_ICONS: Record<ActivityType, ReactNode> = {
  [ActivityType.CALL]: <CallIcon fontSize="small" color="action" />,
  [ActivityType.MEETING]: <EventIcon fontSize="small" color="action" />,
  [ActivityType.EMAIL]: <EmailIcon fontSize="small" color="action" />,
};

/** Главная страница: показатели, уведомления, ближайшие активности (ТЗ п. 2.5). */
export function DashboardPage() {
  const { user, canSeeAll } = useAuth();
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !data) {
    return <Alert severity="error">Не удалось загрузить показатели</Alert>;
  }

  return (
    <>
      <PageHeader
        title={`Здравствуйте, ${user?.fullName.split(' ')[1] ?? user?.fullName}`}
        subtitle={
          canSeeAll
            ? 'Сводные показатели по отделу продаж'
            : 'Сводные показатели по вашим клиентам и сделкам'
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <KpiTile
          label="Сделок в работе"
          value={formatNumber(data.dealsInWork)}
          hint={formatMoney(data.dealsInWorkAmount, data.currency)}
        />
        <KpiTile
          label="Выиграно за месяц"
          value={formatNumber(data.wonThisMonthCount)}
          hint={formatMoney(data.wonThisMonthAmount, data.currency)}
          color="success.main"
        />
        <KpiTile
          label="Активностей на сегодня"
          value={formatNumber(data.plannedTodayCount)}
          hint="запланировано"
        />
        <KpiTile
          label="Просроченные активности"
          value={formatNumber(data.overdueCount)}
          hint={data.overdueCount > 0 ? 'требуют внимания' : 'просрочек нет'}
          color={data.overdueCount > 0 ? 'error.main' : 'text.primary'}
        />
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Воронка продаж
              </Typography>
              <FunnelBars rows={data.funnel} currency={data.currency} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ближайшие активности
              </Typography>
              <ActivityList
                activities={data.upcomingActivities}
                emptyText="Запланированных активностей нет"
              />

              {data.overdueActivities.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" color="error.main" gutterBottom>
                    Просроченные
                  </Typography>
                  <ActivityList
                    activities={data.overdueActivities}
                    emptyText=""
                    overdue
                  />
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}

function KpiTile({
  label,
  value,
  hint,
  color = 'text.primary',
}: {
  label: string;
  value: string;
  hint: string;
  color?: string;
}) {
  return (
    <Grid item xs={12} sm={6} lg={3}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {label}
          </Typography>
          <Typography variant="h4" sx={{ color, fontWeight: 600 }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}

/**
 * Мини-воронка на дашборде: только рабочие стадии.
 * Ширина полосы пропорциональна максимальной сумме, поэтому
 * соотношение стадий читается без осей и подписей.
 */
function FunnelBars({
  rows,
  currency,
}: {
  rows: FunnelRow[];
  currency: Currency;
}) {
  const working = rows.filter((row) => DEAL_FUNNEL_STAGES.includes(row.stage));
  const maxAmount = Math.max(...working.map((row) => row.amount), 1);
  const won = rows.find((row) => row.stage === DealStage.WON);

  return (
    <Stack spacing={1.5}>
      {working.map((row) => (
        <Box key={row.stage}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="body2">
              {DEAL_STAGE_LABELS[row.stage]}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {row.count} · {formatMoney(row.amount, currency)}
            </Typography>
          </Stack>
          <Box
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'grey.100',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${Math.max((row.amount / maxAmount) * 100, 2)}%`,
                bgcolor: 'primary.main',
              }}
            />
          </Box>
        </Box>
      ))}

      {won && (
        <>
          <Divider sx={{ pt: 1 }} />
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="success.main">
              {DEAL_STAGE_LABELS[DealStage.WON]}
            </Typography>
            <Typography variant="body2" color="success.main" fontWeight={500}>
              {won.count} · {formatMoney(won.amount, currency)}
            </Typography>
          </Stack>
        </>
      )}
    </Stack>
  );
}

function ActivityList({
  activities,
  emptyText,
  overdue,
}: {
  activities: ActivityDto[];
  emptyText: string;
  overdue?: boolean;
}) {
  if (activities.length === 0) {
    return emptyText ? (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    ) : null;
  }

  return (
    <List dense disablePadding>
      {activities.map((activity) => (
        <ListItem
          key={activity.activityId}
          disableGutters
          secondaryAction={
            <Chip
              size="small"
              label={formatShortDateTime(activity.plannedAt)}
              color={overdue ? 'error' : 'default'}
              variant="outlined"
            />
          }
        >
          <Box sx={{ mr: 1.5, display: 'flex' }}>
            {ACTIVITY_ICONS[activity.type]}
          </Box>
          <ListItemText
            primary={activity.subject}
            secondary={
              activity.client ? (
                <Link
                  to={`/clients/${activity.client.clientId}`}
                  style={{ color: 'inherit' }}
                >
                  {activity.client.name}
                </Link>
              ) : (
                ACTIVITY_TYPE_LABELS[activity.type]
              )
            }
            primaryTypographyProps={{ fontSize: 14 }}
            secondaryTypographyProps={{ fontSize: 12 }}
            sx={{ pr: 12 }}
          />
        </ListItem>
      ))}
    </List>
  );
}
