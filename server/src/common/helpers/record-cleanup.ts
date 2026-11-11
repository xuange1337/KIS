import { EntityManager } from 'typeorm';

/**
 * Удаляет записи, которые ссылаются на клиента или сделку по паре
 * «тип + идентификатор» и потому не защищены внешним ключом:
 * комментарии, пункты чек-листа и отметки избранного.
 */
export async function deleteRecordSatellites(
  manager: Pick<EntityManager, 'query'>,
  type: 'client' | 'deal',
  id: number,
): Promise<void> {
  for (const table of ['comments', 'checklist_items']) {
    await manager.query(
      `DELETE FROM ${table} WHERE entity_type = $1 AND entity_id = $2`,
      [type, id],
    );
  }
  await manager.query(
    'DELETE FROM favorites WHERE entity_type = $1 AND entity_id = $2',
    [type, id],
  );
}
