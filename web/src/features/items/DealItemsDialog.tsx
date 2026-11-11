import { DealDto } from '@crm/shared';
import { useDealItems, useSaveDealItems } from '../../api/hooks';
import { ItemsEditorDialog } from './ItemsEditorDialog';

export function DealItemsDialog({
  deal,
  onClose,
}: {
  deal: DealDto;
  onClose: () => void;
}) {
  const { data } = useDealItems(deal.dealId);
  const save = useSaveDealItems();
  // Редактор берёт состав при открытии, поэтому ждём загрузки: иначе
  // сохранение пустой формы стёрло бы настоящий состав
  if (!data) return null;
  return (
    <ItemsEditorDialog
      title="Состав сделки"
      currency={deal.currency}
      currentAmount={deal.amount}
      info={`Пока в сделке есть позиции, её сумма равна итогу по ним в ${deal.currency} и вручную не меняется. Цена и название сохраняются в сделке независимо от каталога.`}
      emptyText="Список пуст. Сумма сделки останется прежней и снова будет вводиться вручную."
      discardMessage="Изменения состава сделки будут потеряны."
      items={data}
      saving={save.isPending}
      onClose={onClose}
      onSave={async (items) => {
        await save.mutateAsync({
          dealId: deal.dealId,
          version: deal.version,
          items,
        });
      }}
    />
  );
}
