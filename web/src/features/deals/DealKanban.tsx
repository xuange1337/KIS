import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import {
  BASE_CURRENCY,
  DEAL_STAGE_LABELS,
  DealDto,
  DealStage,
} from '@crm/shared';
import { DragEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '../../components/formatters';

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
    <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
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
              minWidth: 268,
              flex: '1 0 268px',
              bgcolor: hoverStage === stage ? 'primary.50' : 'grey.50',
              border: '1px solid',
              borderColor: hoverStage === stage ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 1,
              transition: 'background-color 120ms, border-color 120ms',
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ px: 0.5, py: 1 }}
            >
              <Typography variant="subtitle2">
                {DEAL_STAGE_LABELS[stage]}
              </Typography>
              <Chip size="small" label={columnDeals.length} />
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 0.5, display: 'block', mb: 1 }}
            >
              {formatMoney(total)}
              {hasOtherCurrency && ' + другие валюты'}
            </Typography>

            <Stack spacing={1}>
              {columnDeals.map((deal) => (
                <Card
                  key={deal.dealId}
                  variant="outlined"
                  draggable={!disabled}
                  onDragStart={() => setDraggedId(deal.dealId)}
                  onDragEnd={() => setDraggedId(null)}
                  onClick={() => navigate(`/deals/${deal.dealId}`)}
                  sx={{
                    cursor: disabled ? 'pointer' : 'grab',
                    opacity: draggedId === deal.dealId ? 0.4 : 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {deal.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap
                      sx={{ display: 'block' }}>
                      {deal.client?.name}
                    </Typography>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mt: 1 }}
                    >
                      <Typography variant="body2" fontWeight={500}>
                        {formatMoney(deal.amount, deal.currency)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {deal.probability}%
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
