import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { normalizeName } from '../src/clients/duplicates';
import { bearer, createTestApp, login } from './setup';

describe('Нормализация названий', () => {
  it('убирает правовую форму, кавычки, пробелы и регистр', () => {
    expect(normalizeName('ООО «Логистик Про»')).toBe('логистикпро');
    expect(normalizeName('ЛогистикПро, ООО')).toBe('логистикпро');
    expect(normalizeName('Ёлка-Плюс')).toBe('елкаплюс');
  });
});

describe('Дубли клиентов и объединение', () => {
  let app: INestApplication;
  let head: string;
  let manager: string;
  let other: string;
  const ids: Record<string, number> = {};

  const post = (token: string, url: string, body: object) =>
    request(app.getHttpServer())
      .post(url)
      .set('Authorization', bearer(token))
      .send(body);

  beforeAll(async () => {
    app = await createTestApp();
    head = await login(app, 'head', 'head123');
    manager = await login(app, 'manager', 'manager123');
    other = await login(app, 'other-admin', 'other123');
    const make = async (key: string, body: object) => {
      const response = await post(head, '/api/clients', body).expect(201);
      ids[key] = response.body.clientId;
    };
    await make('a', { name: 'ООО «Дубль-Тест»', inn: '7701234500' });
    await make('b', {
      name: 'Дубль-тест, ООО',
      industry: 'Логистика и транспорт',
    });
    await make('c', { name: 'Совсем другое', inn: '7701234500' });
    await make('solo', { name: 'Уникальный клиент 9183' });
    await post(head, '/api/contacts', {
      clientId: ids.solo,
      fullName: 'Иван Тестов',
      phone: '+7 (900) 111-22-33',
    }).expect(201);
    await post(head, '/api/contacts', {
      clientId: ids.b,
      fullName: 'Иван Тестов',
      phone: '8 900 111 22 33',
      email: 'ivan@dubl.test',
    }).expect(201);
    await post(head, '/api/deals', {
      clientId: ids.c,
      title: 'Сделка дубля',
      amount: 1000,
    }).expect(201);
    await post(head, '/api/activities', {
      clientId: ids.c,
      type: 'call',
      subject: 'Звонок дубля',
      plannedAt: new Date(Date.now() + 86400000).toISOString(),
    }).expect(201);
  });
  afterAll(async () => {
    await app.close();
  });

  it('находит группу по ИНН, названию и телефону контакта', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/clients/duplicates')
      .set('Authorization', bearer(head))
      .expect(200);
    const group = response.body.find((g: { clients: { clientId: number }[] }) =>
      g.clients.some((c) => c.clientId === ids.a),
    );
    const members = group.clients.map((c: { clientId: number }) => c.clientId);
    expect(members).toEqual(
      expect.arrayContaining([ids.a, ids.b, ids.c, ids.solo]),
    );
    expect(group.reasons).toEqual(
      expect.arrayContaining(['inn', 'name', 'phone']),
    );
  });

  it('не показывает чужую организацию', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/clients/duplicates')
      .set('Authorization', bearer(other))
      .expect(200);
    expect(JSON.stringify(response.body)).not.toContain('Дубль-Тест');
  });

  it('менеджер не может объединять чужие карточки', async () => {
    await post(manager, `/api/clients/${ids.a}/merge`, {
      sourceIds: [ids.b],
    }).expect(403);
  });

  it('чужая организация получает 404', async () => {
    await post(other, `/api/clients/${ids.a}/merge`, {
      sourceIds: [ids.b],
    }).expect(404);
  });

  it('требует хотя бы одну карточку-дубль', async () => {
    await post(head, `/api/clients/${ids.a}/merge`, { sourceIds: [] }).expect(
      400,
    );
    await post(head, `/api/clients/${ids.a}/merge`, {
      sourceIds: [ids.a],
    }).expect(400);
  });

  it('переносит контакты, сделки и активности, дополняет поля и удаляет дубли', async () => {
    const response = await post(head, `/api/clients/${ids.a}/merge`, {
      sourceIds: [ids.b, ids.c, ids.solo],
    }).expect(201);
    expect(response.body).toMatchObject({
      clientId: ids.a,
      mergedCount: 3,
      movedContacts: 2,
      movedDeals: 1,
      movedActivities: 1,
    });
    const card = await request(app.getHttpServer())
      .get(`/api/clients/${ids.a}`)
      .set('Authorization', bearer(head))
      .expect(200);
    expect(card.body.industry).toBe('Логистика и транспорт');
    expect(card.body.contacts).toHaveLength(2);
    await request(app.getHttpServer())
      .get(`/api/clients/${ids.b}`)
      .set('Authorization', bearer(head))
      .expect(404);
    const deals = await request(app.getHttpServer())
      .get(`/api/deals?clientId=${ids.a}`)
      .set('Authorization', bearer(head))
      .expect(200);
    expect(deals.body.total).toBe(1);
  });
});
