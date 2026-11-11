import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

describe('Комментарии и чек-листы', () => {
  let app: INestApplication;
  let head: string;
  let manager: string;
  let other: string;
  let managerId: number;
  let dealId: number;
  let clientId: number;
  let itemId: number;
  let commentId: number;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: bearer(token) });

  beforeAll(async () => {
    app = await createTestApp();
    head = await login(app, 'head', 'head123');
    manager = await login(app, 'manager', 'manager123');
    other = await login(app, 'other-admin', 'other123');
    const me = await http().get('/api/auth/me').set(as(manager)).expect(200);
    managerId = me.body.userId;
    const client = await http()
      .post('/api/clients')
      .set(as(head))
      .send({ name: 'Клиент для заметок', ownerUserId: managerId })
      .expect(201);
    clientId = client.body.clientId;
    const deal = await http()
      .post('/api/deals')
      .set(as(head))
      .send({
        clientId,
        title: 'Сделка для заметок',
        amount: 5,
        ownerUserId: managerId,
      })
      .expect(201);
    dealId = deal.body.dealId;
  });
  afterAll(async () => {
    await app.close();
  });

  describe('комментарии', () => {
    it('добавляет комментарий и показывает автора, новые сверху', async () => {
      await http()
        .post('/api/comments')
        .set(as(head))
        .send({ entityType: 'deal', entityId: dealId, body: 'Первый' })
        .expect(201);
      const second = await http()
        .post('/api/comments')
        .set(as(head))
        .send({ entityType: 'deal', entityId: dealId, body: 'Второй' })
        .expect(201);
      commentId = second.body.commentId;
      const list = await http()
        .get(`/api/comments?entityType=deal&entityId=${dealId}`)
        .set(as(manager))
        .expect(200);
      expect(list.body.map((c: { body: string }) => c.body)).toEqual([
        'Второй',
        'Первый',
      ]);
      expect(list.body[0].authorName).toBeTruthy();
    });

    it('уведомляет ответственного, но не автора', async () => {
      const notes = await http()
        .get('/api/notifications?unread=true')
        .set(as(manager))
        .expect(200);
      expect(
        notes.body.filter((n: { type: string }) => n.type === 'comment'),
      ).toHaveLength(2);
      const own = await http()
        .get('/api/notifications')
        .set(as(head))
        .expect(200);
      expect(own.body.some((n: { type: string }) => n.type === 'comment')).toBe(
        false,
      );
    });

    it('отклоняет пустой текст и чужую организацию', async () => {
      await http()
        .post('/api/comments')
        .set(as(head))
        .send({ entityType: 'deal', entityId: dealId, body: '   ' })
        .expect(400);
      await http()
        .get(`/api/comments?entityType=deal&entityId=${dealId}`)
        .set(as(other))
        .expect(404);
    });

    it('менеджер не удаляет чужой комментарий, руководитель удаляет', async () => {
      await http()
        .delete(`/api/comments/${commentId}`)
        .set(as(manager))
        .expect(403);
      await http()
        .delete(`/api/comments/${commentId}`)
        .set(as(head))
        .expect(200);
    });
  });

  describe('чек-листы', () => {
    it('добавляет пункты по порядку и отмечает выполнение', async () => {
      const first = await http()
        .post('/api/checklist')
        .set(as(manager))
        .send({ entityType: 'client', entityId: clientId, text: 'Позвонить' })
        .expect(201);
      itemId = first.body.itemId;
      await http()
        .post('/api/checklist')
        .set(as(manager))
        .send({
          entityType: 'client',
          entityId: clientId,
          text: 'Отправить КП',
        })
        .expect(201);
      const done = await http()
        .patch(`/api/checklist/${itemId}`)
        .set(as(manager))
        .send({ isDone: true })
        .expect(200);
      expect(done.body.isDone).toBe(true);
      expect(done.body.doneAt).not.toBeNull();
      const list = await http()
        .get(`/api/checklist?entityType=client&entityId=${clientId}`)
        .set(as(manager))
        .expect(200);
      expect(list.body.map((i: { text: string }) => i.text)).toEqual([
        'Позвонить',
        'Отправить КП',
      ]);
      const undone = await http()
        .patch(`/api/checklist/${itemId}`)
        .set(as(manager))
        .send({ isDone: false })
        .expect(200);
      expect(undone.body.doneAt).toBeNull();
    });

    it('чужая организация не видит и не меняет пункты', async () => {
      await http()
        .get(`/api/checklist?entityType=client&entityId=${clientId}`)
        .set(as(other))
        .expect(404);
      await http()
        .patch(`/api/checklist/${itemId}`)
        .set(as(other))
        .send({ isDone: true })
        .expect(404);
    });

    it('ограничивает число пунктов', async () => {
      for (let i = 0; i < 50; i += 1) {
        await http()
          .post('/api/checklist')
          .set(as(manager))
          .send({ entityType: 'deal', entityId: dealId, text: `Пункт ${i}` })
          .expect(201);
      }
      await http()
        .post('/api/checklist')
        .set(as(manager))
        .send({ entityType: 'deal', entityId: dealId, text: 'Лишний' })
        .expect(400);
    });

    it('удаление пункта и очистка при удалении записи', async () => {
      await http()
        .delete(`/api/checklist/${itemId}`)
        .set(as(manager))
        .expect(200);
      await http()
        .delete(`/api/deals/${dealId}?force=true`)
        .set(as(head))
        .expect(200);
      const rows = await http()
        .get(`/api/checklist?entityType=deal&entityId=${dealId}`)
        .set(as(head));
      expect(rows.status).toBe(404);
    });
  });
});
