import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

/**
 * Глобальный поиск.
 *
 * Строка поиска не должна становиться обходным путём к чужим данным:
 * видимость та же, что у списков — организация ограничивает выборку,
 * роль ограничивает записи внутри неё.
 */
describe('Поиск по всем разделам', () => {
  let app: INestApplication;
  let managerToken: string;
  let headToken: string;
  let otherToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    managerToken = await login(app, 'manager', 'manager123');
    headToken = await login(app, 'head', 'head123');
    otherToken = await login(app, 'other-manager', 'other123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('находит клиента по наименованию и по ИНН', async () => {
    const byName = await request(app.getHttpServer())
      .get('/api/search?q=ЦифраСофт')
      .set('Authorization', bearer(headToken))
      .expect(200);
    expect(byName.body.clients[0].title).toContain('ЦифраСофт');
    expect(byName.body.clients[0].url).toMatch(/^\/clients\/\d+$/);

    const byInn = await request(app.getHttpServer())
      .get('/api/search?q=7728901234')
      .set('Authorization', bearer(headToken))
      .expect(200);
    expect(byInn.body.clients[0].title).toContain('ЦифраСофт');
  });

  it('находит сделки, активности и предложения', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/search?q=КП-2026')
      .set('Authorization', bearer(headToken))
      .expect(200);
    expect(response.body.offers.length).toBeGreaterThan(0);
    expect(response.body.offers[0].url).toMatch(/^\/deals\/\d+$/);

    const byClient = await request(app.getHttpServer())
      .get('/api/search?q=ЦифраСофт')
      .set('Authorization', bearer(headToken))
      .expect(200);
    // Клиент упоминается и в сделках, и в активностях: искать
    // по названию клиента — обычный способ добраться до его работы
    expect(byClient.body.deals.length).toBeGreaterThan(0);
    expect(byClient.body.activities.length).toBeGreaterThan(0);
  });

  it('не выдаёт записи другой организации', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/search?q=Соседний')
      .set('Authorization', bearer(headToken))
      .expect(200);

    expect(response.body.clients).toHaveLength(0);
    expect(response.body.deals).toHaveLength(0);
    expect(response.body.activities).toHaveLength(0);
    expect(response.body.offers).toHaveLength(0);

    // А своей организации — выдаёт
    const theirs = await request(app.getHttpServer())
      .get('/api/search?q=Соседний')
      .set('Authorization', bearer(otherToken))
      .expect(200);
    expect(theirs.body.clients.length).toBeGreaterThan(0);
  });

  it('менеджеру не показывает чужие записи своей организации', async () => {
    const all = await request(app.getHttpServer())
      .get('/api/search?q=ООО')
      .set('Authorization', bearer(headToken))
      .expect(200);
    const mine = await request(app.getHttpServer())
      .get('/api/search?q=ООО')
      .set('Authorization', bearer(managerToken))
      .expect(200);

    expect(all.body.clients.length).toBeGreaterThan(0);
    // У менеджера в выдаче только его записи: это те же правила,
    // что в списке клиентов, а не отдельная логика поиска
    const clients = await request(app.getHttpServer())
      .get('/api/clients?q=ООО&limit=200')
      .set('Authorization', bearer(managerToken))
      .expect(200);
    const visible = clients.body.items.map(
      (client: { name: string }) => client.name,
    );
    for (const hit of mine.body.clients) {
      expect(visible).toContain(hit.title);
    }
  });

  it('отклоняет слишком короткий запрос', async () => {
    // По одной букве совпадает почти всё: запрос превратился бы в
    // выгрузку половины базы четырьмя запросами сразу
    await request(app.getHttpServer())
      .get('/api/search?q=О')
      .set('Authorization', bearer(headToken))
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/search')
      .set('Authorization', bearer(headToken))
      .expect(400);
  });

  it('требует авторизации', async () => {
    await request(app.getHttpServer()).get('/api/search?q=ООО').expect(401);
  });
});
