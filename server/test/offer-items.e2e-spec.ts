import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Product } from '../src/products/product.entity';
import { bearer, createTestApp, login } from './setup';

describe('Позиции коммерческого предложения', () => {
  let app: INestApplication;
  let head: string;
  let manager: string;
  let manager2: string;
  let other: string;
  let clientId: number;
  let dealId: number;
  let productId: number;
  let usdId: number;
  let foreignId: number;
  let serial = 0;
  const createdDealIds: number[] = [];
  const createdProductIds: number[] = [];

  const createProduct = async (
    sku: string,
    token = head,
    currency = 'RUB',
    price = 0.29,
  ) => {
    const response = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', bearer(token))
      .send({ sku, name: `Товар ${sku}`, price, currency })
      .expect(201);
    createdProductIds.push(response.body.productId);
    return response.body.productId as number;
  };
  const createOffer = async (targetDeal = dealId) => {
    const response = await request(app.getHttpServer())
      .post('/api/offers')
      .set('Authorization', bearer(manager))
      .send({
        dealId: targetDeal,
        number: `LINES-${++serial}`,
        date: '2026-10-08',
        totalAmount: 999,
      })
      .expect(201);
    expect(response.body).toMatchObject({ version: 1, currency: 'RUB' });
    return response.body.offerId as number;
  };
  const replace = (
    offerId: number,
    items: unknown[],
    version = 1,
    token = manager,
  ) =>
    request(app.getHttpServer())
      .patch(`/api/offers/${offerId}/items`)
      .set('Authorization', bearer(token))
      .send({ version, items });
  const read = async (offerId: number) =>
    (
      await request(app.getHttpServer())
        .get(`/api/offers/${offerId}`)
        .set('Authorization', bearer(manager))
        .expect(200)
    ).body;

  beforeAll(async () => {
    app = await createTestApp();
    head = await login(app, 'head', 'head123');
    manager = await login(app, 'manager', 'manager123');
    manager2 = await login(app, 'manager2', 'manager123');
    other = await login(app, 'other-admin', 'other123');
    const client = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', bearer(manager))
      .send({ name: 'Клиент для позиций КП' })
      .expect(201);
    clientId = client.body.clientId;
    const deal = await request(app.getHttpServer())
      .post('/api/deals')
      .set('Authorization', bearer(manager))
      .send({ clientId, title: 'Сделка для позиций КП', amount: 999 })
      .expect(201);
    dealId = deal.body.dealId;
    createdDealIds.push(dealId);
    productId = await createProduct('LINES-RUB');
    usdId = await createProduct('LINES-USD', head, 'USD');
    foreignId = await createProduct('LINES-FOREIGN', other);
  });
  afterAll(async () => {
    try {
      for (const id of createdDealIds) {
        await request(app.getHttpServer())
          .delete(`/api/deals/${id}?force=true`)
          .set('Authorization', bearer(head))
          .expect(200);
      }
      if (clientId)
        await request(app.getHttpServer())
          .delete(`/api/clients/${clientId}`)
          .set('Authorization', bearer(head))
          .expect(200);
      if (createdProductIds.length)
        await app
          .get(DataSource)
          .getRepository(Product)
          .delete(createdProductIds);
    } finally {
      await app.close();
    }
  });

  it('рассчитывает итог и сохраняет снимок товара', async () => {
    const offerId = await createOffer();
    const response = await replace(offerId, [
      { productId, quantity: 3 },
    ]).expect(200);
    expect(response.body).toMatchObject({
      totalAmount: 0.87,
      version: 2,
      currency: 'RUB',
    });
    expect(response.body.items[0]).toMatchObject({
      name: 'Товар LINES-RUB',
      sku: 'LINES-RUB',
      unit: 'шт.',
      unitPrice: 0.29,
      quantity: 3,
      totalAmount: 0.87,
    });
    const byDeal = await request(app.getHttpServer())
      .get(`/api/deals/${dealId}/offers`)
      .set('Authorization', bearer(manager))
      .expect(200);
    expect(
      byDeal.body.find(
        (offer: { offerId: number }) => offer.offerId === offerId,
      ).items,
    ).toHaveLength(1);
  });

  it('округляет каждую строку до копейки, затем складывает', async () => {
    const offerId = await createOffer();
    const response = await replace(offerId, [
      { productId, quantity: 0.5, unitPrice: 0.01 },
      { productId, quantity: 0.15, unitPrice: 0.1 },
    ]).expect(200);
    expect(response.body.totalAmount).toBe(0.03);
    expect(
      response.body.items.map(
        (item: { totalAmount: number }) => item.totalAmount,
      ),
    ).toEqual([0.01, 0.02]);
  });

  it('принимает количество до тысячных', async () => {
    const offerId = await createOffer();
    const response = await replace(offerId, [
      { productId, quantity: 0.001, unitPrice: 100 },
    ]).expect(200);
    expect(response.body.totalAmount).toBe(0.1);
  });

  it.each([
    { quantity: 0 },
    { quantity: -1 },
    { quantity: 0.0001 },
    { quantity: 1000001 },
    { quantity: null },
    { unitPrice: -1 },
    { unitPrice: 1.001 },
    { unitPrice: null },
    { productId: null },
  ])('отклоняет некорректные поля %j', async (invalid) => {
    const offerId = await createOffer();
    await replace(offerId, [{ productId, quantity: 1, ...invalid }]).expect(
      400,
    );
    expect((await read(offerId)).totalAmount).toBe(999);
  });

  it('не допускает чужой товар и смешение валют, не меняя КП', async () => {
    const offerId = await createOffer();
    await replace(offerId, [{ productId: foreignId, quantity: 1 }]).expect(404);
    await replace(offerId, [{ productId: usdId, quantity: 1 }]).expect(400);
    expect(await read(offerId)).toMatchObject({
      version: 1,
      totalAmount: 999,
      items: [],
    });
  });

  it('не допускает другого менеджера и другую организацию', async () => {
    const offerId = await createOffer();
    await replace(offerId, [{ productId, quantity: 1 }], 1, manager2).expect(
      403,
    );
    await replace(offerId, [{ productId, quantity: 1 }], 1, other).expect(404);
  });

  it('не допускает переполнение строки и суммарного итога', async () => {
    const offerId = await createOffer();
    await replace(offerId, [
      { productId, quantity: 2, unitPrice: 999999999999.99 },
    ]).expect(400);
    await replace(offerId, [
      { productId, quantity: 1, unitPrice: 999999999999.99 },
      { productId, quantity: 1, unitPrice: 0.01 },
    ]).expect(400);
    expect(await read(offerId)).toMatchObject({ version: 1, items: [] });
  });

  it('принимает максимально допустимый итог без потери разрядов', async () => {
    const offerId = await createOffer();
    const response = await replace(offerId, [
      { productId, quantity: 1, unitPrice: 999999999999.99 },
    ]).expect(200);
    expect(response.body.totalAmount).toBe(999999999999.99);
  });

  it('не теряет состав при недопустимом товаре в середине списка', async () => {
    const offerId = await createOffer();
    const first = await replace(offerId, [{ productId, quantity: 2 }]).expect(
      200,
    );
    await replace(
      offerId,
      [
        { productId, quantity: 4 },
        { productId: foreignId, quantity: 1 },
      ],
      2,
    ).expect(404);
    expect(await read(offerId)).toMatchObject({
      version: 2,
      totalAmount: first.body.totalAmount,
      items: first.body.items,
    });
  });

  it('сохраняет снимок после переименования, смены цены и архивирования товара', async () => {
    const local = await createProduct('LINES-SNAPSHOT', head, 'RUB', 10);
    const offerId = await createOffer();
    const first = await replace(offerId, [
      { productId: local, quantity: 1 },
    ]).expect(200);
    await request(app.getHttpServer())
      .patch(`/api/products/${local}`)
      .set('Authorization', bearer(head))
      .send({ name: 'Новое имя', price: 20, isActive: false, version: 1 })
      .expect(200);
    const response = await replace(
      offerId,
      [{ itemId: first.body.items[0].itemId, productId: local, quantity: 3 }],
      2,
    ).expect(200);
    expect(response.body.items[0]).toMatchObject({
      name: 'Товар LINES-SNAPSHOT',
      unitPrice: 10,
    });
    expect(response.body.totalAmount).toBe(30);
    await replace(offerId, [{ productId: local, quantity: 1 }], 3).expect(404);
  });

  it('не принимает itemId чужого предложения и повторы itemId', async () => {
    const first = await createOffer();
    const second = await createOffer();
    const response = await replace(first, [{ productId, quantity: 1 }]).expect(
      200,
    );
    const item = {
      productId,
      quantity: 1,
      itemId: response.body.items[0].itemId,
    };
    await replace(second, [item]).expect(400);
    await replace(first, [item, item], 2).expect(400);
  });

  it('отклоняет устаревшую версию и только одну из параллельных правок', async () => {
    const offerId = await createOffer();
    const responses = await Promise.all(
      [1, 2].map((quantity) => replace(offerId, [{ productId, quantity }])),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    await request(app.getHttpServer())
      .patch(`/api/offers/${offerId}`)
      .set('Authorization', bearer(manager))
      .send({ number: 'Устаревшая правка', version: 1 })
      .expect(409);
  });

  it('не позволяет вручную подменить сумму КП с позициями', async () => {
    const offerId = await createOffer();
    await replace(offerId, [{ productId, quantity: 2 }]).expect(200);
    await request(app.getHttpServer())
      .patch(`/api/offers/${offerId}`)
      .set('Authorization', bearer(manager))
      .send({ totalAmount: 999 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/offers/${offerId}`)
      .set('Authorization', bearer(manager))
      .send({ number: 'Правка номера', version: 2 })
      .expect(200);
    expect(await read(offerId)).toMatchObject({
      totalAmount: 0.58,
      version: 3,
    });
  });

  it('очищает позиции с нулевым итогом и каскадно удаляет их вместе с КП', async () => {
    const offerId = await createOffer();
    await replace(offerId, [{ productId, quantity: 2 }]).expect(200);
    const empty = await replace(offerId, [], 2).expect(200);
    expect(empty.body).toMatchObject({ items: [], totalAmount: 0, version: 3 });
    await replace(offerId, [{ productId, quantity: 2 }], 3).expect(200);
    await request(app.getHttpServer())
      .delete(`/api/offers/${offerId}`)
      .set('Authorization', bearer(manager))
      .expect(200);
    const rows = await app
      .get(DataSource)
      .query('SELECT * FROM offer_items WHERE offer_id = $1', [offerId]);
    expect(rows).toHaveLength(0);
  });

  it('валюта существующего КП не меняется вместе со сделкой', async () => {
    const deal = await request(app.getHttpServer())
      .post('/api/deals')
      .set('Authorization', bearer(manager))
      .send({ clientId, title: 'Сделка с изменением валюты', amount: 999 })
      .expect(201);
    createdDealIds.push(deal.body.dealId);
    const offerId = await createOffer(deal.body.dealId);
    await request(app.getHttpServer())
      .patch(`/api/deals/${deal.body.dealId}`)
      .set('Authorization', bearer(manager))
      .send({ currency: 'USD', version: deal.body.version })
      .expect(200);
    expect((await read(offerId)).currency).toBe('RUB');
    await replace(offerId, [{ productId, quantity: 1 }]).expect(200);
  });

  it('схема БД запрещает межтенантную ссылку на товар', async () => {
    const offerId = await createOffer();
    const offer = await read(offerId);
    await expect(
      app
        .get(DataSource)
        .query(
          `INSERT INTO offer_items (organization_id, offer_id, product_id, sku, name, unit, quantity, unit_price, total_amount) VALUES ($1, $2, $3, 'BAD', 'BAD', 'шт.', 1, 1, 1)`,
          [offer.organizationId, offerId, foreignId],
        ),
    ).rejects.toMatchObject({ driverError: { code: '23503' } });
  });
});
