import { Chip, ChipProps } from '@mui/material';
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

type Color = ChipProps['color'];

const DEAL_STAGE_COLORS: Record<DealStage, Color> = {
  [DealStage.NEW]: 'default',
  [DealStage.QUALIFICATION]: 'info',
  [DealStage.PROPOSAL]: 'primary',
  [DealStage.NEGOTIATION]: 'warning',
  [DealStage.WON]: 'success',
  [DealStage.LOST]: 'error',
};

const CLIENT_STATUS_COLORS: Record<ClientStatus, Color> = {
  [ClientStatus.LEAD]: 'default',
  [ClientStatus.IN_WORK]: 'info',
  [ClientStatus.ACTIVE]: 'success',
  [ClientStatus.ARCHIVED]: 'default',
};

const ACTIVITY_STATUS_COLORS: Record<ActivityStatus, Color> = {
  [ActivityStatus.PLANNED]: 'info',
  [ActivityStatus.DONE]: 'success',
  [ActivityStatus.CANCELED]: 'default',
};

const OFFER_STATUS_COLORS: Record<OfferStatus, Color> = {
  [OfferStatus.DRAFT]: 'default',
  [OfferStatus.SENT]: 'info',
  [OfferStatus.ACCEPTED]: 'success',
  [OfferStatus.REJECTED]: 'error',
};

/**
 * Цветовая маркировка стадий и статусов.
 * Собрана в одном компоненте, чтобы одна и та же стадия выглядела
 * одинаково в списках, карточках и на канбан-доске.
 */
export function DealStageChip({ stage }: { stage: DealStage }) {
  return (
    <Chip
      size="small"
      label={DEAL_STAGE_LABELS[stage]}
      color={DEAL_STAGE_COLORS[stage]}
      variant={stage === DealStage.NEW ? 'outlined' : 'filled'}
    />
  );
}

export function ClientStatusChip({ status }: { status: ClientStatus }) {
  return (
    <Chip
      size="small"
      label={CLIENT_STATUS_LABELS[status]}
      color={CLIENT_STATUS_COLORS[status]}
      variant="outlined"
    />
  );
}

export function ActivityStatusChip({ status }: { status: ActivityStatus }) {
  return (
    <Chip
      size="small"
      label={ACTIVITY_STATUS_LABELS[status]}
      color={ACTIVITY_STATUS_COLORS[status]}
      variant="outlined"
    />
  );
}

export function OfferStatusChip({ status }: { status: OfferStatus }) {
  return (
    <Chip
      size="small"
      label={OFFER_STATUS_LABELS[status]}
      color={OFFER_STATUS_COLORS[status]}
      variant="outlined"
    />
  );
}
