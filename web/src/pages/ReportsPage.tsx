import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import {
  ACTIVITY_TYPE_LABELS,
  ActivityType,
  BASE_CURRENCY,
  Currency,
  DEAL_STAGE_LABELS,
  ExportFormat,
  FunnelRow,
  ManagerActivityRow,
  OverdueActivityRow,
  ReportName,
  SalesDynamicsRow,
  TopRow,
} from '@crm/shared';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { DEAL_STAGE_COLORS } from '../components/StatusChip';
import { DATA, NEUTRAL, TOKENS } from '../theme/tokens';
import {
  formatDate,
  formatMoney,
  formatNumber,
  parseDateValue,
  toIsoDate,
} from '../components/formatters';
import { downloadReport, useReport, useUsers } from '../api/hooks';
import { useAuth } from '../features/auth/AuthContext';
import { extractErrorMessage } from '../api/client';

const REPORT_TABS: { name: ReportName; label: string }[] = [
  { name: 'funnel', label: 'Воронка продаж' },
  { name: 'sales-dynamics', label: 'Динамика продаж' },
  { name: 'manager-activities', label: 'Активности менеджеров' },
  { name: 'overdue-activities', label: 'Просроченные активности' },
  { name: 'top', label: 'ТОП клиентов и сделок' },
];

/** Отчёты, в которых участвуют денежные суммы. */
const MONEY_REPORTS: ReportName[] = ['funnel', 'sales-dynamics', 'top'];

/** Экранная форма «Отчёты»: период, фильтры, графики и выгрузка (ТЗ п. 2.4, 2.5). */
export function ReportsPage() {
  const { canSeeAll } = useAuth();
  const { data: users } = useUsers(canSeeAll);

  const [tab, setTab] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [granularity, setGranularity] = useState<'week' | 'month'>('month');
  const [topEntity, setTopEntity] = useState<'clients' | 'deals'>('clients');
  // Суммы разных валют не складываются: отчёт всегда считается по одной
  const [currency, setCurrency] = useState<Currency>(BASE_CURRENCY);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const report = REPORT_TABS[tab].name;

  const params = useMemo(
    () => ({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(ownerUserId ? { ownerUserId: Number(ownerUserId) } : {}),
      ...(MONEY_REPORTS.includes(report) ? { currency } : {}),
      ...(report === 'sales-dynamics' ? { granularity } : {}),
      ...(report === 'top' ? { entity: topEntity, limit: 10 } : {}),
    }),
    [from, to, ownerUserId, report, granularity, topEntity, currency],
  );

  const { data, isFetching, isError } = useReport(report, params);

  const handleExport = async (format: ExportFormat) => {
    setError(null);
    setExporting(format);
    try {
      await downloadReport(report, format, params);
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сформировать выгрузку'));
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Отчёты"
        subtitle="Формирование сводок по продажам и работе менеджеров"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_event, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: `1px solid ${TOKENS.border}` }}
        >
          {REPORT_TABS.map((item) => (
            <Tab key={item.name} label={item.label} />
          ))}
        </Tabs>

        <Box sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={6} md={2}>
              <DatePicker
                label="Период с"
                value={parseDateValue(from)}
                onChange={(value) => setFrom(toIsoDate(value))}
                slotProps={{
                  textField: { size: 'small', fullWidth: true },
                  field: { clearable: true },
                }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <DatePicker
                label="по"
                value={parseDateValue(to)}
                onChange={(value) => setTo(toIsoDate(value))}
                slotProps={{
                  textField: { size: 'small', fullWidth: true },
                  field: { clearable: true },
                }}
              />
            </Grid>
            {canSeeAll && (
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  label="Ответственный"
                  value={ownerUserId}
                  onChange={(event) => setOwnerUserId(event.target.value)}
                  size="small"
                  fullWidth
                >
                  <MenuItem value="">Все сотрудники</MenuItem>
                  {users?.map((item) => (
                    <MenuItem key={item.userId} value={String(item.userId)}>
                      {item.fullName}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            {MONEY_REPORTS.includes(report) && (
              <Grid item xs={6} md={2}>
                <TextField
                  select
                  label="Валюта"
                  value={currency}
                  onChange={(event) =>
                    setCurrency(event.target.value as Currency)
                  }
                  size="small"
                  fullWidth
                  helperText="Суммы разных валют не складываются"
                >
                  {Object.values(Currency).map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            {report === 'sales-dynamics' && (
              <Grid item xs={6} md={2}>
                <TextField
                  select
                  label="Детализация"
                  value={granularity}
                  onChange={(event) =>
                    setGranularity(event.target.value as 'week' | 'month')
                  }
                  size="small"
                  fullWidth
                >
                  <MenuItem value="week">По неделям</MenuItem>
                  <MenuItem value="month">По месяцам</MenuItem>
                </TextField>
              </Grid>
            )}
            {report === 'top' && (
              <Grid item xs={6} md={2}>
                <TextField
                  select
                  label="Ранжировать"
                  value={topEntity}
                  onChange={(event) =>
                    setTopEntity(event.target.value as 'clients' | 'deals')
                  }
                  size="small"
                  fullWidth
                >
                  <MenuItem value="clients">Клиентов</MenuItem>
                  <MenuItem value="deals">Сделки</MenuItem>
                </TextField>
              </Grid>
            )}
            <Grid item xs={12} md sx={{ textAlign: { md: 'right' } }}>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                {(['csv', 'xlsx', 'pdf'] as ExportFormat[]).map((format) => (
                  <Button
                    key={format}
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    disabled={exporting !== null}
                    onClick={() => handleExport(format)}
                  >
                    {format.toUpperCase()}
                  </Button>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {isFetching && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {isError && <Alert severity="error">Не удалось построить отчёт</Alert>}

      {!isFetching && !isError && data && (
        <>
          {report === 'funnel' && (
            <FunnelReport rows={data as FunnelRow[]} currency={currency} />
          )}
          {report === 'sales-dynamics' && (
            <SalesDynamicsReport
              rows={data as SalesDynamicsRow[]}
              currency={currency}
            />
          )}
          {report === 'manager-activities' && (
            <ManagerActivitiesReport rows={data as ManagerActivityRow[]} />
          )}
          {report === 'overdue-activities' && (
            <OverdueReport rows={data as OverdueActivityRow[]} />
          )}
          {report === 'top' && (
            <TopReport
              rows={data as TopRow[]}
              entity={topEntity}
              currency={currency}
            />
          )}
        </>
      )}
    </>
  );
}

function FunnelReport({
  rows,
  currency,
}: {
  rows: FunnelRow[];
  currency: Currency;
}) {
  const chartData = rows.map((row) => ({
    ...row,
    label: DEAL_STAGE_LABELS[row.stage],
  }));

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={7}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Сумма сделок по стадиям
            </Typography>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData} margin={{ left: 20 }}>
                <CartesianGrid stroke={NEUTRAL[100]} vertical={false} />
                <XAxis dataKey="label" fontSize={11} stroke={NEUTRAL[400]} interval={0} angle={-15} textAnchor="end" height={70} />
                <YAxis
                  fontSize={11} stroke={NEUTRAL[400]}
                  tickFormatter={(value: number) =>
                    `${Math.round(value / 1000)} тыс.`
                  }
                />
                <ChartTooltip
                  formatter={(value: number) => formatMoney(value, currency)}
                  labelFormatter={(label: string) => label}
                />
                <Bar
                  dataKey="amount"
                  name="Сумма"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                >
                  {chartData.map((row) => (
                    <Cell key={row.stage} fill={DEAL_STAGE_COLORS[row.stage]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={5}>
        <ReportTable
          headers={['Стадия', 'Сделок', 'Сумма']}
          rows={rows.map((row) => [
            DEAL_STAGE_LABELS[row.stage],
            formatNumber(row.count),
            formatMoney(row.amount, currency),
          ])}
          totals={[
            'Итого',
            formatNumber(rows.reduce((sum, row) => sum + row.count, 0)),
            formatMoney(
              rows.reduce((sum, row) => sum + row.amount, 0),
              currency,
            ),
          ]}
        />
      </Grid>
    </Grid>
  );
}

function SalesDynamicsReport({
  rows,
  currency,
}: {
  rows: SalesDynamicsRow[];
  currency: Currency;
}) {
  const chartData = rows.map((row) => ({
    ...row,
    label: formatDate(row.period),
  }));

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={7}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Сумма закрытых сделок по периодам
            </Typography>
            {rows.length === 0 ? (
              <EmptyReport />
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={chartData} margin={{ left: 20 }}>
                  <CartesianGrid stroke={NEUTRAL[100]} vertical={false} />
                  <XAxis dataKey="label" fontSize={11} stroke={NEUTRAL[400]} />
                  <YAxis
                    fontSize={11} stroke={NEUTRAL[400]}
                    tickFormatter={(value: number) =>
                      `${Math.round(value / 1000)} тыс.`
                    }
                  />
                  <ChartTooltip formatter={(value: number) => formatMoney(value, currency)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    name="Сумма продаж"
                    stroke={DATA.indigo}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={5}>
        <ReportTable
          headers={['Период', 'Сделок', 'Сумма']}
          rows={rows.map((row) => [
            formatDate(row.period),
            formatNumber(row.count),
            formatMoney(row.amount, currency),
          ])}
          totals={[
            'Итого',
            formatNumber(rows.reduce((sum, row) => sum + row.count, 0)),
            formatMoney(
              rows.reduce((sum, row) => sum + row.amount, 0),
              currency,
            ),
          ]}
        />
      </Grid>
    </Grid>
  );
}

function ManagerActivitiesReport({ rows }: { rows: ManagerActivityRow[] }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={7}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Коммуникации по сотрудникам
            </Typography>
            {rows.length === 0 ? (
              <EmptyReport />
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={rows} margin={{ left: 20 }}>
                  <CartesianGrid stroke={NEUTRAL[100]} vertical={false} />
                  <XAxis dataKey="fullName" fontSize={11} stroke={NEUTRAL[400]} />
                  <YAxis fontSize={11} stroke={NEUTRAL[400]} allowDecimals={false} />
                  <ChartTooltip />
                  <Legend />
                  <Bar
                    dataKey="calls"
                    name={ACTIVITY_TYPE_LABELS[ActivityType.CALL]}
                    stackId="a"
                    isAnimationActive={false}
                    {...{ fill: DATA.slate }}
                  />
                  <Bar
                    dataKey="meetings"
                    name={ACTIVITY_TYPE_LABELS[ActivityType.MEETING]}
                    stackId="a"
                    isAnimationActive={false}
                    {...{ fill: DATA.indigo }}
                  />
                  <Bar
                    dataKey="emails"
                    name={ACTIVITY_TYPE_LABELS[ActivityType.EMAIL]}
                    stackId="a"
                    isAnimationActive={false}
                    {...{ fill: DATA.green }}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={5}>
        <ReportTable
          headers={['Сотрудник', 'Звонки', 'Встречи', 'Письма', 'Всего']}
          rows={rows.map((row) => [
            row.fullName,
            formatNumber(row.calls),
            formatNumber(row.meetings),
            formatNumber(row.emails),
            formatNumber(row.total),
          ])}
        />
      </Grid>
    </Grid>
  );
}

function OverdueReport({ rows }: { rows: OverdueActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ py: 6, textAlign: 'center' }}>
          <Typography color="success.main">Просроченных активностей нет</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <ReportTable
      headers={[
        'Тип',
        'Тема',
        'Клиент',
        'Запланирована',
        'Просрочка, дней',
        'Ответственный',
      ]}
      rows={rows.map((row) => [
        ACTIVITY_TYPE_LABELS[row.type],
        row.subject,
        row.clientName,
        formatDate(row.plannedAt),
        formatNumber(row.daysOverdue),
        row.ownerName,
      ])}
    />
  );
}

function TopReport({
  rows,
  entity,
  currency,
}: {
  rows: TopRow[];
  entity: 'clients' | 'deals';
  currency: Currency;
}) {
  return (
    <ReportTable
      headers={[
        entity === 'clients' ? 'Клиент' : 'Сделка',
        'Сделок',
        'Сумма',
      ]}
      rows={rows.map((row) => [
        row.name,
        formatNumber(row.dealsCount),
        formatMoney(row.amount, currency),
      ])}
      totals={[
        'Итого',
        formatNumber(rows.reduce((sum, row) => sum + row.dealsCount, 0)),
        formatMoney(
              rows.reduce((sum, row) => sum + row.amount, 0),
              currency,
            ),
      ]}
    />
  );
}

/** Табличное представление отчёта — общее для всех вкладок. */
function ReportTable({
  headers,
  rows,
  totals,
}: {
  headers: string[];
  rows: (string | number)[][];
  totals?: (string | number)[];
}) {
  return (
    <Paper variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            {headers.map((header, index) => (
              <TableCell
                key={header}
                align={index === 0 ? 'left' : 'right'}
                sx={{ fontWeight: 600 }}
              >
                {header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={headers.length} align="center" sx={{ py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Данных за выбранный период нет
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIndex) => (
              <TableRow key={rowIndex} hover>
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={cellIndex}
                    align={cellIndex === 0 ? 'left' : 'right'}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
          {totals && rows.length > 0 && (
            <TableRow>
              {totals.map((cell, index) => (
                <TableCell
                  key={index}
                  align={index === 0 ? 'left' : 'right'}
                  sx={{ fontWeight: 600, bgcolor: 'grey.50' }}
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}

function EmptyReport() {
  return (
    <Box sx={{ py: 8, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        Данных за выбранный период нет
      </Typography>
    </Box>
  );
}
