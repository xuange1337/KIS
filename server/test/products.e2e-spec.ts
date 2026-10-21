import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

describe('Каталог товаров и услуг', () => {
  let app: INestApplication;
  let head: string;
  let manager: string;
  let other: string;
  let productId: number;
  const payload = {
    sku: 'CAT-001',
    name: 'Настройка CRM',
    price: 1250.25,
    currency: 'RUB',
    unit: 'услуга',
  };

  beforeAll(async () => {
    app = await createTestApp();
    head = await login(app, 'head', 'head123');
    manager = await login(app, 'manager', 'manager123');
    other = await login(app, 'other-admin', 'other123');
  });
  afterAll(async () => {
    await app.close();
  });

  it('требует авторизацию', async () => {
    await request(app.getHttpServer()).get('/api/products').expect(401);
  });

  it('создаёт позицию и сохраняет цену без потери копеек', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', bearer(head))
      .send(payload)
      .expect(201);
    productId = response.body.productId;
    expect(response.body).toMatchObject({
      ...payload,
      version: 1,
      isActive: true,
    });
  });

  it('менеджер читает общий каталог своей организации', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/products?q=CAT-001&isActive=true')
      .set('Authorization', bearer(manager))
      .expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].productId).toBe(productId);
  });

  it('менеджер не создаёт и не изменяет каталог', async () => {
    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', bearer(manager))
      .send(payload)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/products/${productId}`)
      .set('Authorization', bearer(manager))
      .send({ price: 0, version: 1 })
      .expect(403);
  });

  it('не раскрывает и не изменяет позицию другой организации', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/products?q=CAT-001')
      .set('Authorization', bearer(other))
      .expect(200);
    expect(response.body.total).toBe(0);
    await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set('Authorization', bearer(other))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/products/${productId}`)
      .set('Authorization', bearer(other))
      .send({ price: 0, version: 1 })
      .expect(404);
  });

  it('запрещает дубликат артикула только в одной организации', async () => {
    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', bearer(head))
      .send(payload)
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', bearer(other))
      .send(payload)
      .expect(201);
  });

  it.each([
    { price: -1 },
    { price: 0.001 },
    { price: 1000000000000 },
    { price: null },
    { sku: '   ' },
    { name: '   ' },
    { currency: 'GBP' },
    { currency: null },
    { unit: '' },
    { isActive: 'false' },
  ])('отклоняет некорректные поля %j', async (invalid) => {
    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', bearer(head))
      .send({ ...payload, sku: 'INVALID', ...invalid })
      .expect(400);
  });

  it('игнорирует переданный tenant и отклоняет некорректный фильтр', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', bearer(head))
      .send({ ...payload, sku: 'CAT-TENANT', organizationId: 999 })
      .expect(201);
    expect(response.body.organizationId).not.toBe(999);
    await request(app.getHttpServer())
      .get(`/api/products/${response.body.productId}`)
      .set('Authorization', bearer(other))
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/products?isActive=anything')
      .set('Authorization', bearer(head))
      .expect(400);
  });

  it('требует версию и не разрешает null в обязательных полях при правке', async () => {
    await request(app.getHttpServer())
      .patch(`/api/products/${productId}`)
      .set('Authorization', bearer(head))
      .send({ price: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/products/${productId}`)
      .set('Authorization', bearer(head))
      .send({ name: null, version: 1 })
      .expect(400);
  });

  it('только одна из двух параллельных правок проходит', async () => {
    const responses = await Promise.all(
      [100, 200].map((price) =>
        request(app.getHttpServer())
          .patch(`/api/products/${productId}`)
          .set('Authorization', bearer(head))
          .send({ price, version: 1 }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const response = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set('Authorization', bearer(head))
      .expect(200);
    expect(response.body.version).toBe(2);
  });

  it('архивирует и восстанавливает позицию', async () => {
    await request(app.getHttpServer())
      .patch(`/api/products/${productId}`)
      .set('Authorization', bearer(head))
      .send({ isActive: false, version: 2 })
      .expect(200);
    const active = await request(app.getHttpServer())
      .get('/api/products?q=CAT-001&isActive=true')
      .set('Authorization', bearer(head))
      .expect(200);
    expect(active.body.total).toBe(0);
    const archived = await request(app.getHttpServer())
      .get('/api/products?q=CAT-001&isActive=false')
      .set('Authorization', bearer(head))
      .expect(200);
    expect(archived.body.total).toBe(1);
    await request(app.getHttpServer())
      .patch(`/api/products/${productId}`)
      .set('Authorization', bearer(head))
      .send({ isActive: true, description: null, version: 3 })
      .expect(200);
  });

  it('повтор создания с ключом идемпотентности возвращает одну позицию', async () => {
    const create = () =>
      request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', bearer(head))
        .set('Idempotency-Key', 'products-repeat-creation')
        .send({ ...payload, sku: 'CAT-REPEAT' });
    const first = await create().expect(201);
    const second = await create();
    expect(second.status).toBeLessThan(300);
    expect(second.body.productId).toBe(first.body.productId);
  });
});
