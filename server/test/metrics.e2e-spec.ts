import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, bearer } from './setup';

/**
 * Метрики раскрывают устройство системы, поэтому главное, что проверяется
 * здесь, — доступ: без секрета маршрута нет, с неверным секретом отказ,
 * обычный токен пользователя не подходит.
 */
describe('Метрики', () => {
  let app: INestApplication;
  const previousToken = process.env.METRICS_TOKEN;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (previousToken === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = previousToken;
    await app.close();
  });

  afterEach(() => {
    delete process.env.METRICS_TOKEN;
  });

  it('без METRICS_TOKEN маршрут не существует', async () => {
    delete process.env.METRICS_TOKEN;
    await request(app.getHttpServer()).get('/api/metrics').expect(404);
  });

  it('без заголовка или с неверным токеном отвечает 401', async () => {
    process.env.METRICS_TOKEN = 'metrics-secret';
    await request(app.getHttpServer()).get('/api/metrics').expect(401);
    await request(app.getHttpServer())
      .get('/api/metrics')
      .set('Authorization', 'Bearer wrong')
      .expect(401);
  });

  it('токен пользователя не открывает метрики', async () => {
    process.env.METRICS_TOKEN = 'metrics-secret';
    const token = await login(app, 'admin', 'admin123');
    await request(app.getHttpServer())
      .get('/api/metrics')
      .set('Authorization', bearer(token))
      .expect(401);
  });

  it('с верным токеном отдаёт формат Prometheus', async () => {
    process.env.METRICS_TOKEN = 'metrics-secret';
    // Запрос, который должен попасть в счётчики по шаблону маршрута
    await request(app.getHttpServer()).get('/api/clients/1').expect(401);

    const response = await request(app.getHttpServer())
      .get('/api/metrics')
      .set('Authorization', 'Bearer metrics-secret')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('# TYPE crm_http_requests_total counter');
    expect(response.text).toContain('# TYPE crm_db_up gauge');
    expect(response.text).toMatch(/^crm_db_up 1$/m);
    expect(response.text).toMatch(/^process_uptime_seconds [\d.]+$/m);
    // Маршрут берётся из шаблона, а не из фактического адреса
    expect(response.text).toContain('route="/api/clients/:id"');
    expect(response.text).not.toContain('route="/api/clients/1"');
    // Сами метрики в статистику не попадают
    expect(response.text).not.toContain('route="/api/metrics"');
  });
});
