import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MAIL_TRANSPORT } from '../src/mail/mail.transport';
import { createTestApp } from './setup';

/**
 * У только что зарегистрированной организации основной воронки ещё нет:
 * она создаётся при первом обращении. Параллельные первые запросы не
 * должны давать ошибок и не должны создавать вторую основную воронку.
 */
describe('Первая воронка организации при параллельных запросах', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp([
      {
        provide: MAIL_TRANSPORT,
        useValue: { enabled: true, send: () => Promise.resolve() },
      },
    ]);
  });
  afterAll(async () => {
    await app.close();
  });

  it('все запросы успешны и основная воронка одна, со всеми стадиями', async () => {
    const suffix = Date.now().toString().slice(-7);
    const login = `race-${suffix}`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        organizationName: `Гонка ${suffix}`,
        fullName: 'Иван Гонщиков',
        login,
        email: `${login}@example.com`,
        password: 'parol-registracii',
        acceptTerms: true,
      })
      .expect(201);
    const session = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login, password: 'parol-registracii' })
      .expect(200);
    const token = `Bearer ${session.body.accessToken}`;

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app.getHttpServer())
          .get('/api/pipelines')
          .set('Authorization', token),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([
      200, 200, 200, 200, 200, 200,
    ]);
    for (const response of responses) {
      const defaults = response.body.filter(
        (p: { isDefault: boolean }) => p.isDefault,
      );
      expect(defaults).toHaveLength(1);
      expect(defaults[0].stages).toHaveLength(6);
    }
  });
});
