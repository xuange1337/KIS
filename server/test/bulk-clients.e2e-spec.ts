import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

/**
 * Массовые операции над клиентами.
 *
 * Главное свойство: операция выполняется целиком или не выполняется
 * вовсе. Частичный результат оставляет пользователя с сообщением
 * «изменено 7 из 12» и без ответа, какие пять и почему остались
 * прежними.
 */
describe('Массовая правка клиентов', () => {
  let app: INestApplication;
  let headToken: string;
  let managerToken: string;
  let managerId: number;
  let otherToken: string;
  const created: number[] = [];

  const createClient = async (name: string, token: string): Promise<number> => {
    const response = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', bearer(token))
      .send({ name })
      .expect(201);
    created.push(response.body.clientId);
    return response.body.clientId;
  };

  beforeAll(async () => {
    app = await createTestApp();
    headToken = await login(app, 'head', 'head123');
    managerToken = await login(app, 'manager', 'manager123');
    otherToken = await login(app, 'other-admin', 'other123');

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(managerToken))
      .expect(200);
    managerId = me.body.userId;
  });

  afterAll(async () => {
    for (const clientId of created) {
      await request(app.getHttpServer())
        .delete(`/api/clients/${clientId}?force=true`)
        .set('Authorization', bearer(headToken));
    }
    await app.close();
  });

  it('назначает ответственного сразу нескольким карточкам', async () => {
    const ids = [
      await createClient('ООО «Пачка 1»', headToken),
      await createClient('ООО «Пачка 2»', headToken),
      await createClient('ООО «Пачка 3»', headToken),
    ];

    const response = await request(app.getHttpServer())
      .patch('/api/clients/bulk')
      .set('Authorization', bearer(headToken))
      .send({ clientIds: ids, action: 'assign-owner', ownerUserId: managerId })
      .expect(200);
    expect(response.body.updated).toBe(3);

    for (const clientId of ids) {
      const client = await request(app.getHttpServer())
        .get(`/api/clients/${clientId}`)
        .set('Authorization', bearer(headToken))
        .expect(200);
      expect(client.body.ownerUserId).toBe(managerId);
    }
  });

  it('меняет статус пачкой', async () => {
    const ids = [
      await createClient('ООО «Статус 1»', headToken),
      await createClient('ООО «Статус 2»', headToken),
    ];

    await request(app.getHttpServer())
      .patch('/api/clients/bulk')
      .set('Authorization', bearer(headToken))
      .send({ clientIds: ids, action: 'set-status', status: 'archived' })
      .expect(200);

    const client = await request(app.getHttpServer())
      .get(`/api/clients/${ids[0]}`)
      .set('Authorization', bearer(headToken))
      .expect(200);
    expect(client.body.status).toBe('archived');
  });

  it('не меняет ничего, если хотя бы одна карточка недоступна', async () => {
    const mine = await createClient('ООО «Моя карточка»', managerToken);
    const foreign = await createClient('ООО «Чужая карточка»', headToken);

    const refused = await request(app.getHttpServer())
      .patch('/api/clients/bulk')
      .set('Authorization', bearer(managerToken))
      .send({
        clientIds: [mine, foreign],
        action: 'set-status',
        status: 'archived',
      })
      .expect(403);
    expect(refused.body.clientIds).toContain(foreign);

    // Доступная карточка тоже осталась прежней: операция целиком
    // или никак
    const client = await request(app.getHttpServer())
      .get(`/api/clients/${mine}`)
      .set('Authorization', bearer(managerToken))
      .expect(200);
    expect(client.body.status).not.toBe('archived');
  });

  it('не трогает карточки соседней организации', async () => {
    const ours = await createClient('ООО «Наша для проверки»', headToken);

    await request(app.getHttpServer())
      .patch('/api/clients/bulk')
      .set('Authorization', bearer(otherToken))
      .send({ clientIds: [ours], action: 'set-status', status: 'archived' })
      .expect(403);

    const client = await request(app.getHttpServer())
      .get(`/api/clients/${ours}`)
      .set('Authorization', bearer(headToken))
      .expect(200);
    expect(client.body.status).not.toBe('archived');
  });

  it('менеджеру не даёт назначать ответственного', async () => {
    const mine = await createClient('ООО «Моя вторая»', managerToken);

    // Права те же, что и в карточке: менеджер не переназначает записи
    await request(app.getHttpServer())
      .patch('/api/clients/bulk')
      .set('Authorization', bearer(managerToken))
      .send({
        clientIds: [mine],
        action: 'assign-owner',
        ownerUserId: managerId,
      })
      .expect(403);
  });

  it('отклоняет пустой выбор и слишком большую пачку', async () => {
    await request(app.getHttpServer())
      .patch('/api/clients/bulk')
      .set('Authorization', bearer(headToken))
      .send({ clientIds: [], action: 'set-status', status: 'archived' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/api/clients/bulk')
      .set('Authorization', bearer(headToken))
      .send({
        clientIds: Array.from({ length: 201 }, (_, index) => index + 1),
        action: 'set-status',
        status: 'archived',
      })
      .expect(400);
  });

  it('требует параметр, соответствующий действию', async () => {
    const mine = await createClient('ООО «Без параметра»', headToken);

    await request(app.getHttpServer())
      .patch('/api/clients/bulk')
      .set('Authorization', bearer(headToken))
      .send({ clientIds: [mine], action: 'assign-owner' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/clients/bulk')
      .set('Authorization', bearer(headToken))
      .send({ clientIds: [mine], action: 'set-status' })
      .expect(400);
  });
});
