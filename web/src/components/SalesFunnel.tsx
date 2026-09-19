import { Box, Divider, Stack, Tooltip, Typography } from '@mui/material';
import {
  Currency,
  DEAL_FUNNEL_STAGES,
  DEAL_STAGE_LABELS,
  DealStage,
  FunnelRow,
} from '@crm/shared';
import { DEAL_STAGE_COLORS } from './StatusChip';
import { formatMoney, formatNumber } from './formatters';
import { TOKENS } from '../theme/tokens';

/**
 * Воронка продаж.
 *
 * Полоса показывает долю стадии в общей сумме сделок в работе — это доля,
 * а не процент прохождения, поэтому рядом отдельно выводится конверсия:
 * сколько сделок из числа закрытых дошло до выигрыша. Раньше длина полосы
 * задавалась относительно максимума и легко читалась как процент, которым
 * она не являлась.
 */
export function SalesFunnel({
  rows,
  currency,
}: {
  rows: FunnelRow[];
  currency: Currency;
}) {
  const working = rows.filter((row) => DEAL_FUNNEL_STAGES.includes(row.stage));
  const won = rows.find((row) => row.stage === DealStage.WON);
  const lost = rows.find((row) => row.stage === DealStage.LOST);

  const workingAmount = working.reduce((sum, row) => sum + row.amount, 0);
  const closed = (won?.count ?? 0) + (lost?.count ?? 0);
  const conversion =
    closed > 0 ? Math.round(((won?.count ?? 0) / closed) * 100) : null;

  return (
    <Box>
      <Stack spacing={1.75}>
        {working.map((row) => {
          const share = workingAmount > 0 ? row.amount / workingAmount : 0;
          return (
            <Box key={row.stage}>
              <Stack
                direction="row"
                alignItems="baseline"
                spacing={1.5}
                sx={{ mb: 0.625 }}
              >
                <Typography
                  sx={{ fontSize: 13, flexGrow: 1, minWidth: 0 }}
                  noWrap
                >
                  {DEAL_STAGE_LABELS[row.stage]}
                </Typography>
                <Typography
                  className="tabular"
                  sx={{
                    fontSize: 12.5,
                    color: TOKENS.textSecondary,
                    width: 28,
                    textAlign: 'right',
                  }}
                >
                  {formatNumber(row.count)}
                </Typography>
                <Typography
                  className="tabular"
                  sx={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    width: 116,
                    textAlign: 'right',
                  }}
                >
                  {formatMoney(row.amount, currency)}
                </Typography>
              </Stack>

              <Tooltip
                title={`${Math.round(share * 100)}% суммы сделок в работе`}
                placement="top"
              >
                <Box
                  sx={{ height: 3, borderRadius: 2, bgcolor: TOKENS.border }}
                  role="img"
                  aria-label={`Доля стадии: ${Math.round(share * 100)} процентов суммы сделок в работе`}
                >
                  <Box
                    sx={{
                      height: '100%',
                      borderRadius: 2,
                      width: `${Math.max(share * 100, 1.5)}%`,
                      bgcolor: DEAL_STAGE_COLORS[row.stage],
                    }}
                  />
                </Box>
              </Tooltip>
            </Box>
          );
        })}
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Stack spacing={1}>
        {won && (
          <Stack direction="row" alignItems="baseline" spacing={1.5}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, flexGrow: 1 }}>
              {DEAL_STAGE_LABELS[DealStage.WON]}
            </Typography>
            <Typography
              className="tabular"
              sx={{
                fontSize: 12.5,
                color: TOKENS.textSecondary,
                width: 28,
                textAlign: 'right',
              }}
            >
              {formatNumber(won.count)}
            </Typography>
            <Typography
              className="tabular"
              sx={{
                fontSize: 13,
                fontWeight: 600,
                color: TOKENS.success,
                width: 116,
                textAlign: 'right',
              }}
            >
              {formatMoney(won.amount, currency)}
            </Typography>
          </Stack>
        )}

        {conversion !== null && (
          <Stack direction="row" alignItems="baseline" spacing={1.5}>
            <Typography
              sx={{ fontSize: 12.5, color: TOKENS.textSecondary, flexGrow: 1 }}
            >
              Конверсия закрытых сделок
            </Typography>
            <Typography
              className="tabular"
              sx={{ fontSize: 12.5, fontWeight: 500 }}
            >
              {conversion}%
            </Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
