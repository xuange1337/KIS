import { Box, Stack, Typography } from '@mui/material';
import {
  BASE_CURRENCY,
  DEAL_STAGE_LABELS,
  DealDto,
  DealStage,
} from '@crm/shared';
import { DragEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '../../components/formatters';
import { DEAL_STAGE_COLORS } from '../../components/StatusChip';
import { NEUTRAL } from '../../theme/tokens';

/** Колонки доски: рабочие стадии плюс выигранные и проигранные. */
const COLUMNS: DealStage[] = [
  DealStage.NEW,
  DealStage.QUALIFICATION,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
  DealStage.WON,
  DealStage.LOST,
];

interface DealKanbanProps {
  deals: DealDto[];
  onStageChange: (dealId: number, stage: DealStage) => void;
  disabled?: boolean;
}

/**
 * Канбан-доска сделок: перетаскивание карточки между колонками
 * вызывает смену стадии, которая фиксируется в истории на сервере.
 */
export function DealKanban({ deals, onStageChange, disabled }: DealKanbanProps) {
  const navigate = useNavigate();
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [hoverStage, setHoverStage] = useState<DealStage | null>(null);

  const handleDrop = (stage: DealStage) => (event: DragEvent) => {
    event.preventDefault();
    setHoverStage(null);
    if (draggedId === null) return;

    const deal = deals.find((item) => item.dealId === draggedId);
    setDraggedId(null);
    // Сброс в ту же колонку не должен порождать запись в истории
    if (!deal || deal.stage === stage) return;
    onStageChange(deal.dealId, stage);
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
      {COLUMNS.map((stage) => {
        const columnDeals = deals.filter((deal) => deal.stage === stage);
        // Итог по колонке считается только по базовой валюте: суммы
        // разных валют складывать нельзя, курсы в прототипе не хранятся
        const baseCurrencyDeals = columnDeals.filter(
          (deal) => deal.currency === BASE_CURRENCY,
        );
        const total = baseCurrencyDeals.reduce(
          (sum, deal) => sum + Number(deal.amount),
          0,
        );
        const hasOtherCurrency =
          baseCurrencyDeals.length !== columnDeals.length;

        return (
          <Box
            key={stage}
            onDragOver={(event) => {
              if (disabled) return;
              event.preventDefault();
              setHoverStage(stage);
            }}
            onDragLeave={() => setHoverStage(null)}
            onDrop={handleDrop(stage)}
            sx={{
              minWidth: 252,
              flex: '1 0 252px',
              // Колонка обозначена цветной чертой сверху, а не заливкой:
              // фон отвлекал бы от карточек, ради которых доска и нужна
              borderTop: `2px solid ${DEAL_STAGE_COLORS[stage]}`,
              bgcolor: hoverStage === stage ? NEUTRAL[100] : 'transparent',
              borderRadius: 0.5,
              px: 1,
              pt: 1.5,
              pb: 1,
              transition: 'background-color 120ms',
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="baseline"
              sx={{ px: 0.5, mb: 0.25 }}
            >
              <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
                {DEAL_STAGE_LABELS[stage]}
              </Typography>
              <Typography className="tabular" variant="caption">
                {columnDeals.length}
              </Typography>
            </Stack>
            <Typography
              className="tabular"
              sx={{ px: 0.5, display: 'block', mb: 1.5, fontSize: 12, color: NEUTRAL[500] }}
            >
              {formatMoney(total)}
              {hasOtherCurrency && ' +'}
            </Typography>

            <Stack spacing={1}>
              {columnDeals.map((deal) => (
                <Box
                  key={deal.dealId}
                  draggable={!disabled}
                  onDragStart={() => setDraggedId(deal.dealId)}
                  onDragEnd={() => setDraggedId(null)}
                  onClick={() => navigate(`/deals/${deal.dealId}`)}
                  sx={{
                    cursor: disabled ? 'pointer' : 'grab',
                    opacity: draggedId === deal.dealId ? 0.35 : 1,
                    bgcolor: 'background.paper',
                    border: `1px solid ${NEUTRAL[200]}`,
                    borderRadius: 1.25,
                    p: 1.5,
                    transition: 'border-color 120ms',
                    '&:hover': { borderColor: NEUTRAL[400] },
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 500, mb: 0.25 }} noWrap>
                    {deal.title}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ display: 'block' }}>
                    {deal.client?.name}
                  </Typography>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="baseline"
                    sx={{ mt: 1.25 }}
                  >
                    <Typography
                      className="tabular"
                      sx={{ fontSize: 13, fontWeight: 600 }}
                    >
                      {formatMoney(deal.amount, deal.currency)}
                    </Typography>
                    <Typography className="tabular" variant="caption">
                      {deal.probability}%
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
