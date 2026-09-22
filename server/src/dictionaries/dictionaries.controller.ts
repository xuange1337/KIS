import { Controller, Get } from '@nestjs/common';
import {
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  CLIENT_SOURCE_LABELS,
  CLIENT_STATUS_LABELS,
  Currency,
  DEAL_LOSS_REASON_LABELS,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_PROBABILITY,
  INDUSTRIES,
  OFFER_STATUS_LABELS,
  PREFERRED_CHANNEL_LABELS,
  USER_ROLE_LABELS,
} from '@crm/shared';

interface DictionaryItem {
  value: string;
  label: string;
}

const toItems = (labels: Record<string, string>): DictionaryItem[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/**
 * Справочники стадий, статусов, источников и типов активностей
 * (входные данные модулей 1.2.1–1.2.5). Значения берутся из общего пакета,
 * поэтому клиент и сервер не расходятся.
 */
@Controller('dictionaries')
export class DictionariesController {
  @Get()
  findAll() {
    return {
      clientStatuses: toItems(CLIENT_STATUS_LABELS),
      clientSources: toItems(CLIENT_SOURCE_LABELS),
      industries: INDUSTRIES.map((value) => ({ value, label: value })),
      dealStages: toItems(DEAL_STAGE_LABELS),
      dealLossReasons: toItems(DEAL_LOSS_REASON_LABELS),
      dealStageProbability: DEAL_STAGE_PROBABILITY,
      currencies: Object.values(Currency).map((value) => ({
        value,
        label: value,
      })),
      activityTypes: toItems(ACTIVITY_TYPE_LABELS),
      activityStatuses: toItems(ACTIVITY_STATUS_LABELS),
      preferredChannels: toItems(PREFERRED_CHANNEL_LABELS),
      offerStatuses: toItems(OFFER_STATUS_LABELS),
      userRoles: toItems(USER_ROLE_LABELS),
    };
  }
}
