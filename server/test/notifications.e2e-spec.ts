import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

describe('Центр уведомлений', () => {
  let app: INestApplication;
  let head: string;
  let manager: string;
  let other: string;
  let managerId: number;
  let clientId: number;

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
      .send({ name: 'Клиент для уведомлений', ownerUserId: managerId })
      .expect(201);
    clientId = client.body.clientId;
  });
  afterAll(async () => {
    await app.close();
  });

  it('назначение клиента создаёт уведомление ответственному', async () => {
    const list = await http()
      .get('/api/notifications?unread=true')
      .set(as(manager))
      .expect(200);
    const found = list.body.find(
      (n: { type: string; link: string }) =>
        n.type === 'assigned_client' && n.link === `/clients/${clientId}`,
    );
    expect(found).toBeDefined();
    expect(found.body).toBe('Клиент для уведомлений');
  });

  it('руководитель, назначивший сам, уведомления не получает', async () => {
    const list = await http()
      .get('/api/notifications')
      .set(as(head))
      .expect(200);
    expect(
      list.body.some(
        (n: { link: string }) => n.link === `/clients/${clientId}`,
      ),
    ).toBe(false);
  });

  it('просроченная активность даёт одно напоминание, повтор не плодит дубли', async () => {
    await http()
      .post('/api/activities')
      .set(as(manager))
      .send({
        clientId,
        type: 'call',
        subject: 'Просроченный звонок',
        plannedAt: new Date(Date.now() - 3600_000).toISOString(),
      })
      .expect(201);
    const first = await http()
      .get('/api/notifications')
      .set(as(manager))
      .expect(200);
    await http().get('/api/notifications/unread-count').set(as(manager));
    const second = await http()
      .get('/api/notifications')
      .set(as(manager))
      .expect(200);
    const overdue = (list: { type: string; body: string }[]) =>
      list.filter(
        (n) =>
          n.type === 'overdue_activity' && n.body === 'Просроченный звонок',
      );
    expect(overdue(first.body)).toHaveLength(1);
    expect(overdue(second.body)).toHaveLength(1);
  });

  it('счётчик уменьшается после прочтения', async () => {
    const before = await http()
      .get('/api/notifications/unread-count')
      .set(as(manager))
      .expect(200);
    expect(before.body.count).toBeGreaterThanOrEqual(2);
    const list = await http()
      .get('/api/notifications?unread=true')
      .set(as(manager))
      .expect(200);
    await http()
      .post(`/api/notifications/${list.body[0].notificationId}/read`)
      .set(as(manager))
      .expect(201);
    const after = await http()
      .get('/api/notifications/unread-count')
      .set(as(manager))
      .expect(200);
    expect(after.body.count).toBe(before.body.count - 1);
    await http()
      .post('/api/notifications/read-all')
      .set(as(manager))
      .expect(201);
    const zero = await http()
      .get('/api/notifications/unread-count')
      .set(as(manager))
      .expect(200);
    expect(zero.body.count).toBe(0);
  });

  it('выполненная активность гасит своё напоминание', async () => {
    const created = await http()
      .post('/api/activities')
      .set(as(manager))
      .send({
        clientId,
        type: 'call',
        subject: 'Скоро выполню',
        plannedAt: new Date(Date.now() + 3600_000).toISOString(),
      })
      .expect(201);
    const count = await http()
      .get('/api/notifications/unread-count')
      .set(as(manager))
      .expect(200);
    expect(count.body.count).toBe(1);
    await http()
      .patch(`/api/activities/${created.body.activityId}/complete`)
      .set(as(manager))
      .send({ result: 'Готово' })
      .expect(200);
    const after = await http()
      .get('/api/notifications/unread-count')
      .set(as(manager))
      .expect(200);
    expect(after.body.count).toBe(0);
  });

  it('чужие уведомления недоступны', async () => {
    const list = await http()
      .get('/api/notifications')
      .set(as(other))
      .expect(200);
    expect(JSON.stringify(list.body)).not.toContain('Клиент для уведомлений');
    await http().post('/api/notifications/1/read').set(as(other)).expect(404);
  });
});
