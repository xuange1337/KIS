import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createTestApp, login } from './setup';

/**
 * Регрессионные проверки исправлений аудита готовности.
 * Каждый тест соответствует конкретному дефекту и падает, если его вернуть.
 */
describe('Укрепление сессий, прав и списков', () => {
  let app: INestApplication;
  let adminToken: string;

  const csrfToken = (cookies: string[]): string => {
    const cookie = cookies.find((value) => value.startsWith('crm_csrf='));
    if (!cookie) throw new Error('CSRF cookie отсутствует');
    return cookie.split(';')[0].slice('crm_csrf='.length);
  };

  /** Полный вход: access-токен вместе с cookie сессии. */
  const fullLogin = async (
    loginName: string,
    password: string,
  ): Promise<{ accessToken: string; cookies: string[]; csrf: string }> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: loginName, password })
      .expect(200);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    return {
      accessToken: response.body.accessToken,
      cookies,
      csrf: csrfToken(cookies),
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await login(app, 'admin', 'admin123');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Отзыв сессии прекращает доступ немедленно', () => {
    it('access-токен перестаёт работать после выхода', async () => {
      const session = await fullLogin('manager', 'manager123');

      await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', bearer(session.accessToken))
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', session.cookies)
        .set('x-csrf-token', session.csrf)
        .expect(200);

      // Раньше выданный access-токен жил до своего истечения (15 минут),
      // и «выход» не закрывал доступ к API
      await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', bearer(session.accessToken))
        .expect(401);
    });

    it('«завершить все сессии» закрывает доступ по выданным токенам', async () => {
      const first = await fullLogin('manager', 'manager123');
      const second = await fullLogin('manager', 'manager123');

      await request(app.getHttpServer())
        .delete('/api/auth/sessions')
        .set('Authorization', bearer(second.accessToken))
        .expect(204);

      await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', bearer(first.accessToken))
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', bearer(second.accessToken))
        .expect(401);
    });

    it('повторное использование refresh-токена отзывает все сессии пользователя', async () => {
      const first = await fullLogin('manager2', 'manager123');
      const second = await fullLogin('manager2', 'manager123');

      const rotated = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', first.cookies)
        .set('x-csrf-token', first.csrf)
        .expect(200);
      expect(rotated.body.accessToken).toBeDefined();

      // Предъявление старого токена — признак кражи: закрываются все сессии,
      // а не только та, по которой пришёл повтор
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', first.cookies)
        .set('x-csrf-token', first.csrf)
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', bearer(second.accessToken))
        .expect(401);
    });

    it('продлевает CSRF-cookie вместе с refresh-токеном', async () => {
      const session = await fullLogin('manager', 'manager123');

      const refreshed = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', session.cookies)
        .set('x-csrf-token', session.csrf)
        .expect(200);

      const cookies = refreshed.headers['set-cookie'] as unknown as string[];
      // Без продления CSRF-cookie истекала раньше живой сессии,
      // и обновление токена начинало отвечать 403
      expect(cookies.some((cookie) => cookie.startsWith('crm_csrf='))).toBe(
        true,
      );
    });
  });

  describe('Администратор не теряет доступ к системе', () => {
    it('не блокирует сам себя', async () => {
      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', bearer(adminToken))
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/users/${me.body.userId}`)
        .set('Authorization', bearer(adminToken))
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', bearer(adminToken))
        .expect(200);
    });

    it('не снимает с себя роль администратора', async () => {
      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', bearer(adminToken))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/users/${me.body.userId}`)
        .set('Authorization', bearer(adminToken))
        .send({ role: 'manager' })
        .expect(400);
    });

    it('блокирует другого администратора, пока остаётся действующий', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', bearer(adminToken))
        .send({
          login: `admin-spare-${Date.now()}`,
          password: 'spare-admin-123',
          fullName: 'Запасной администратор',
          role: 'admin',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/users/${created.body.userId}`)
        .set('Authorization', bearer(adminToken))
        .expect(200);
    });
  });

  describe('Списки выдаются устойчивым порядком', () => {
    it('не повторяет и не теряет записи на границе страниц', async () => {
      const pageSize = 5;
      const first = await request(app.getHttpServer())
        .get(`/api/clients?sort=status&order=ASC&page=1&limit=${pageSize}`)
        .set('Authorization', bearer(adminToken))
        .expect(200);
      const second = await request(app.getHttpServer())
        .get(`/api/clients?sort=status&order=ASC&page=2&limit=${pageSize}`)
        .set('Authorization', bearer(adminToken))
        .expect(200);

      const ids = (body: { items: { clientId: number }[] }): number[] =>
        body.items.map((item) => item.clientId);
      const firstIds = ids(first.body);
      const secondIds = ids(second.body);

      // Сортировка по полю с повторяющимися значениями раньше давала
      // произвольный порядок внутри группы: запись попадала на обе страницы
      expect(firstIds).toHaveLength(pageSize);
      expect(new Set([...firstIds, ...secondIds]).size).toBe(
        firstIds.length + secondIds.length,
      );
    });

    it('повторный запрос той же страницы возвращает тот же состав', async () => {
      const url = '/api/deals?sort=stage&order=DESC&page=2&limit=5';
      const first = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(adminToken))
        .expect(200);
      const second = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', bearer(adminToken))
        .expect(200);

      expect(
        second.body.items.map((item: { dealId: number }) => item.dealId),
      ).toEqual(
        first.body.items.map((item: { dealId: number }) => item.dealId),
      );
    });
  });

  describe('Журнал действий не хранит лишнего', () => {
    it('заменяет свободный текст пометкой вместо содержимого', async () => {
      const clients = await request(app.getHttpServer())
        .get('/api/clients?limit=1')
        .set('Authorization', bearer(adminToken))
        .expect(200);
      const clientId = clients.body.items[0].clientId;

      const secret = 'Паспорт 1234 567890, перезвонить после обеда';
      const created = await request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', bearer(adminToken))
        .send({
          clientId,
          type: 'call',
          subject: 'Проверка журналирования',
          plannedAt: new Date().toISOString(),
          comment: secret,
        })
        .expect(201);
      expect(created.body.comment).toBe(secret);

      const dataSource = app.get(DataSource);
      const rows = await dataSource.query(
        `SELECT payload FROM audit_log
          WHERE entity = 'activities' AND action = 'create'
          ORDER BY id DESC LIMIT 1`,
      );
      const payload = JSON.stringify(rows[0].payload);
      // Журнал переживает сами записи и выгружается при разборе инцидентов:
      // персональные данные из свободного текста в него попадать не должны
      expect(payload).not.toContain('1234 567890');
      expect(payload).toContain('[скрыто]');
    });

    it('не сохраняет пароль при заведении пользователя', async () => {
      const password = 'ochen-sekretnyy-parol-123';
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', bearer(adminToken))
        .send({
          login: `audit-check-${Date.now()}`,
          password,
          fullName: 'Проверка журнала',
          role: 'manager',
        })
        .expect(201);

      const dataSource = app.get(DataSource);
      const rows = await dataSource.query(
        `SELECT payload FROM audit_log
          WHERE entity = 'users' AND action = 'create'
          ORDER BY id DESC LIMIT 1`,
      );
      expect(JSON.stringify(rows[0].payload)).not.toContain(password);
    });
  });

  describe('Вход не раскрывает существующие логины', () => {
    it('отвечает одинаково на неизвестный логин и на неверный пароль', async () => {
      const unknown = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: 'takogo-net', password: 'manager123' })
        .expect(401);
      const wrongPassword = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: 'manager', password: 'nevernyy-parol' })
        .expect(401);

      expect(unknown.body.message).toBe(wrongPassword.body.message);
    });
  });
});
