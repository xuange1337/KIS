import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

describe('Авторизация и разграничение доступа (ТЗ п. 1.1)', () => {
  let app: INestApplication;
  let managerToken: string;
  let headToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    managerToken = await login(app, 'manager', 'manager123');
    headToken = await login(app, 'head', 'head123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('не пускает без токена', async () => {
    await request(app.getHttpServer()).get('/api/clients').expect(401);
  });

  it('отклоняет неверный пароль', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'manager', password: 'wrong-password' })
      .expect(401);
  });

  it('выдаёт профиль по действующему токену', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(managerToken))
      .expect(200);

    expect(response.body.login).toBe('manager');
    expect(response.body.role).toBe('manager');
    // Хеш пароля не должен покидать сервер ни при каких условиях
    expect(response.body.passwordHash).toBeUndefined();
  });

  it('устанавливает refresh-токен в httpOnly cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'manager', password: 'manager123' })
      .expect(200);

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((cookie) =>
      cookie.startsWith('crm_refresh='),
    );
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
  });

  it('обновляет access-токен по refresh-cookie', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'manager', password: 'manager123' })
      .expect(200);

    const cookies = loginResponse.headers['set-cookie'] as unknown as string[];
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookies)
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.login).toBe('manager');
  });

  it('менеджер видит только своих клиентов, руководитель — всех', async () => {
    const asManager = await request(app.getHttpServer())
      .get('/api/clients?limit=1')
      .set('Authorization', bearer(managerToken))
      .expect(200);

    const asHead = await request(app.getHttpServer())
      .get('/api/clients?limit=1')
      .set('Authorization', bearer(headToken))
      .expect(200);

    expect(asManager.body.total).toBeGreaterThan(0);
    expect(asHead.body.total).toBeGreaterThan(asManager.body.total);
  });

  it('менеджер не может открыть чужого клиента', async () => {
    // Клиент, закреплённый за другим менеджером, находится через выборку
    // руководителя: она не ограничена владельцем
    const all = await request(app.getHttpServer())
      .get('/api/clients?limit=100')
      .set('Authorization', bearer(headToken))
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(managerToken))
      .expect(200);

    const foreign = all.body.items.find(
      (client: { ownerUserId: number }) =>
        client.ownerUserId !== me.body.userId,
    );
    expect(foreign).toBeDefined();

    await request(app.getHttpServer())
      .get(`/api/clients/${foreign.clientId}`)
      .set('Authorization', bearer(managerToken))
      .expect(403);
  });

  it('менеджер не допускается к управлению пользователями', async () => {
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', bearer(managerToken))
      .expect(403);
  });

  it('администратор получает список пользователей', async () => {
    const adminToken = await login(app, 'admin', 'admin123');
    const response = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', bearer(adminToken))
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(4);
  });
});
