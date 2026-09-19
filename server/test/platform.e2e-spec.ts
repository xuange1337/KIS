import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';
import { buildOpenApiDocument } from '../src/common/openapi';

/** Платформенные гарантии API: контракт ошибок, трассировка, спецификация. */
describe('Контракт API и наблюдаемость', () => {
  let app: INestApplication;
  let managerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    managerToken = await login(app, 'manager', 'manager123');
    adminToken = await login(app, 'admin', 'admin123');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Сквозной идентификатор запроса', () => {
    it('возвращает идентификатор в заголовке успешного ответа', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients?limit=1')
        .set('Authorization', bearer(managerToken))
        .expect(200);

      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('сохраняет идентификатор, пришедший от прокси', async () => {
      const incoming = 'edge-42.abc_DEF';
      const response = await request(app.getHttpServer())
        .get('/api/clients?limit=1')
        .set('x-request-id', incoming)
        .set('Authorization', bearer(managerToken))
        .expect(200);

      expect(response.headers['x-request-id']).toBe(incoming);
    });

    it('заменяет идентификатор с посторонними символами', async () => {
      // Значение попадает в логи и в заголовок ответа: переводы строк
      // и кавычки из него подделывают соседние записи лога
      const response = await request(app.getHttpServer())
        .get('/api/clients?limit=1')
        .set('x-request-id', 'fake id with spaces')
        .set('Authorization', bearer(managerToken))
        .expect(200);

      expect(response.headers['x-request-id']).not.toBe('fake id with spaces');
    });
  });

  describe('Единый контракт ошибок', () => {
    const expectErrorShape = (
      body: Record<string, unknown>,
      status: number,
    ): void => {
      expect(body.statusCode).toBe(status);
      expect(typeof body.code).toBe('string');
      expect(body.message).toBeDefined();
      expect(typeof body.path).toBe('string');
      expect(typeof body.requestId).toBe('string');
      expect(typeof body.timestamp).toBe('string');
    };

    it('описывает ошибку авторизации', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients')
        .expect(401);
      expectErrorShape(response.body, 401);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('описывает отказ по правам', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', bearer(managerToken))
        .expect(403);
      expectErrorShape(response.body, 403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('описывает отсутствующую запись', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients/999999')
        .set('Authorization', bearer(adminToken))
        .expect(404);
      expectErrorShape(response.body, 404);
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('сохраняет массив сообщений валидации', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(managerToken))
        .send({ name: 'x', inn: 'не-инн' })
        .expect(400);

      expectErrorShape(response.body, 400);
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('сохраняет дополнительные поля исключения', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(managerToken))
        .send({ name: 'Клиент для проверки контракта ошибок' })
        .expect(201);
      const clientId = created.body.clientId;

      await request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', bearer(managerToken))
        .send({
          clientId,
          type: 'call',
          subject: 'Связанная активность',
          plannedAt: new Date().toISOString(),
        })
        .expect(201);

      const refused = await request(app.getHttpServer())
        .delete(`/api/clients/${clientId}`)
        .set('Authorization', bearer(managerToken))
        .expect(409);

      // Поле dependents было в ответе до введения общего контракта:
      // интерфейс показывает по нему состав потерь
      expect(refused.body.dependents.activities).toBeGreaterThanOrEqual(1);
      expectErrorShape(refused.body, 409);
      expect(refused.body.code).toBe('CONFLICT');

      await request(app.getHttpServer())
        .delete(`/api/clients/${clientId}?force=true`)
        .set('Authorization', bearer(managerToken))
        .expect(200);
    });
  });

  describe('Ограничение размера тела запроса', () => {
    it('отклоняет запрос, превышающий предел', async () => {
      // Значение проходит валидацию по типу, но не по размеру:
      // без предела один запрос занимает память процесса
      await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(managerToken))
        .send({ name: 'Клиент', address: 'a'.repeat(400 * 1024) })
        .expect(413)
        .expect((response) => {
          // Идентификатор есть и у ошибки разбора тела: она возникает
          // раньше контроллеров, но уже внутри контекста запроса
          expect(typeof response.body.requestId).toBe('string');
        });
    });
  });

  describe('Идемпотентность создания', () => {
    const key = () =>
      `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    it('повтор с тем же ключом не создаёт вторую запись', async () => {
      const idempotencyKey = key();
      const payload = { name: 'ООО «Повтор запроса»' };

      const first = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(managerToken))
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(201);

      // Клиент не получил ответ из-за обрыва связи и повторил запрос:
      // раньше это создавало вторую карточку
      const second = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(managerToken))
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(201);

      expect(second.body.clientId).toBe(first.body.clientId);

      const found = await request(app.getHttpServer())
        .get('/api/clients?q=Повтор запроса&limit=50')
        .set('Authorization', bearer(managerToken))
        .expect(200);
      expect(found.body.items).toHaveLength(1);

      await request(app.getHttpServer())
        .delete(`/api/clients/${first.body.clientId}`)
        .set('Authorization', bearer(managerToken))
        .expect(200);
    });

    it('отклоняет тот же ключ с другими данными', async () => {
      const idempotencyKey = key();
      const created = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(managerToken))
        .set('Idempotency-Key', idempotencyKey)
        .send({ name: 'ООО «Первый запрос»' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(managerToken))
        .set('Idempotency-Key', idempotencyKey)
        .send({ name: 'ООО «Другие данные»' })
        .expect(409);

      await request(app.getHttpServer())
        .delete(`/api/clients/${created.body.clientId}`)
        .set('Authorization', bearer(managerToken))
        .expect(200);
    });

    it('не путает ключи разных пользователей', async () => {
      const idempotencyKey = key();
      const payload = { name: 'ООО «Общий ключ»' };

      const mine = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(managerToken))
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(201);

      // Тот же ключ у другого пользователя — другая операция
      const theirs = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(adminToken))
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(201);

      expect(theirs.body.clientId).not.toBe(mine.body.clientId);

      for (const [id, token] of [
        [mine.body.clientId, managerToken],
        [theirs.body.clientId, adminToken],
      ] as const) {
        await request(app.getHttpServer())
          .delete(`/api/clients/${id}`)
          .set('Authorization', bearer(token))
          .expect(200);
      }
    });

    it('создаёт как обычно без заголовка', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(managerToken))
        .send({ name: 'ООО «Без ключа»' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/clients/${created.body.clientId}`)
        .set('Authorization', bearer(managerToken))
        .expect(200);
    });
  });

  describe('Диагностика администратора', () => {
    it('отдаёт состояние экземпляра и показатели организации', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/diagnostics')
        .set('Authorization', bearer(adminToken))
        .expect(200);

      expect(response.body.instance.nodeVersion).toMatch(/^v\d+/);
      expect(response.body.instance.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(response.body.database.schemaVersion).toEqual(expect.any(String));
      expect(response.body.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.body.organization.clients).toBeGreaterThan(0);
      expect(response.body.organization.users).toBeGreaterThan(0);
    });

    it('считает показатели в пределах организации', async () => {
      const otherAdminToken = await login(app, 'other-admin', 'other123');
      const mine = await request(app.getHttpServer())
        .get('/api/diagnostics')
        .set('Authorization', bearer(adminToken))
        .expect(200);
      const theirs = await request(app.getHttpServer())
        .get('/api/diagnostics')
        .set('Authorization', bearer(otherAdminToken))
        .expect(200);

      // Диагностика — тоже данные организации: администратор соседней
      // не должен видеть даже объём чужой базы клиентов
      expect(theirs.body.organization.organizationId).not.toBe(
        mine.body.organization.organizationId,
      );
      expect(theirs.body.organization.clients).toBe(1);
      expect(theirs.body.organization.users).toBe(2);
    });

    it('закрыта для менеджера', async () => {
      await request(app.getHttpServer())
        .get('/api/diagnostics')
        .set('Authorization', bearer(managerToken))
        .expect(403);
    });
  });

  describe('Версионирование API', () => {
    it('отвечает и на версионный путь, и на прежний', async () => {
      const versioned = await request(app.getHttpServer())
        .get('/api/v1/clients?limit=1')
        .set('Authorization', bearer(managerToken))
        .expect(200);
      const neutral = await request(app.getHttpServer())
        .get('/api/clients?limit=1')
        .set('Authorization', bearer(managerToken))
        .expect(200);

      // Прежний путь оставлен намеренно: уже написанные клиенты,
      // включая собственный интерфейс, ломать незачем
      expect(versioned.body.total).toBe(neutral.body.total);
    });

    it('не отвечает на несуществующую версию', async () => {
      await request(app.getHttpServer())
        .get('/api/v2/clients')
        .set('Authorization', bearer(managerToken))
        .expect(404);
    });
  });

  describe('Готовность экземпляра', () => {
    it('подтверждает, что схема базы соответствует коду', async () => {
      // С непримененными миграциями экземпляр не должен принимать трафик:
      // запросы падали бы на отсутствующих колонках уже под нагрузкой
      const response = await request(app.getHttpServer())
        .get('/api/health/ready')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        database: 'up',
        schema: 'current',
      });
    });
  });

  describe('Спецификация OpenAPI', () => {
    it('описывает все маршруты приложения с префиксом /api', () => {
      const document = buildOpenApiDocument(app);
      const paths = Object.keys(document.paths);

      expect(paths.length).toBeGreaterThan(30);
      expect(paths.every((path) => path.startsWith('/api/'))).toBe(true);
      expect(paths).toContain('/api/auth/login');
      expect(paths).toContain('/api/reports/funnel');
      expect(document.security).toEqual([{ 'access-token': [] }]);
    });
  });
});
