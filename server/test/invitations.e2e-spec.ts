import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createTestApp, login } from './setup';

/**
 * Приглашения в организацию.
 *
 * Единственным способом завести сотрудника было придумать ему пароль и
 * продиктовать — пароль знали двое. По приглашению человек заводит
 * себя сам, администратор задаёт только роль.
 */
describe('Приглашения в организацию', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let managerToken: string;
  const createdLogins: string[] = [];

  const invite = (role = 'manager', fullName?: string) =>
    request(app.getHttpServer())
      .post('/api/organizations/current/invitations')
      .set('Authorization', bearer(adminToken))
      .send({ role, fullName });

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin', 'admin123');
    managerToken = await login(app, 'manager', 'manager123');
  });

  afterAll(async () => {
    for (const userLogin of createdLogins) {
      await dataSource.query(`DELETE FROM users WHERE login = $1`, [userLogin]);
    }
    await app.close();
  });

  it('показывает организацию и роль до принятия', async () => {
    const issued = await invite('head', 'Новый Руководитель').expect(201);
    expect(issued.body.token).toMatch(/^[0-9a-f]{64}$/);

    // Приглашённого в системе ещё нет: маршрут открытый
    const preview = await request(app.getHttpServer())
      .get(`/api/invitations?token=${issued.body.token}`)
      .expect(200);

    expect(preview.body.organizationName).toBeTruthy();
    expect(preview.body.role).toBe('head');
    expect(preview.body.fullName).toBe('Новый Руководитель');
  });

  it('заводит учётную запись и участие по ссылке', async () => {
    const issued = await invite('manager').expect(201);
    const userLogin = `invited-${Date.now().toString().slice(-6)}`;
    createdLogins.push(userLogin);

    await request(app.getHttpServer())
      .post('/api/invitations/accept')
      .send({
        token: issued.body.token,
        login: userLogin,
        password: 'parol-priglashyonnogo',
        fullName: 'Приглашённый Сотрудник',
      })
      .expect(200);

    // Человек заводит себя сам: администратор его пароля не знает
    const session = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: userLogin, password: 'parol-priglashyonnogo' })
      .expect(200);
    expect(session.body.user.role).toBe('manager');
    expect(session.body.organizations).toHaveLength(1);

    // И сразу видит данные организации
    await request(app.getHttpServer())
      .get('/api/clients')
      .set('Authorization', bearer(session.body.accessToken))
      .expect(200);
  });

  it('ссылка срабатывает один раз', async () => {
    const issued = await invite().expect(201);
    const first = `invited-once-${Date.now().toString().slice(-6)}`;
    createdLogins.push(first);

    await request(app.getHttpServer())
      .post('/api/invitations/accept')
      .send({
        token: issued.body.token,
        login: first,
        password: 'parol-pervogo',
        fullName: 'Первый Приглашённый',
      })
      .expect(200);

    // Иначе одна ссылка завела бы сколько угодно сотрудников
    await request(app.getHttpServer())
      .post('/api/invitations/accept')
      .send({
        token: issued.body.token,
        login: `${first}-2`,
        password: 'parol-vtorogo',
        fullName: 'Второй Приглашённый',
      })
      .expect(400);
  });

  it('присоединяет к организации уже работающего в системе', async () => {
    // Так партнёр получает доступ ко второму заказчику
    const otherAdminToken = await login(app, 'other-admin', 'other123');
    const issued = await request(app.getHttpServer())
      .post('/api/organizations/current/invitations')
      .set('Authorization', bearer(otherAdminToken))
      .send({ role: 'head' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/invitations/join')
      .set('Authorization', bearer(managerToken))
      .send({ token: issued.body.token })
      .expect(200);

    const organizations = await request(app.getHttpServer())
      .get('/api/auth/organizations')
      .set('Authorization', bearer(managerToken))
      .expect(200);
    expect(organizations.body).toHaveLength(2);

    // Роль в новой организации — та, что указана в приглашении
    const theirs = organizations.body.find(
      (item: { role: string }) => item.role === 'head',
    );
    expect(theirs).toBeDefined();

    await dataSource.query(
      `DELETE FROM organization_members
        WHERE user_id = (SELECT user_id FROM users WHERE login = 'manager')
          AND organization_id = $1`,
      [theirs.organizationId],
    );
  });

  it('отклоняет занятый логин и просроченную ссылку', async () => {
    const issued = await invite().expect(201);
    await request(app.getHttpServer())
      .post('/api/invitations/accept')
      .send({
        token: issued.body.token,
        login: 'manager',
        password: 'parol-dublya',
        fullName: 'Дубль Логина',
      })
      .expect(409);

    const expired = await invite().expect(201);
    await dataSource
      .query(
        `UPDATE organization_invitations SET expires_at = now() - interval '1 day'
        WHERE token_hash = encode(digest($1, 'sha256'), 'hex')`,
        [expired.body.token],
      )
      .catch(async () => {
        // pgcrypto может быть не установлен: гасим по последнему приглашению
        await dataSource.query(
          `UPDATE organization_invitations SET expires_at = now() - interval '1 day'
          WHERE invitation_id = (SELECT max(invitation_id) FROM organization_invitations)`,
        );
      });

    await request(app.getHttpServer())
      .post('/api/invitations/accept')
      .send({
        token: expired.body.token,
        login: `expired-${Date.now().toString().slice(-6)}`,
        password: 'parol-prosrochki',
        fullName: 'Просроченное Приглашение',
      })
      .expect(400);
  });

  it('приглашать может только администратор', async () => {
    await request(app.getHttpServer())
      .post('/api/organizations/current/invitations')
      .set('Authorization', bearer(managerToken))
      .send({ role: 'admin' })
      .expect(403);
  });

  it('отзывает невостребованное приглашение', async () => {
    const issued = await invite().expect(201);
    const list = await request(app.getHttpServer())
      .get('/api/organizations/current/invitations')
      .set('Authorization', bearer(adminToken))
      .expect(200);
    const latest = list.body[0];

    await request(app.getHttpServer())
      .delete(`/api/organizations/current/invitations/${latest.invitationId}`)
      .set('Authorization', bearer(adminToken))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/invitations?token=${issued.body.token}`)
      .expect(400);
  });

  it('переименовывает организацию и считает сотрудников', async () => {
    const current = await request(app.getHttpServer())
      .get('/api/organizations/current')
      .set('Authorization', bearer(adminToken))
      .expect(200);
    expect(current.body.memberCount).toBeGreaterThan(0);

    const renamed = await request(app.getHttpServer())
      .patch('/api/organizations/current')
      .set('Authorization', bearer(adminToken))
      .send({ name: 'ООО «Переименованная»' })
      .expect(200);
    expect(renamed.body.name).toBe('ООО «Переименованная»');

    // Менеджеру переименование недоступно
    await request(app.getHttpServer())
      .patch('/api/organizations/current')
      .set('Authorization', bearer(managerToken))
      .send({ name: 'ООО «Самовольная»' })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/organizations/current')
      .set('Authorization', bearer(adminToken))
      .send({ name: current.body.name })
      .expect(200);
  });
});
