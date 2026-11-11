import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

describe('Сохранённые фильтры и избранное', () => {
  let app: INestApplication;
  let head: string;
  let manager: string;
  let other: string;
  let clientId: number;
  let dealId: number;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: bearer(token) });

  beforeAll(async () => {
    app = await createTestApp();
    head = await login(app, 'head', 'head123');
    manager = await login(app, 'manager', 'manager123');
    other = await login(app, 'other-admin', 'other123');
    const client = await http()
      .post('/api/clients')
      .set(as(head))
      .send({ name: 'Избранный клиент' })
      .expect(201);
    clientId = client.body.clientId;
    const deal = await http()
      .post('/api/deals')
      .set(as(head))
      .send({ clientId, title: 'Избранная сделка', amount: 1 })
      .expect(201);
    dealId = deal.body.dealId;
  });
  afterAll(async () => {
    await app.close();
  });

  describe('фильтры', () => {
    const body = {
      entity: 'clients',
      name: 'Горячие лиды',
      filters: { status: 'lead', industry: 'Логистика и транспорт' },
    };

    it('сохраняет набор и возвращает только свой', async () => {
      await http()
        .post('/api/saved-filters')
        .set(as(head))
        .send(body)
        .expect(201);
      const mine = await http()
        .get('/api/saved-filters?entity=clients')
        .set(as(head))
        .expect(200);
      expect(mine.body).toHaveLength(1);
      expect(mine.body[0]).toMatchObject({
        name: 'Горячие лиды',
        filters: body.filters,
      });
      const theirs = await http()
        .get('/api/saved-filters?entity=clients')
        .set(as(manager))
        .expect(200);
      expect(theirs.body).toEqual([]);
    });

    it('не принимает повтор названия, чужие ключи и пустой набор', async () => {
      await http()
        .post('/api/saved-filters')
        .set(as(head))
        .send(body)
        .expect(409);
      await http()
        .post('/api/saved-filters')
        .set(as(head))
        .send({ ...body, name: 'Чужие ключи', filters: { admin: true } })
        .expect(400);
      await http()
        .post('/api/saved-filters')
        .set(as(head))
        .send({ ...body, name: 'Пусто', filters: {} })
        .expect(400);
      await http()
        .post('/api/saved-filters')
        .set(as(head))
        .send({ ...body, name: 'Вложенный', filters: { q: { a: 1 } } })
        .expect(400);
    });

    it('удаляет только свой набор', async () => {
      const list = await http()
        .get('/api/saved-filters?entity=clients')
        .set(as(head))
        .expect(200);
      const id = list.body[0].savedFilterId;
      await http()
        .delete(`/api/saved-filters/${id}`)
        .set(as(manager))
        .expect(404);
      await http().delete(`/api/saved-filters/${id}`).set(as(head)).expect(200);
    });
  });

  describe('избранное', () => {
    it('отмечает клиента и сделку, повторная отметка безопасна', async () => {
      await http()
        .put(`/api/favorites/client/${clientId}`)
        .set(as(head))
        .expect(200);
      await http()
        .put(`/api/favorites/client/${clientId}`)
        .set(as(head))
        .expect(200);
      await http()
        .put(`/api/favorites/deal/${dealId}`)
        .set(as(head))
        .expect(200);
      const ids = await http()
        .get('/api/favorites?entityType=client')
        .set(as(head))
        .expect(200);
      expect(ids.body).toEqual([clientId]);
    });

    it('фильтрует списки по избранному и не смешивает пользователей', async () => {
      const clients = await http()
        .get('/api/clients?favorite=true')
        .set(as(head))
        .expect(200);
      expect(
        clients.body.items.map((c: { clientId: number }) => c.clientId),
      ).toEqual([clientId]);
      const deals = await http()
        .get('/api/deals?favorite=true')
        .set(as(head))
        .expect(200);
      expect(deals.body.total).toBe(1);
      const mgr = await http()
        .get('/api/favorites?entityType=client')
        .set(as(manager))
        .expect(200);
      expect(mgr.body).toEqual([]);
    });

    it('чужая организация и чужой менеджер не могут отметить запись', async () => {
      await http()
        .put(`/api/favorites/client/${clientId}`)
        .set(as(other))
        .expect(404);
      await http()
        .put(`/api/favorites/client/${clientId}`)
        .set(as(manager))
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
      await http().put('/api/favorites/order/1').set(as(head)).expect(400);
    });

    it('снимает отметку', async () => {
      await http()
        .delete(`/api/favorites/client/${clientId}`)
        .set(as(head))
        .expect(200);
      const clients = await http()
        .get('/api/clients?favorite=true')
        .set(as(head))
        .expect(200);
      expect(clients.body.total).toBe(0);
    });
  });
});
