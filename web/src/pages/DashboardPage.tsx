import { Alert, Box, Button, Grid, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { ActivityDto } from '@crm/shared';
import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { MetricRow, MetricTile } from '../components/MetricTile';
import { SalesFunnel } from '../components/SalesFunnel';
import { ActivityList } from '../components/ActivityList';
import { ListSkeleton, MetricsSkeleton } from '../components/Skeletons';
import { formatMoney, formatNumber } from '../components/formatters';
import { CompleteActivityDialog } from '../features/activities/CompleteActivityDialog';
import { DealFormDialog } from '../features/deals/DealFormDialog';
import { useDashboard } from '../api/hooks';
import { useAuth } from '../features/auth/AuthContext';
import { TOKENS } from '../theme/tokens';

/** Сколько просроченных активностей показывать на главной. */
const OVERDUE_PREVIEW = 4;

/**
 * Главная страница (ТЗ п. 2.5).
 *
 * Порядок блоков повторяет порядок вопросов, на которые менеджер отвечает
 * в начале дня: что горит, что запланировано, в каком состоянии воронка.
 * Поэтому просроченные активности стоят выше остальных списков.
 */
export function DashboardPage() {
  const { user, canSeeAll } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useDashboard();

  const [completing, setCompleting] = useState<ActivityDto | null>(null);
  const [dealFormOpen, setDealFormOpen] = useState(false);

  const firstName = user?.fullName.split(' ')[1] ?? user?.fullName ?? '';

  const header = (
    <PageHeader
      title={`Здравствуйте, ${firstName}`}
      subtitle={
        canSeeAll
          ? 'Сводные показатели по отделу продаж'
          : 'Сводные показатели по вашим клиентам и сделкам'
      }
      actions={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDealFormOpen(true)}
        >
          Новая сделка
        </Button>
      }
    />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <MetricsSkeleton />
        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid item xs={12} lg={5}>
            <Panel title="Воронка продаж">
              <ListSkeleton rows={4} />
            </Panel>
          </Grid>
          <Grid item xs={12} lg={7}>
            <Panel title="Ближайшие активности">
              <ListSkeleton rows={6} />
            </Panel>
          </Grid>
        </Grid>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        {header}
        <Alert severity="error">
          Не удалось загрузить показатели. Проверьте соединение с сервером
        </Alert>
      </>
    );
  }

  return (
    <>
      {header}

      <MetricRow>
        <MetricTile
          label="Сделок в работе"
          value={formatNumber(data.dealsInWork)}
          context={formatMoney(data.dealsInWorkAmount, data.currency)}
          icon={<SwapHorizOutlinedIcon />}
          to="/deals"
        />
        <MetricTile
          label="Выиграно за месяц"
          value={formatNumber(data.wonThisMonthCount)}
          context={
            data.wonThisMonthCount > 0
              ? formatMoney(data.wonThisMonthAmount, data.currency)
              : 'В этом месяце сделок не закрыто'
          }
          icon={<CheckCircleOutlineIcon />}
          tone={data.wonThisMonthCount > 0 ? 'success' : 'neutral'}
          to="/reports"
        />
        <MetricTile
          label="Активностей сегодня"
          value={formatNumber(data.plannedTodayCount)}
          context={
            data.plannedTodayCount > 0
              ? 'запланировано'
              : 'На сегодня ничего не запланировано'
          }
          icon={<EventAvailableOutlinedIcon />}
          to="/calendar"
        />
        <MetricTile
          label="Просрочено"
          value={formatNumber(data.overdueCount)}
          context={
            data.overdueCount > 0
              ? 'требуют внимания'
              : 'просроченных задач нет'
          }
          icon={<WarningAmberOutlinedIcon />}
          tone={data.overdueCount > 0 ? 'danger' : 'neutral'}
          to="/calendar"
          last
        />
      </MetricRow>

      <Grid container spacing={3} sx={{ mt: 0 }}>
        {/* Просроченное идёт первым: это единственное, что требует
            немедленного решения, остальное — планирование */}
        {data.overdueActivities.length > 0 && (
          <Grid item xs={12}>
            <Panel
              title={`Требуют внимания · ${data.overdueCount}`}
              tone="danger"
              action={{
                label: 'Все просроченные',
                onClick: () => navigate('/reports'),
              }}
            >
              {/* Показываем только начало списка: иначе просрочка вытесняет
                  с первого экрана планы на сегодня и состояние воронки */}
              <ActivityList
                activities={data.overdueActivities.slice(0, OVERDUE_PREVIEW)}
                emptyText=""
                onComplete={setCompleting}
              />
            </Panel>
          </Grid>
        )}

        <Grid item xs={12} lg={7}>
          <Panel title="Ближайшие активности">
            <ActivityList
              activities={data.upcomingActivities}
              emptyText="Ближайших активностей нет"
              emptyHint="Запланируйте звонок или встречу в разделе «Календарь»"
              onComplete={setCompleting}
            />
          </Panel>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Panel
            title="Воронка продаж"
            action={{ label: 'Все сделки', onClick: () => navigate('/deals') }}
          >
            <SalesFunnel rows={data.funnel} currency={data.currency} />
          </Panel>
        </Grid>
      </Grid>

      <CompleteActivityDialog
        open={Boolean(completing)}
        activity={completing}
        onClose={() => setCompleting(null)}
      />
      <DealFormDialog
        open={dealFormOpen}
        onClose={() => setDealFormOpen(false)}
        onSaved={(deal) => navigate(`/deals/${deal.dealId}`)}
      />
    </>
  );
}

/** Блок дашборда: заголовок капителью и рамка вокруг содержимого. */
function Panel({
  title,
  tone,
  action,
  children,
}: {
  title: string;
  tone?: 'danger';
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.25,
          minHeight: 22,
        }}
      >
        <Typography
          variant="overline"
          component="h2"
          sx={{ color: tone === 'danger' ? TOKENS.danger : undefined }}
        >
          {title}
        </Typography>
        {action && (
          <Button
            size="small"
            onClick={action.onClick}
            sx={{ py: 0.25, minHeight: 0 }}
          >
            {action.label}
          </Button>
        )}
      </Box>
      <Box
        sx={{
          border: `1px solid ${tone === 'danger' ? TOKENS.dangerBorder : TOKENS.border}`,
          borderRadius: 2,
          bgcolor: TOKENS.surface,
          px: 2.5,
          py: 2,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
