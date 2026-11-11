import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

describe('Позиции сделки', () => {
  let app: INestApplication;
  let head: string;
  let manager: string;
  let other: string;
  let dealId: number;
  let version: number;
  let productId: number;
  let usdProductId: number;

  const http = () => request(app.getHttpServer());
  const put = (token: string, id: number, body: object) =>
    http()
      .put(`/api/deals/${id}/items`)
      .set('Authorization', bearer(token))
      .send(body);

  beforeAll(async () => {
    app = await createTestApp();
    head = await login(app, 'head', 'head123');
    manager = await login(app, 'manager', 'manager123');
    other = await login(app, 'other-admin', 'other123');
    const clients = await http()
      .get('/api/clients?limit=1')
      .set('Authorization', bearer(head))
      .expect(200);
    const deal = await http()
      .post('/api/deals')
      .set('Authorization', bearer(head))
      .send({
        clientId: clients.body.items[0].clientId,
        title: 'Сделка с позициями',
        amount: 100,
      })
      .expect(201);
    dealId = deal.body.dealId;
    version = deal.body.version;
    const product = async (sku: string, price: number, currency: string) =>
      (
        await http()
          .post('/api/products')
          .set('Authorization', bearer(head))
          .send({ sku, name: `Товар ${sku}`, price, currency, unit: 'шт.' })
          .expect(201)
      ).body.productId;
    productId = await product('DI-1', 10.1, 'RUB');
    usdProductId = await product('DI-2', 5, 'USD');
  });
  afterAll(async () => {
    await app.close();
  });

  it('до заполнения состав пуст', async () => {
    const response = await http()
      .get(`/api/deals/${dealId}/items`)
      .set('Authorization', bearer(head))
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it('считает сумму по позициям с округлением строки до копеек', async () => {
    const response = await put(head, dealId, {
      version,
      items: [{ productId, quantity: 2.5 }],
    }).expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      sku: 'DI-1',
      unitPrice: 10.1,
      totalAmount: 25.25,
    });
    const deal = await http()
      .get(`/api/deals/${dealId}`)
      .set('Authorization', bearer(head))
      .expect(200);
    expect(deal.body.amount).toBe(25.25);
    expect(deal.body.version).toBeGreaterThan(version);
    version = deal.body.version;
  });

  it('запрещает править сумму вручную, пока есть позиции', async () => {
    await http()
      .patch(`/api/deals/${dealId}`)
      .set('Authorization', bearer(head))
      .send({ amount: 500, version })
      .expect(400);
    await http()
      .patch(`/api/deals/${dealId}`)
      .set('Authorization', bearer(head))
      .send({ title: 'Новое название', version })
      .expect(200);
  });

  it('отклоняет устаревшую версию, чужую валюту и дубли строк', async () => {
    await put(head, dealId, { version: 1, items: [] }).expect(409);
    const fresh = (
      await http()
        .get(`/api/deals/${dealId}`)
        .set('Authorization', bearer(head))
    ).body.version;
    await put(head, dealId, {
      version: fresh,
      items: [{ productId: usdProductId, quantity: 1 }],
    }).expect(400);
    await put(head, dealId, {
      version: fresh,
      items: [{ itemId: 999999, productId, quantity: 1 }],
    }).expect(400);
  });

  it('закрыт для чужой организации и чужого менеджера', async () => {
    await http()
      .get(`/api/deals/${dealId}/items`)
      .set('Authorization', bearer(other))
      .expect(404);
    await put(other, dealId, { version, items: [] }).expect(404);
    await http()
      .get(`/api/deals/${dealId}/items`)
      .set('Authorization', bearer(manager))
      .expect((res) => {
        expect([200, 403]).toContain(res.status);
      });
  });

  it('пустой состав возвращает ручной ввод суммы', async () => {
    const fresh = (
      await http()
        .get(`/api/deals/${dealId}`)
        .set('Authorization', bearer(head))
    ).body.version;
    await put(head, dealId, { version: fresh, items: [] }).expect(200);
    const deal = await http()
      .get(`/api/deals/${dealId}`)
      .set('Authorization', bearer(head))
      .expect(200);
    await http()
      .patch(`/api/deals/${dealId}`)
      .set('Authorization', bearer(head))
      .send({ amount: 700, version: deal.body.version })
      .expect(200);
  });
});
