import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

const csrfToken = (cookies: string[]): string => {
  const cookie = cookies.find((value) => value.startsWith('crm_csrf='));
  if (!cookie) throw new Error('CSRF cookie отсутствует');
  return cookie.split(';')[0].slice('crm_csrf='.length);
};

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

  it('публикует liveness и readiness без авторизации', async () => {
    await request(app.getHttpServer())
      .get('/api/health/live')
      .expect(200, { status: 'ok' });

    await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200, { status: 'ok', database: 'up', schema: 'current' });
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
      .set('X-CSRF-Token', csrfToken(cookies))
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.login).toBe('manager');
  });

  it('отклоняет refresh без CSRF-заголовка', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'manager', password: 'manager123' })
      .expect(200);

    const cookies = loginResponse.headers['set-cookie'] as unknown as string[];
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookies)
      .expect(403);
  });

  // Повторное использование refresh-токена отзывает все сессии учётной
  // записи, поэтому проверка идёт на отдельном пользователе: иначе она
  // закрывала бы общий managerToken остальных тестов файла
  it('ротирует refresh-токен и отклоняет повторное использование', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'manager2', password: 'manager123' })
      .expect(200);

    const originalCookies = loginResponse.headers[
      'set-cookie'
    ] as unknown as string[];
    const refreshResponse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', originalCookies)
      .set('X-CSRF-Token', csrfToken(originalCookies))
      .expect(200);

    // Обновление возвращает и новый refresh-токен, и новую CSRF-cookie
    const rotatedCookies = refreshResponse.headers[
      'set-cookie'
    ] as unknown as string[];
    expect(rotatedCookies.some((value) => value.startsWith('crm_csrf='))).toBe(
      true,
    );
    expect(rotatedCookies[0]).not.toBe(originalCookies[0]);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', originalCookies)
      .set('X-CSRF-Token', csrfToken(originalCookies))
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', rotatedCookies)
      .set('X-CSRF-Token', csrfToken(rotatedCookies))
      .expect(401);
  });

  it('отзывает refresh-сессию при выходе', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'manager', password: 'manager123' })
      .expect(200);

    const cookies = loginResponse.headers['set-cookie'] as unknown as string[];
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken(cookies))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken(cookies))
      .expect(401);
  });

  // Проверка завершает все сессии учётной записи, поэтому выполняется на
  // отдельном пользователе: access-токен теперь привязан к сессии, и общий
  // managerToken перестал бы работать в остальных тестах файла
  it('показывает и завершает активные сессии', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'manager2', password: 'manager123' })
      .expect(200);
    const second = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'manager2', password: 'manager123' })
      .expect(200);

    const sessions = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', bearer(second.body.accessToken))
      .expect(200);

    expect(sessions.body.length).toBeGreaterThanOrEqual(2);
    expect(
      sessions.body.some(
        (session: { isCurrent: boolean }) => session.isCurrent,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .delete('/api/auth/sessions')
      .set('Authorization', bearer(second.body.accessToken))
      .expect(204);

    const firstCookies = first.headers['set-cookie'] as unknown as string[];
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', firstCookies)
      .set('X-CSRF-Token', csrfToken(firstCookies))
      .expect(401);

    const secondCookies = second.headers['set-cookie'] as unknown as string[];
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', secondCookies)
      .set('X-CSRF-Token', csrfToken(secondCookies))
      .expect(401);
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
