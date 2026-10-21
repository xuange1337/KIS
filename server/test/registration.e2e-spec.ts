import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { MAIL_TRANSPORT, MailMessage } from '../src/mail/mail.transport';
import { TrialService } from '../src/organizations/trial.service';
import { bearer, createTestApp, login } from './setup';

/**
 * Самостоятельная регистрация, подтверждение адреса, восстановление
 * пароля по почте и пробный период.
 */
describe('Регистрация и пробный период', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const outbox: MailMessage[] = [];
  const transport = {
    enabled: true,
    send: (message: MailMessage) => {
      outbox.push(message);
      return Promise.resolve();
    },
  };
  const createdLogins: string[] = [];
  const createdOrganizations: string[] = [];
  const suffix = Date.now().toString().slice(-7);

  const tokenFrom = (message: MailMessage | undefined): string => {
    const match = message?.text.match(/token=([0-9a-f]{64})/);
    if (!match) throw new Error('В письме нет ссылки с токеном');
    return match[1];
  };

  const lastMailTo = (to: string) =>
    [...outbox].reverse().find((message) => message.to === to);

  const register = (overrides: Record<string, unknown> = {}) => {
    const loginName = `reg-${suffix}-${createdLogins.length}`;
    const body = {
      organizationName: `Тестовая компания ${suffix}`,
      fullName: 'Иван Регистратор',
      login: loginName,
      email: `${loginName}@example.com`,
      password: 'parol-registracii',
      acceptTerms: true,
      ...overrides,
    };
    return {
      body,
      call: () =>
        request(app.getHttpServer()).post('/api/auth/register').send(body),
    };
  };

  const registerOk = async (overrides: Record<string, unknown> = {}) => {
    const { body, call } = register(overrides);
    const response = await call().expect(201);
    createdLogins.push(body.login as string);
    createdOrganizations.push(body.organizationName as string);
    return { body, response };
  };

  beforeAll(async () => {
    app = await createTestApp([
      { provide: MAIL_TRANSPORT, useValue: transport },
    ]);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    const organizations = await dataSource.query(
      `SELECT organization_id FROM organizations WHERE name = ANY($1)`,
      [createdOrganizations],
    );
    const ids = organizations.map(
      (row: { organization_id: number }) => row.organization_id,
    );
    // Записи, созданные в этих организациях, удаляются до самих организаций
    await dataSource.query(
      `DELETE FROM audit_log WHERE organization_id = ANY($1)`,
      [ids],
    );
    await dataSource.query(
      `DELETE FROM clients WHERE organization_id = ANY($1)`,
      [ids],
    );
    await dataSource.query(`DELETE FROM users WHERE login = ANY($1)`, [
      createdLogins,
    ]);
    await dataSource.query(
      `DELETE FROM organizations WHERE organization_id = ANY($1)`,
      [ids],
    );
    await app.close();
  });

  beforeEach(() => {
    outbox.length = 0;
  });

  describe('регистрация', () => {
    it('создаёт организацию на пробном периоде и открывает сеанс', async () => {
      const { body, response } = await registerOk();

      expect(response.body.accessToken).toBeTruthy();
      expect(response.body.user.role).toBe('admin');
      expect(response.body.user.email).toBe(body.email);
      expect(response.body.user.emailVerified).toBe(false);
      expect(response.body.organization.status).toBe('trial');

      const days =
        (new Date(response.body.organization.trialEndsAt).getTime() -
          Date.now()) /
        86_400_000;
      expect(days).toBeGreaterThan(13);
      expect(days).toBeLessThanOrEqual(14);

      // Письмо подтверждения ушло на указанный адрес
      const mail = lastMailTo(body.email as string);
      expect(mail?.subject).toContain('Подтвердите');
      expect(tokenFrom(mail)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('вход по логину работает сразу', async () => {
      const { body } = await registerOk();
      const token = await login(app, body.login as string, 'parol-registracii');
      expect(token).toBeTruthy();
    });

    it('новая организация не видит чужих данных', async () => {
      const { response } = await registerOk();
      const clients = await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', bearer(response.body.accessToken))
        .expect(200);
      expect(clients.body.total).toBe(0);
    });

    it('отклоняет занятый логин', async () => {
      const { body } = await registerOk();
      await register({ login: body.login, email: 'other@example.com' })
        .call()
        .expect(409);
    });

    it('требует принять условия', async () => {
      await register({ acceptTerms: false }).call().expect(400);
    });

    it('отклоняет некорректную почту и короткий пароль', async () => {
      await register({ email: 'not-an-email' }).call().expect(400);
      await register({ password: '123' }).call().expect(400);
    });

    it('две организации могут называться одинаково', async () => {
      await registerOk({ organizationName: `Одинаковое ${suffix}` });
      await registerOk({ organizationName: `Одинаковое ${suffix}` });
    });
  });

  describe('подтверждение адреса', () => {
    it('подтверждает адрес по ссылке один раз', async () => {
      const { body, response } = await registerOk();
      const token = tokenFrom(lastMailTo(body.email as string));

      await request(app.getHttpServer())
        .post('/api/auth/email/verify')
        .send({ token })
        .expect(200);

      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', bearer(response.body.accessToken))
        .expect(200);
      expect(me.body.emailVerified).toBe(true);

      await request(app.getHttpServer())
        .post('/api/auth/email/verify')
        .send({ token })
        .expect(400);
    });

    it('отклоняет неизвестный токен', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/email/verify')
        .send({ token: 'a'.repeat(64) })
        .expect(400);
    });

    it('старая ссылка не подтверждает новый адрес', async () => {
      const { body, response } = await registerOk();
      const oldToken = tokenFrom(lastMailTo(body.email as string));
      const newEmail = `new-${suffix}-${createdLogins.length}@example.com`;

      await request(app.getHttpServer())
        .post('/api/auth/email')
        .set('Authorization', bearer(response.body.accessToken))
        .send({ email: newEmail })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/email/verify')
        .send({ token: oldToken })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/auth/email/verify')
        .send({ token: tokenFrom(lastMailTo(newEmail)) })
        .expect(200);
    });

    it('подтверждённый адрес нельзя занять второй учётной записью', async () => {
      const first = await registerOk();
      await request(app.getHttpServer())
        .post('/api/auth/email/verify')
        .send({ token: tokenFrom(lastMailTo(first.body.email as string)) })
        .expect(200);

      await register({ email: (first.body.email as string).toUpperCase() })
        .call()
        .expect(409);
    });

    it('повторная отправка возможна, пока адрес не подтверждён', async () => {
      const { body, response } = await registerOk();
      outbox.length = 0;
      await request(app.getHttpServer())
        .post('/api/auth/email/resend')
        .set('Authorization', bearer(response.body.accessToken))
        .expect(200);
      expect(lastMailTo(body.email as string)).toBeTruthy();
    });
  });

  describe('приглашения до подтверждения', () => {
    it('запрещены, пока адрес не подтверждён, потом разрешены', async () => {
      const { body, response } = await registerOk();
      const invite = () =>
        request(app.getHttpServer())
          .post('/api/organizations/current/invitations')
          .set('Authorization', bearer(response.body.accessToken))
          .send({ role: 'manager' });

      await invite().expect(403);

      await request(app.getHttpServer())
        .post('/api/auth/email/verify')
        .send({ token: tokenFrom(lastMailTo(body.email as string)) })
        .expect(200);
      await invite().expect(201);
    });
  });

  describe('восстановление пароля по почте', () => {
    it('отправляет ссылку на подтверждённый адрес и меняет пароль', async () => {
      const { body } = await registerOk();
      await request(app.getHttpServer())
        .post('/api/auth/email/verify')
        .send({ token: tokenFrom(lastMailTo(body.email as string)) })
        .expect(200);
      outbox.length = 0;

      await request(app.getHttpServer())
        .post('/api/auth/password/forgot')
        .send({ email: body.email })
        .expect(204);

      const token = tokenFrom(lastMailTo(body.email as string));
      await request(app.getHttpServer())
        .post('/api/auth/password/reset')
        .send({ token, newPassword: 'novyj-parol-1' })
        .expect(204);

      expect(
        await login(app, body.login as string, 'novyj-parol-1'),
      ).toBeTruthy();
    });

    it('отвечает одинаково для неизвестного и неподтверждённого адреса', async () => {
      const { body } = await registerOk();
      outbox.length = 0;

      await request(app.getHttpServer())
        .post('/api/auth/password/forgot')
        .send({ email: 'nobody@example.com' })
        .expect(204);
      await request(app.getHttpServer())
        .post('/api/auth/password/forgot')
        .send({ email: body.email })
        .expect(204);

      // Неподтверждённый адрес не годится для восстановления: иначе
      // чужой адрес, вписанный при регистрации, получал бы доступ
      expect(
        outbox.filter((m) => m.subject === 'Установка пароля'),
      ).toHaveLength(0);
    });
  });

  describe('окончание пробного периода', () => {
    const endTrial = (organizationName: string) =>
      dataSource.query(
        `UPDATE organizations SET trial_ends_at = now() - interval '1 hour'
          WHERE name = $1`,
        [organizationName],
      );

    it('закрывает запись, но оставляет чтение и выгрузку', async () => {
      const { body, response } = await registerOk({
        organizationName: `Истёкшая ${suffix}`,
      });
      const auth = { Authorization: bearer(response.body.accessToken) };
      const client = {
        name: 'ООО Клиент',
        status: 'lead',
        source: 'website',
        preferredChannel: 'email',
      };

      await request(app.getHttpServer())
        .post('/api/clients')
        .set(auth)
        .send(client)
        .expect(201);

      await endTrial(body.organizationName as string);

      const blocked = await request(app.getHttpServer())
        .post('/api/clients')
        .set(auth)
        .send({ ...client, name: 'ООО Второй' })
        .expect(402);
      expect(blocked.body.code).toBe('ORGANIZATION_SUSPENDED');

      await request(app.getHttpServer())
        .get('/api/clients')
        .set(auth)
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/reports/funnel/export/jobs')
        .set(auth)
        .send({ format: 'csv' })
        .expect((res) => expect(res.status).not.toBe(402));

      // Статус виден клиенту: интерфейс показывает причину блокировки
      const organization = await request(app.getHttpServer())
        .get('/api/organizations/current')
        .set(auth)
        .expect(200);
      expect(organization.body.status).toBe('suspended');
    });

    it('активная организация не блокируется', async () => {
      const token = await login(app, 'admin', 'admin123');
      const organization = await request(app.getHttpServer())
        .get('/api/organizations/current')
        .set('Authorization', bearer(token))
        .expect(200);
      expect(organization.body.status).toBe('active');
      expect(organization.body.trialEndsAt).toBeNull();
    });

    it('напоминает администратору с подтверждённым адресом один раз на порог', async () => {
      const { body } = await registerOk({
        organizationName: `Напоминание ${suffix}`,
      });
      await request(app.getHttpServer())
        .post('/api/auth/email/verify')
        .send({ token: tokenFrom(lastMailTo(body.email as string)) })
        .expect(200);
      outbox.length = 0;

      const trial = app.get(TrialService);
      const trialEnd = new Date(Date.now() + 2.5 * 86_400_000);
      await dataSource.query(
        `UPDATE organizations SET trial_ends_at = $2, trial_notified_days = NULL
          WHERE name = $1`,
        [body.organizationName, trialEnd],
      );

      const count = await trial.sendReminders(new Date());
      expect(count).toBeGreaterThanOrEqual(1);
      const reminders = outbox.filter((m) => m.to === body.email);
      expect(reminders).toHaveLength(1);
      expect(reminders[0].text).toContain('Осталось дней: 3');

      // Повторный запуск тем же днём ничего не шлёт
      outbox.length = 0;
      await trial.sendReminders(new Date());
      expect(outbox.filter((m) => m.to === body.email)).toHaveLength(0);

      // Наступил день окончания — приходит последнее письмо
      await trial.sendReminders(new Date(trialEnd.getTime() + 1000));
      const last = outbox.filter((m) => m.to === body.email);
      expect(last).toHaveLength(1);
      expect(last[0].subject).toContain('закончился');
    });
  });

  describe('пороги напоминаний', () => {
    const now = new Date('2026-10-01T10:00:00Z');
    const at = (days: number) => new Date(now.getTime() + days * 86_400_000);

    it.each([
      [10, null],
      [7, 7],
      [5, 7],
      [3, 3],
      [2.2, 3],
      [1, 1],
      [0.3, 1],
      [-1, 0],
    ])('за %f дн. → порог %s', (days, expected) => {
      expect(TrialService.thresholdFor(at(days), now)).toBe(expected);
    });
  });
});
