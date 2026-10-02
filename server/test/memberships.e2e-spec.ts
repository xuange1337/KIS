import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createTestApp, login } from './setup';

/**
 * Работа в нескольких организациях.
 *
 * Пока роль лежала в учётной записи, человек мог состоять ровно в одной
 * организации, а «роль» означала «роль везде». Этот набор проверяет,
 * что теперь роль действует в пределах организации и переключение
 * между ними не открывает чужих данных.
 */
describe('Участие в организациях', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let ownOrganizationId: number;
  let otherOrganizationId: number;
  const login0 = `member-${Date.now().toString().slice(-6)}`;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin', 'admin123');

    const [own] = await dataSource.query(
      `SELECT organization_id AS id FROM organizations WHERE name LIKE 'ООО%'`,
    );
    const [other] = await dataSource.query(
      `SELECT organization_id AS id FROM organizations WHERE name LIKE 'ЗАО%'`,
    );
    ownOrganizationId = own.id;
    otherOrganizationId = other.id;

    // Сотрудник заводится в первой организации обычным порядком
    const created = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', bearer(adminToken))
      .send({
        login: login0,
        password: 'parol-uchastnika',
        fullName: 'Участник Двух Организаций',
        role: 'manager',
      })
      .expect(201);
    userId = created.body.userId;

    // Во второй — администратором: именно так выглядит партнёр,
    // который ведёт несколько заказчиков
    await dataSource.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [otherOrganizationId, userId],
    );
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE user_id = $1`, [userId]);
    await app.close();
  });

  it('входит в первую организацию и видит обе в списке', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'parol-uchastnika' })
      .expect(200);

    expect(response.body.organization.organizationId).toBe(ownOrganizationId);
    expect(response.body.organization.role).toBe('manager');
    expect(response.body.organizations).toHaveLength(2);
    expect(response.body.user.role).toBe('manager');
  });

  it('в разных организациях действует разная роль', async () => {
    const session = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'parol-uchastnika' })
      .expect(200);

    // В первой он менеджер: управление пользователями закрыто
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', bearer(session.body.accessToken))
      .expect(403);

    const switched = await request(app.getHttpServer())
      .post(`/api/auth/organizations/${otherOrganizationId}/activate`)
      .set('Authorization', bearer(session.body.accessToken))
      .expect(200);

    expect(switched.body.organization.organizationId).toBe(otherOrganizationId);
    expect(switched.body.organization.role).toBe('admin');

    // Во второй он администратор — и управление открыто
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', bearer(switched.body.accessToken))
      .expect(200);
  });

  it('после переключения видны данные новой организации, а не прежней', async () => {
    const session = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'parol-uchastnika' })
      .expect(200);
    const switched = await request(app.getHttpServer())
      .post(`/api/auth/organizations/${otherOrganizationId}/activate`)
      .set('Authorization', bearer(session.body.accessToken))
      .expect(200);

    const clients = await request(app.getHttpServer())
      .get('/api/clients?limit=200')
      .set('Authorization', bearer(switched.body.accessToken))
      .expect(200);

    // В контрольной организации ровно один клиент
    expect(clients.body.items).toHaveLength(1);
    expect(clients.body.items[0].name).toContain('Соседний');
  });

  it('прежний сеанс остаётся в прежней организации', async () => {
    const session = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'parol-uchastnika' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/auth/organizations/${otherOrganizationId}/activate`)
      .set('Authorization', bearer(session.body.accessToken))
      .expect(200);

    // Переключение открывает новый сеанс, а не правит текущий: в
    // соседней вкладке работа с прежним заказчиком продолжается
    const profile = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(session.body.accessToken))
      .expect(200);
    expect(profile.body.role).toBe('manager');
  });

  it('не переключает в организацию, где нет участия', async () => {
    const managerToken = await login(app, 'manager', 'manager123');
    await request(app.getHttpServer())
      .post(`/api/auth/organizations/${otherOrganizationId}/activate`)
      .set('Authorization', bearer(managerToken))
      .expect(401);
  });

  it('отзыв участия закрывает доступ по уже выданному токену', async () => {
    const session = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'parol-uchastnika' })
      .expect(200);
    const switched = await request(app.getHttpServer())
      .post(`/api/auth/organizations/${otherOrganizationId}/activate`)
      .set('Authorization', bearer(session.body.accessToken))
      .expect(200);

    await dataSource.query(
      `DELETE FROM organization_members WHERE user_id = $1 AND organization_id = $2`,
      [userId, otherOrganizationId],
    );

    // Токен живёт до пятнадцати минут; доверять записанной в нём роли
    // значит оставить доступ выведенному из организации сотруднику
    await request(app.getHttpServer())
      .get('/api/clients')
      .set('Authorization', bearer(switched.body.accessToken))
      .expect(401);

    await dataSource.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [otherOrganizationId, userId],
    );
  });

  it('не пускает учётную запись без единого участия', async () => {
    await dataSource.query(
      `DELETE FROM organization_members WHERE user_id = $1`,
      [userId],
    );

    // Учётная запись есть, а работать не с чем
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'parol-uchastnika' })
      .expect(401);

    await dataSource.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'manager')`,
      [ownOrganizationId, userId],
    );
  });
});
