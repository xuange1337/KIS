import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

/**
 * Смена и восстановление пароля.
 *
 * Восстановления не было вовсе: забывший пароль сотрудник получал новый
 * от администратора голосом или в переписке — пароль знали двое.
 */
describe('Пароль пользователя', () => {
  let app: INestApplication;
  let adminToken: string;
  let userId: number;
  const login0 = `reset-check-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await login(app, 'admin', 'admin123');

    const created = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', bearer(adminToken))
      .send({
        login: login0,
        password: 'pervyy-parol',
        fullName: 'Проверка пароля',
        role: 'manager',
      })
      .expect(201);
    userId = created.body.userId;
  });

  afterAll(async () => {
    await request(app.getHttpServer())
      .delete(`/api/users/${userId}`)
      .set('Authorization', bearer(adminToken));
    await app.close();
  });

  it('меняет собственный пароль и закрывает прочие сессии', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'pervyy-parol' })
      .expect(200);
    const second = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'pervyy-parol' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/password')
      .set('Authorization', bearer(second.body.accessToken))
      .send({ currentPassword: 'pervyy-parol', newPassword: 'vtoroy-parol' })
      .expect(204);

    // Пароль меняют в том числе потому, что подозревают чужой доступ:
    // прежние входы закрываются
    await request(app.getHttpServer())
      .get('/api/clients')
      .set('Authorization', bearer(first.body.accessToken))
      .expect(401);
    // Текущая сессия продолжает работать: иначе смена пароля
    // выбрасывала бы пользователя из системы
    await request(app.getHttpServer())
      .get('/api/clients')
      .set('Authorization', bearer(second.body.accessToken))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'vtoroy-parol' })
      .expect(200);
  });

  it('требует верный текущий пароль', async () => {
    const session = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'vtoroy-parol' })
      .expect(200);

    // У оставленного без присмотра компьютера смена пароля — это
    // захват учётной записи
    await request(app.getHttpServer())
      .post('/api/auth/password')
      .set('Authorization', bearer(session.body.accessToken))
      .send({ currentPassword: 'ne-tot-parol', newPassword: 'tretiy-parol' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/password')
      .set('Authorization', bearer(session.body.accessToken))
      .send({ currentPassword: 'vtoroy-parol', newPassword: 'vtoroy-parol' })
      .expect(400);
  });

  it('восстанавливает доступ по одноразовой ссылке', async () => {
    const issued = await request(app.getHttpServer())
      .post(`/api/users/${userId}/password-reset`)
      .set('Authorization', bearer(adminToken))
      .expect(201);

    expect(issued.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(issued.body.expiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    );

    await request(app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token: issued.body.token, newPassword: 'parol-po-ssylke' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'parol-po-ssylke' })
      .expect(200);

    // Ссылка одноразовая: второй переход по ней ничего не меняет
    await request(app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token: issued.body.token, newPassword: 'eshchyo-odin-parol' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: login0, password: 'eshchyo-odin-parol' })
      .expect(401);
  });

  it('гасит прежнюю ссылку при выдаче новой', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/users/${userId}/password-reset`)
      .set('Authorization', bearer(adminToken))
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/users/${userId}/password-reset`)
      .set('Authorization', bearer(adminToken))
      .expect(201);

    // Иначе у одной учётной записи копились бы действующие входы
    await request(app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token: first.body.token, newPassword: 'staraya-ssylka' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token: second.body.token, newPassword: 'novaya-ssylka' })
      .expect(204);
  });

  it('отклоняет выдуманный токен и короткий пароль', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token: 'f'.repeat(64), newPassword: 'dostatochno-dlinnyy' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token: 'f'.repeat(64), newPassword: '123' })
      .expect(400);
  });

  it('не даёт выдать ссылку менеджеру и сотруднику чужой организации', async () => {
    const managerToken = await login(app, 'manager', 'manager123');
    await request(app.getHttpServer())
      .post(`/api/users/${userId}/password-reset`)
      .set('Authorization', bearer(managerToken))
      .expect(403);

    const otherAdminToken = await login(app, 'other-admin', 'other123');
    await request(app.getHttpServer())
      .post(`/api/users/${userId}/password-reset`)
      .set('Authorization', bearer(otherAdminToken))
      .expect(404);
  });
});
