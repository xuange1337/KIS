import { OfferDto } from '@crm/shared';
import { useSaveOfferItems } from '../../api/hooks';
import { ItemsEditorDialog } from '../items/ItemsEditorDialog';

export function OfferItemsDialog({
  offer,
  onClose,
}: {
  offer: OfferDto;
  onClose: () => void;
}) {
  const save = useSaveOfferItems();
  return (
    <ItemsEditorDialog
      title={`Состав предложения ${offer.number}`}
      currency={offer.currency}
      currentAmount={offer.totalAmount}
      info={`Сохранение заменит сумму предложения итогом позиций в ${offer.currency}. Цена и название сохраняются в документе независимо от каталога.`}
      emptyText="Список пуст. После сохранения сумма станет нулевой."
      discardMessage="Изменения состава предложения будут потеряны."
      items={offer.items ?? []}
      saving={save.isPending}
      onClose={onClose}
      onSave={async (items) => {
        await save.mutateAsync({
          offerId: offer.offerId,
          version: offer.version,
          items,
        });
      }}
    />
  );
}
