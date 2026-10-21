import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ClosureService } from '../src/organizations/closure.service';
import { bearer, createTestApp, login } from './setup';

/**
 * Состав организации (роли, исключение, выход, владение) и закрытие
 * организации с выгрузкой данных и удалением по сроку.
 */
describe('Состав и закрытие организации', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const suffix = Date.now().toString().slice(-7);
  const logins: string[] = [];
  const orgNames: string[] = [];
  let counter = 0;
  const PASSWORD = 'parol-organizacii';

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: bearer(token) });

  /** Новая организация с владельцем; возвращает токен и данные. */
  const newOrganization = async () => {
    counter += 1;
    const loginName = `own-${suffix}-${counter}`;
    const name = `Состав ${suffix}-${counter}`;
    const response = await http()
      .post('/api/auth/register')
      .send({
        organizationName: name,
        fullName: 'Владелец Организации',
        login: loginName,
        email: `${loginName}@example.com`,
        password: PASSWORD,
        acceptTerms: true,
      })
      .expect(201);
    logins.push(loginName);
    orgNames.push(name);
    return {
      name,
      token: response.body.accessToken as string,
      userId: response.body.user.userId as number,
      organizationId: response.body.organization.organizationId as number,
    };
  };

  /** Сотрудник, заведённый администратором; возвращает его токен. */
  const addMember = async (ownerToken: string, role: string) => {
    counter += 1;
    const loginName = `mem-${suffix}-${counter}`;
    const created = await http()
      .post('/api/users')
      .set(auth(ownerToken))
      .send({
        login: loginName,
        password: PASSWORD,
        fullName: `Сотрудник ${counter}`,
        role,
      })
      .expect(201);
    logins.push(loginName);
    return {
      userId: created.body.userId as number,
      token: await login(app, loginName, PASSWORD),
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    const rows = await dataSource.query(
      `SELECT organization_id FROM organizations WHERE name = ANY($1)`,
      [orgNames],
    );
    const ids = rows.map((r: { organization_id: number }) => r.organization_id);
    await dataSource.query(
      `DELETE FROM audit_log WHERE organization_id = ANY($1)`,
      [ids],
    );
    await dataSource.query(
      `DELETE FROM clients WHERE organization_id = ANY($1)`,
      [ids],
    );
    await dataSource.query(`DELETE FROM users WHERE login = ANY($1)`, [logins]);
    await dataSource.query(
      `DELETE FROM organizations WHERE organization_id = ANY($1)`,
      [ids],
    );
    await app.close();
  });

  describe('участники', () => {
    it('список показывает владельца; менеджеру недоступен', async () => {
      const org = await newOrganization();
      const manager = await addMember(org.token, 'manager');

      const list = await http()
        .get('/api/organizations/current/members')
        .set(auth(org.token))
        .expect(200);
      expect(list.body).toHaveLength(2);
      const owner = list.body.find(
        (m: { userId: number }) => m.userId === org.userId,
      );
      expect(owner).toMatchObject({ isOwner: true, role: 'admin' });
      expect(owner.email).toContain('@example.com');

      await http()
        .get('/api/organizations/current/members')
        .set(auth(manager.token))
        .expect(403);
    });

    it('меняет роль, но не понижает владельца и себя', async () => {
      const org = await newOrganization();
      const member = await addMember(org.token, 'manager');

      await http()
        .patch(`/api/organizations/current/members/${member.userId}`)
        .set(auth(org.token))
        .send({ role: 'head' })
        .expect(204);
      const list = await http()
        .get('/api/organizations/current/members')
        .set(auth(org.token));
      expect(
        list.body.find((m: { userId: number }) => m.userId === member.userId)
          .role,
      ).toBe('head');

      // Владелец остаётся администратором
      await http()
        .patch(`/api/organizations/current/members/${org.userId}`)
        .set(auth(org.token))
        .send({ role: 'manager' })
        .expect(409);

      // Второй администратор не снимает права с самого себя
      const second = await addMember(org.token, 'admin');
      await http()
        .patch(`/api/organizations/current/members/${second.userId}`)
        .set(auth(second.token))
        .send({ role: 'manager' })
        .expect(400);
    });

    it('исключает участника и сразу закрывает его сеансы', async () => {
      const org = await newOrganization();
      const member = await addMember(org.token, 'manager');
      await http().get('/api/clients').set(auth(member.token)).expect(200);

      await http()
        .delete(`/api/organizations/current/members/${member.userId}`)
        .set(auth(org.token))
        .expect(204);

      await http().get('/api/clients').set(auth(member.token)).expect(401);
      // Учётная запись сохранилась, но организаций у неё нет
      await http()
        .post('/api/auth/login')
        .send({ login: `mem-${suffix}-${counter}`, password: PASSWORD })
        .expect(401);
    });

    it('не исключает владельца и самого себя, чужих не видит', async () => {
      const org = await newOrganization();
      const other = await newOrganization();
      const second = await addMember(org.token, 'admin');

      await http()
        .delete(`/api/organizations/current/members/${org.userId}`)
        .set(auth(second.token))
        .expect(409);
      await http()
        .delete(`/api/organizations/current/members/${second.userId}`)
        .set(auth(second.token))
        .expect(400);
      await http()
        .delete(`/api/organizations/current/members/${other.userId}`)
        .set(auth(org.token))
        .expect(404);
    });

    it('участник выходит сам, владелец — нет', async () => {
      const org = await newOrganization();
      const member = await addMember(org.token, 'manager');

      await http()
        .post('/api/organizations/current/leave')
        .set(auth(org.token))
        .expect(409);
      await http()
        .post('/api/organizations/current/leave')
        .set(auth(member.token))
        .expect(204);
      await http().get('/api/clients').set(auth(member.token)).expect(401);
    });
  });

  describe('передача владения', () => {
    it('требует пароль и права владельца', async () => {
      const org = await newOrganization();
      const second = await addMember(org.token, 'admin');

      await http()
        .post('/api/organizations/current/transfer-ownership')
        .set(auth(org.token))
        .send({ userId: second.userId, password: 'неверный' })
        .expect(403);
      await http()
        .post('/api/organizations/current/transfer-ownership')
        .set(auth(second.token))
        .send({ userId: second.userId, password: PASSWORD })
        .expect(403);
    });

    it('передаёт владение, после чего бывший владелец может выйти', async () => {
      const org = await newOrganization();
      const member = await addMember(org.token, 'manager');

      await http()
        .post('/api/organizations/current/transfer-ownership')
        .set(auth(org.token))
        .send({ userId: member.userId, password: PASSWORD })
        .expect(204);

      const list = await http()
        .get('/api/organizations/current/members')
        .set(auth(org.token))
        .expect(200);
      const newOwner = list.body.find(
        (m: { userId: number }) => m.userId === member.userId,
      );
      // Новый владелец становится администратором
      expect(newOwner).toMatchObject({ isOwner: true, role: 'admin' });

      await http()
        .post('/api/organizations/current/leave')
        .set(auth(org.token))
        .expect(204);
    });
  });

  describe('закрытие организации', () => {
    const seedClient = (token: string, name: string) =>
      http().post('/api/clients').set(auth(token)).send({
        name,
        status: 'lead',
        source: 'website',
        preferredChannel: 'email',
      });

    it('выгружает данные организации и только их', async () => {
      const org = await newOrganization();
      const other = await newOrganization();
      await seedClient(org.token, 'Клиент выгрузки').expect(201);
      await seedClient(other.token, 'Чужой клиент').expect(201);
      const manager = await addMember(org.token, 'manager');

      const response = await http()
        .get('/api/organizations/current/export')
        .set(auth(org.token))
        .expect(200);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body.organization.name).toBe(org.name);
      const names = response.body.clients.map((c: { name: string }) => c.name);
      expect(names).toEqual(['Клиент выгрузки']);
      expect(JSON.stringify(response.body)).not.toContain('password');
      expect(response.body.members).toHaveLength(2);

      await http()
        .get('/api/organizations/current/export')
        .set(auth(manager.token))
        .expect(403);
    });

    it('требует владельца, пароль и точное название', async () => {
      const org = await newOrganization();
      const second = await addMember(org.token, 'admin');
      const close = (
        token: string,
        body: { password: string; confirmName: string },
      ) =>
        http()
          .post('/api/organizations/current/close')
          .set(auth(token))
          .send(body);

      await close(second.token, {
        password: PASSWORD,
        confirmName: org.name,
      }).expect(403);
      await close(org.token, {
        password: 'неверный',
        confirmName: org.name,
      }).expect(403);
      await close(org.token, {
        password: PASSWORD,
        confirmName: 'Другое название',
      }).expect(400);

      const current = await http()
        .get('/api/organizations/current')
        .set(auth(org.token));
      expect(current.body.status).toBe('trial');
    });

    it('закрывает запись, сохраняет чтение и выгрузку, возвращается', async () => {
      const org = await newOrganization();
      await seedClient(org.token, 'Остаётся').expect(201);

      await http()
        .post('/api/organizations/current/close')
        .set(auth(org.token))
        .send({ password: PASSWORD, confirmName: org.name })
        .expect(204);

      const closed = await http()
        .get('/api/organizations/current')
        .set(auth(org.token))
        .expect(200);
      expect(closed.body.status).toBe('closed');
      expect(new Date(closed.body.purgeAt).getTime()).toBeGreaterThan(
        Date.now() + 29 * 86_400_000,
      );

      const blocked = await seedClient(org.token, 'Новый').expect(402);
      expect(blocked.body.code).toBe('ORGANIZATION_SUSPENDED');
      await http().get('/api/clients').set(auth(org.token)).expect(200);
      await http()
        .get('/api/organizations/current/export')
        .set(auth(org.token))
        .expect(200);
      // Повторно закрыть нельзя
      await http()
        .post('/api/organizations/current/close')
        .set(auth(org.token))
        .send({ password: PASSWORD, confirmName: org.name })
        .expect(402);

      await http()
        .post('/api/organizations/current/reopen')
        .set(auth(org.token))
        .expect(204);
      const reopened = await http()
        .get('/api/organizations/current')
        .set(auth(org.token));
      expect(reopened.body.status).toBe('trial');
      expect(reopened.body.closedAt).toBeNull();
      await seedClient(org.token, 'После возврата').expect(201);

      await http()
        .post('/api/organizations/current/reopen')
        .set(auth(org.token))
        .expect(409);
    });

    it('удаляет организацию по истечении срока, не трогая соседние', async () => {
      const doomed = await newOrganization();
      const member = await addMember(doomed.token, 'manager');
      const survivor = await newOrganization();
      await seedClient(doomed.token, 'Удалится').expect(201);
      await seedClient(survivor.token, 'Останется').expect(201);

      await http()
        .post('/api/organizations/current/close')
        .set(auth(doomed.token))
        .send({ password: PASSWORD, confirmName: doomed.name })
        .expect(204);

      const closure = app.get(ClosureService);
      // Срок ещё не вышел
      expect(await closure.purgeClosed()).toBe(0);

      await dataSource.query(
        `UPDATE organizations SET closed_at = now() - interval '31 days'
          WHERE organization_id = $1`,
        [doomed.organizationId],
      );
      expect(await closure.purgeClosed()).toBe(1);

      const gone = await dataSource.query(
        `SELECT
           (SELECT count(*) FROM organizations WHERE organization_id = $1) AS orgs,
           (SELECT count(*) FROM clients WHERE organization_id = $1) AS clients,
           (SELECT count(*) FROM users WHERE user_id = ANY($2)) AS users`,
        [doomed.organizationId, [doomed.userId, member.userId]],
      );
      expect(gone[0]).toEqual({ orgs: '0', clients: '0', users: '0' });

      const kept = await http()
        .get('/api/clients')
        .set(auth(survivor.token))
        .expect(200);
      expect(kept.body.total).toBe(1);
    });
  });
});
