import { Box, Stack, Typography } from '@mui/material';
import {
  ACTIVITY_STATUS_LABELS,
  ActivityStatus,
  CLIENT_STATUS_LABELS,
  ClientStatus,
  DEAL_STAGE_LABELS,
  DealStage,
  OFFER_STATUS_LABELS,
  OfferStatus,
} from '@crm/shared';
import { DATA, DOT_NEUTRAL, NEUTRAL, TOKENS } from '../theme/tokens';

/**
 * Маркировка стадий и статусов.
 *
 * Вместо цветных заливок — точка нужного цвета и обычный текст. Плашки
 * в плотной таблице спорят друг с другом и перетягивают внимание, а точка
 * читается так же однозначно и не мешает просматривать список по вертикали.
 * Цвета собраны здесь, поэтому стадия выглядит одинаково в списке,
 * в карточке и на канбан-доске.
 */

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  [DealStage.NEW]: DOT_NEUTRAL,
  [DealStage.QUALIFICATION]: DATA.slate,
  [DealStage.PROPOSAL]: DATA.indigo,
  [DealStage.NEGOTIATION]: DATA.amber,
  [DealStage.WON]: DATA.green,
  [DealStage.LOST]: DATA.red,
};

const CLIENT_STATUS_COLORS: Record<ClientStatus, string> = {
  [ClientStatus.LEAD]: DOT_NEUTRAL,
  [ClientStatus.IN_WORK]: DATA.indigo,
  [ClientStatus.ACTIVE]: DATA.green,
  [ClientStatus.ARCHIVED]: DOT_NEUTRAL,
};

const ACTIVITY_STATUS_COLORS: Record<ActivityStatus, string> = {
  [ActivityStatus.PLANNED]: DATA.indigo,
  [ActivityStatus.DONE]: DATA.green,
  [ActivityStatus.CANCELED]: DOT_NEUTRAL,
};

const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  [OfferStatus.DRAFT]: DOT_NEUTRAL,
  [OfferStatus.SENT]: DATA.indigo,
  [OfferStatus.ACCEPTED]: DATA.green,
  [OfferStatus.REJECTED]: DATA.red,
};

/**
 * Точка с подписью — базовый элемент маркировки.
 *
 * Завершённые и отменённые состояния помечаются не бледной заливкой, а
 * полой точкой: осветлять её дальше некуда, на белом она перестаёт
 * различаться, а контур читается и остаётся отличим от активных стадий.
 */
function Marker({
  color,
  label,
  muted,
}: {
  color: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.875}
      // Высота на всю ячейку: иначе в таблице маркер прижимается к верху
      // строки и не совпадает по базовой линии с соседними колонками
      sx={{ minWidth: 0, height: '100%' }}
    >
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: muted ? 'transparent' : color,
          border: muted ? `1.5px solid ${color}` : 'none',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      />
      <Typography
        noWrap
        sx={{
          fontSize: 13,
          fontWeight: 500,
          color: muted ? TOKENS.textSecondary : NEUTRAL[800],
        }}
      >
        {label}
      </Typography>
    </Stack>
  );
}

export function DealStageChip({ stage }: { stage: DealStage }) {
  return (
    <Marker
      color={DEAL_STAGE_COLORS[stage]}
      label={DEAL_STAGE_LABELS[stage]}
      muted={stage === DealStage.LOST}
    />
  );
}

export function ClientStatusChip({ status }: { status: ClientStatus }) {
  return (
    <Marker
      color={CLIENT_STATUS_COLORS[status]}
      label={CLIENT_STATUS_LABELS[status]}
      muted={status === ClientStatus.ARCHIVED}
    />
  );
}

export function ActivityStatusChip({ status }: { status: ActivityStatus }) {
  return (
    <Marker
      color={ACTIVITY_STATUS_COLORS[status]}
      label={ACTIVITY_STATUS_LABELS[status]}
      muted={status === ActivityStatus.CANCELED}
    />
  );
}

export function OfferStatusChip({ status }: { status: OfferStatus }) {
  return (
    <Marker
      color={OFFER_STATUS_COLORS[status]}
      label={OFFER_STATUS_LABELS[status]}
      muted={status === OfferStatus.DRAFT}
    />
  );
}
