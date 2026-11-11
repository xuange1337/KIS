import {
  Alert,
  Box,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { BASE_CURRENCY } from '@crm/shared';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useConversion, useForecast, useManagerRanking } from '../api/hooks';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { formatMoney, formatNumber } from '../components/formatters';
import { DATA, TOKENS } from '../theme/tokens';

const MONTHS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

/** «2026-11» → «ноя 2026». */
function monthLabel(month: string | null): string {
  if (!month) return 'Без даты';
  const [year, number] = month.split('-');
  return `${MONTHS[Number(number) - 1]} ${year}`;
}

const percent = (value: number | null) =>
  value === null ? '—' : `${formatNumber(value)} %`;

/** Аналитика продаж: что ждать от воронки, где теряются сделки, кто как работает. */
export function AnalyticsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const period = {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const forecast = useForecast(6);
  const conversion = useConversion(period);
  const managers = useManagerRanking(period);

  const chartData =
    forecast.data?.map((row) => ({
      label: monthLabel(row.month),
      amount: row.amount,
      weighted: row.weightedAmount,
    })) ?? [];
  const maxReached = Math.max(
    1,
    ...(conversion.data?.map((r) => r.reached) ?? []),
  );

  return (
    <>
      <PageHeader
        title="Аналитика"
        subtitle="Прогноз поступлений, прохождение воронки и показатели менеджеров"
        actions={
          <Stack direction="row" spacing={1}>
            <TextField
              type="date"
              size="small"
              label="С даты"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="date"
              size="small"
              label="По дату"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        }
      />
      {(forecast.isError || conversion.isError || managers.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Не удалось загрузить часть данных. Обновите страницу
        </Alert>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6">Прогноз по месяцам</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Открытые сделки по плановой дате закрытия. Взвешенная сумма
                учитывает вероятность стадии
              </Typography>
              {forecast.isLoading && (
                <Skeleton variant="rounded" height={260} />
              )}
              {forecast.data && forecast.data.length === 0 && (
                <EmptyState
                  dense
                  title="Открытых сделок нет"
                  hint="Прогноз появится, когда в работе будут сделки с плановой датой"
                />
              )}
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid stroke={TOKENS.border} vertical={false} />
                    <XAxis
                      dataKey="label"
                      fontSize={11}
                      stroke={TOKENS.textMuted}
                    />
                    <YAxis
                      fontSize={11}
                      stroke={TOKENS.textMuted}
                      tickFormatter={(value: number) =>
                        `${Math.round(value / 1000)} тыс.`
                      }
                    />
                    <ChartTooltip
                      formatter={(value: number) =>
                        formatMoney(value, BASE_CURRENCY)
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="amount"
                      name="Сумма"
                      fill={DATA.slate}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="weighted"
                      name="Взвешенная"
                      fill={DATA.green}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {forecast.data?.some((row) => row.otherCurrencyCount > 0) && (
                <Typography variant="caption" color="text.secondary">
                  Сделки в валюте, отличной от рубля, в суммы не входят
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6">Конверсия воронки</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Сколько сделок дошло до стадии и какая доля прошла дальше
              </Typography>
              {conversion.isLoading && (
                <Skeleton variant="rounded" height={200} />
              )}
              <Stack spacing={1.5}>
                {conversion.data?.map((row) => (
                  <Box key={row.stage}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: 13 }}>{row.label}</Typography>
                      <Typography sx={{ fontSize: 13 }}>
                        {row.reached}
                        {row.conversionFromPrevious !== null &&
                          ` · ${percent(row.conversionFromPrevious)}`}
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        bgcolor: TOKENS.surfaceSunken,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${(row.reached / maxReached) * 100}%`,
                          bgcolor: DATA.indigo,
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Менеджеры
              </Typography>
              {managers.isLoading && (
                <Skeleton variant="rounded" height={160} />
              )}
              {managers.data && (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Менеджер</TableCell>
                        <TableCell align="right">Выиграно</TableCell>
                        <TableCell align="right">Сумма выигранных</TableCell>
                        <TableCell align="right">Проиграно</TableCell>
                        <TableCell align="right">Доля выигрышей</TableCell>
                        <TableCell align="right">Средний цикл, дн.</TableCell>
                        <TableCell align="right">В работе</TableCell>
                        <TableCell align="right">Просрочено дел</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {managers.data.map((row) => (
                        <TableRow key={row.userId} hover>
                          <TableCell>{row.fullName}</TableCell>
                          <TableCell align="right">{row.dealsWon}</TableCell>
                          <TableCell align="right">
                            {formatMoney(row.wonAmount, BASE_CURRENCY)}
                          </TableCell>
                          <TableCell align="right">{row.dealsLost}</TableCell>
                          <TableCell align="right">
                            {percent(row.winRate)}
                          </TableCell>
                          <TableCell align="right">
                            {row.avgCycleDays === null
                              ? '—'
                              : formatNumber(row.avgCycleDays)}
                          </TableCell>
                          <TableCell align="right">
                            {row.openDeals} ·{' '}
                            {formatMoney(row.openAmount, BASE_CURRENCY)}
                          </TableCell>
                          <TableCell align="right">
                            {row.overdueActivities}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
