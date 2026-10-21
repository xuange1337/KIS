import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MAIL_TRANSPORT, MailMessage } from '../src/mail/mail.transport';
import { bearer, createTestApp, login } from './setup';

/**
 * Письма-приглашения.
 *
 * Доставка подменена на память: проверяется, что именно уходит
 * получателю и что сбой почты не ломает выдачу ссылки.
 */
describe('Почта: приглашения', () => {
  let app: INestApplication;
  let adminToken: string;
  const outbox: MailMessage[] = [];
  let failing = false;

  const transport = {
    enabled: true,
    send: (message: MailMessage) => {
      if (failing) {
        return Promise.reject(new Error('smtp down'));
      }
      outbox.push(message);
      return Promise.resolve();
    },
  };

  const invite = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/organizations/current/invitations')
      .set('Authorization', bearer(adminToken))
      .send(body);

  beforeAll(async () => {
    app = await createTestApp([
      { provide: MAIL_TRANSPORT, useValue: transport },
    ]);
    adminToken = await login(app, 'admin', 'admin123');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    outbox.length = 0;
    failing = false;
  });

  it('отправляет письмо со ссылкой на указанный адрес', async () => {
    const response = await invite({
      role: 'manager',
      email: 'Novyj.Sotrudnik@Example.com',
    }).expect(201);

    expect(response.body.emailed).toBe(true);
    expect(outbox).toHaveLength(1);
    const [mail] = outbox;
    expect(mail.to).toBe('novyj.sotrudnik@example.com');
    expect(mail.text).toContain(`/invite?token=${response.body.token}`);
    expect(mail.html).toContain(`/invite?token=${response.body.token}`);
    expect(mail.subject).toContain('Приглашение');
  });

  it('не отправляет письмо без адреса, но выдаёт ссылку', async () => {
    const response = await invite({ role: 'manager' }).expect(201);
    expect(response.body.emailed).toBe(false);
    expect(response.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(outbox).toHaveLength(0);
  });

  it('сбой почты не ломает приглашение', async () => {
    failing = true;
    const response = await invite({
      role: 'manager',
      email: 'a@example.com',
    }).expect(201);
    expect(response.body.emailed).toBe(false);
    expect(response.body.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('отклоняет некорректный адрес', async () => {
    await invite({ role: 'manager', email: 'не-адрес' }).expect(400);
  });

  it('экранирует название организации в HTML', async () => {
    const organizationName = `<img src=x onerror=alert(1)>`;
    const current = await request(app.getHttpServer())
      .get('/api/organizations/current')
      .set('Authorization', bearer(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/organizations/current')
      .set('Authorization', bearer(adminToken))
      .send({ name: organizationName })
      .expect(200);
    try {
      await invite({ role: 'manager', email: 'b@example.com' }).expect(201);
      expect(outbox[0].html).not.toContain('<img src=x');
      expect(outbox[0].html).toContain('&lt;img');
    } finally {
      await request(app.getHttpServer())
        .patch('/api/organizations/current')
        .set('Authorization', bearer(adminToken))
        .send({ name: current.body.name });
    }
  });
});
