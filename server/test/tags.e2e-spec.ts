import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

describe('Метки клиентов', () => {
  let app: INestApplication;
  let head: string;
  let manager: string;
  let other: string;
  let clientId: number;
  let tagId: number;
  let secondTagId: number;

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
      .send({ name: 'Клиент с метками' })
      .expect(201);
    clientId = client.body.clientId;
  });
  afterAll(async () => {
    await app.close();
  });

  it('руководитель создаёт метки, имя уникально без учёта регистра', async () => {
    const created = await http()
      .post('/api/tags')
      .set(as(head))
      .send({ name: 'VIP', color: '#aa0000' })
      .expect(201);
    tagId = created.body.tagId;
    expect(created.body.color).toBe('#AA0000');
    await http()
      .post('/api/tags')
      .set(as(head))
      .send({ name: 'vip', color: '#00AA00' })
      .expect(409);
    const second = await http()
      .post('/api/tags')
      .set(as(head))
      .send({ name: 'Тендер', color: '#0000AA' })
      .expect(201);
    secondTagId = second.body.tagId;
  });

  it('проверяет цвет и права на создание', async () => {
    await http()
      .post('/api/tags')
      .set(as(head))
      .send({ name: 'Плохой', color: 'red' })
      .expect(400);
    await http()
      .post('/api/tags')
      .set(as(manager))
      .send({ name: 'Менеджерская', color: '#111111' })
      .expect(403);
  });

  it('назначает метки клиенту и заменяет набор целиком', async () => {
    await http()
      .put(`/api/clients/${clientId}/tags`)
      .set(as(head))
      .send({ tagIds: [tagId, secondTagId] })
      .expect(200);
    const both = await http()
      .get(`/api/clients/${clientId}/tags`)
      .set(as(head))
      .expect(200);
    expect(both.body.map((t: { name: string }) => t.name).sort()).toEqual([
      'VIP',
      'Тендер',
    ]);
    await http()
      .put(`/api/clients/${clientId}/tags`)
      .set(as(head))
      .send({ tagIds: [secondTagId] })
      .expect(200);
    const one = await http()
      .get(`/api/clients/${clientId}/tags`)
      .set(as(head))
      .expect(200);
    expect(one.body).toHaveLength(1);
  });

  it('список клиентов показывает метки и фильтруется по метке', async () => {
    const response = await http()
      .get(`/api/clients?tagId=${secondTagId}`)
      .set(as(head))
      .expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].clientId).toBe(clientId);
    expect(response.body.items[0].tags).toEqual([
      { tagId: secondTagId, name: 'Тендер', color: '#0000AA' },
    ]);
    const empty = await http()
      .get(`/api/clients?tagId=${tagId}`)
      .set(as(head))
      .expect(200);
    expect(empty.body.total).toBe(0);
  });

  it('массово добавляет метку и считает клиентов в справочнике', async () => {
    await http()
      .post(`/api/tags/${tagId}/clients`)
      .set(as(head))
      .send({ clientIds: [clientId] })
      .expect(201);
    await http()
      .post(`/api/tags/${tagId}/clients`)
      .set(as(head))
      .send({ clientIds: [clientId] })
      .expect(201);
    const list = await http().get('/api/tags').set(as(head)).expect(200);
    const vip = list.body.find((t: { tagId: number }) => t.tagId === tagId);
    expect(vip.clientsCount).toBe(1);
  });

  it('чужая организация не видит и не использует метки', async () => {
    const list = await http().get('/api/tags').set(as(other)).expect(200);
    expect(list.body).toEqual([]);
    await http()
      .put(`/api/clients/${clientId}/tags`)
      .set(as(other))
      .send({ tagIds: [tagId] })
      .expect(404);
    await http()
      .post(`/api/tags/${tagId}/clients`)
      .set(as(other))
      .send({ clientIds: [clientId] })
      .expect(404);
  });

  it('удаление метки снимает её с клиентов', async () => {
    await http().delete(`/api/tags/${tagId}`).set(as(head)).expect(200);
    const response = await http()
      .get(`/api/clients/${clientId}/tags`)
      .set(as(head))
      .expect(200);
    expect(response.body.map((t: { tagId: number }) => t.tagId)).not.toContain(
      tagId,
    );
  });
});
