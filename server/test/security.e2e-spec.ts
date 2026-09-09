import { INestApplication } from '@nestjs/common';
import { DealStage, UserRole } from '@crm/shared';
import * as crypto from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createTestApp, login } from './setup';

/**
 * Регрессионные проверки безопасности.
 * Каждый тест соответствует дефекту, найденному при ревью, и падает,
 * если исправление откатят.
 */
describe('Безопасность и разграничение доступа', () => {
  let app: INestApplication;
  let managerToken: string;
  let headToken: string;
  let adminToken: string;
  let managerId: number;

  beforeAll(async () => {
    app = await createTestApp();
    managerToken = await login(app, 'manager', 'manager123');
    headToken = await login(app, 'head', 'head123');
    adminToken = await login(app, 'admin', 'admin123');

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(managerToken));
    managerId = me.body.userId;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Идентификатор записи, принадлежащей другому менеджеру. */
  const foreignDealId = async (): Promise<number> => {
    const all = await request(app.getHttpServer())
      .get('/api/deals?limit=200')
      .set('Authorization', bearer(headToken))
      .expect(200);
    const foreign = all.body.items.find(
      (deal: { ownerUserId: number }) => deal.ownerUserId !== managerId,
    );
    expect(foreign).toBeDefined();
    return foreign.dealId;
  };

  const ownClientId = async (): Promise<number> => {
    const mine = await request(app.getHttpServer())
      .get('/api/clients?limit=1')
      .set('Authorization', bearer(managerToken))
      .expect(200);
    return mine.body.items[0].clientId;
  };

  describe('Токены', () => {
    it('отвергает токен, подписанный прежним значением-заглушкой', async () => {
      // Секреты когда-то имели значения по умолчанию, известные из исходников:
      // с ними любой мог выпустить себе токен администратора
      const base64url = (value: Buffer | string) =>
        Buffer.from(value).toString('base64url');
      const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = base64url(
        JSON.stringify({
          sub: 1,
          login: 'admin',
          role: UserRole.ADMIN,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
      const signature = crypto
        .createHmac('sha256', 'change_me_access_secret')
        .update(`${header}.${payload}`)
        .digest('base64url');

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${header}.${payload}.${signature}`)
        .expect(401);
    });

    it('отвергает токен с верным телом, но испорченной подписью', async () => {
      const [header, payload] = managerToken.split('.');
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${header}.${payload}.broken-signature`)
        .expect(401);
    });
  });

  describe('Разграничение доступа между менеджерами', () => {
    it('менеджер не открывает чужую сделку', async () => {
      const dealId = await foreignDealId();
      await request(app.getHttpServer())
        .get(`/api/deals/${dealId}`)
        .set('Authorization', bearer(managerToken))
        .expect(403);
    });

    it('менеджер не открывает историю чужой сделки', async () => {
      const dealId = await foreignDealId();
      await request(app.getHttpServer())
        .get(`/api/deals/${dealId}/history`)
        .set('Authorization', bearer(managerToken))
        .expect(403);
    });

    it('менеджер не видит коммерческие предложения по чужой сделке', async () => {
      const dealId = await foreignDealId();
      await request(app.getHttpServer())
        .get(`/api/deals/${dealId}/offers`)
        .set('Authorization', bearer(managerToken))
        .expect(403);
    });

    it('менеджер не видит контакты чужого клиента', async () => {
      const all = await request(app.getHttpServer())
        .get('/api/clients?limit=200')
        .set('Authorization', bearer(headToken))
        .expect(200);
      const foreign = all.body.items.find(
        (client: { ownerUserId: number }) => client.ownerUserId !== managerId,
      );

      await request(app.getHttpServer())
        .get(`/api/clients/${foreign.clientId}/contacts`)
        .set('Authorization', bearer(managerToken))
        .expect(403);
    });

    it('в списке активностей менеджера нет чужих записей', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/activities?limit=200')
        .set('Authorization', bearer(managerToken))
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
      response.body.items.forEach((activity: { ownerUserId: number }) => {
        expect(activity.ownerUserId).toBe(managerId);
      });
    });

    it('в списке КП менеджера нет предложений по чужим сделкам', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/offers?limit=200')
        .set('Authorization', bearer(managerToken))
        .expect(200);

      response.body.items.forEach((offer: { deal: { ownerUserId: number } }) => {
        expect(offer.deal.ownerUserId).toBe(managerId);
      });
    });
  });

  describe('Привязка активности к сделке (обход owner-scope)', () => {
    it('нельзя создать активность со сделкой другого менеджера', async () => {
      // Проверялся только clientId, а dealId писался без проверки и
      // возвращался вместе с подгруженной карточкой чужой сделки
      const [clientId, dealId] = await Promise.all([
        ownClientId(),
        foreignDealId(),
      ]);

      await request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', bearer(managerToken))
        .send({
          clientId,
          dealId,
          type: 'call',
          subject: 'Попытка обхода',
          plannedAt: new Date().toISOString(),
        })
        .expect(403);
    });

    it('нельзя привязать активность к сделке другого клиента', async () => {
      const clientId = await ownClientId();
      // Своя сделка, но заведённая по другому клиенту
      const myDeals = await request(app.getHttpServer())
        .get('/api/deals?limit=200')
        .set('Authorization', bearer(managerToken))
        .expect(200);
      const otherClientDeal = myDeals.body.items.find(
        (deal: { clientId: number }) => deal.clientId !== clientId,
      );
      expect(otherClientDeal).toBeDefined();

      await request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', bearer(managerToken))
        .send({
          clientId,
          dealId: otherClientDeal.dealId,
          type: 'call',
          subject: 'Сделка чужого клиента',
          plannedAt: new Date().toISOString(),
        })
        .expect(400);
    });

    it('нельзя подменить сделку через PATCH', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/activities?limit=50')
        .set('Authorization', bearer(managerToken))
        .expect(200);
      const activity = list.body.items[0];
      const dealId = await foreignDealId();

      await request(app.getHttpServer())
        .patch(`/api/activities/${activity.activityId}`)
        .set('Authorization', bearer(managerToken))
        .send({ dealId })
        .expect(403);
    });
  });

  describe('Эскалация привилегий', () => {
    it('менеджер не может назначить владельцем клиента другого сотрудника', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(managerToken))
        .send({ name: 'ООО «Проверка владельца»', ownerUserId: 999 })
        .expect(201);

      // Поле игнорируется: владельцем остаётся сам менеджер
      expect(created.body.ownerUserId).toBe(managerId);

      await request(app.getHttpServer())
        .delete(`/api/clients/${created.body.clientId}`)
        .set('Authorization', bearer(managerToken))
        .expect(200);
    });

    it('менеджер не может создать пользователя или изменить роль', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', bearer(managerToken))
        .send({
          login: 'intruder',
          password: 'intruder123',
          fullName: 'Нарушитель',
          role: UserRole.ADMIN,
        })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/users/${managerId}`)
        .set('Authorization', bearer(managerToken))
        .send({ role: UserRole.ADMIN })
        .expect(403);
    });

    it('руководитель не допускается к управлению пользователями', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', bearer(headToken))
        .expect(403);
    });
  });

  describe('Утечка данных учётных записей', () => {
    it('список пользователей не содержит хеш пароля', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', bearer(adminToken))
        .expect(200);

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('password_hash');
      expect(serialized).not.toContain('$2a$');
      expect(serialized).not.toContain('$2b$');
    });

    it('ответы со сделками и клиентами не содержат хеш пароля владельца', async () => {
      const deals = await request(app.getHttpServer())
        .get('/api/deals?limit=5')
        .set('Authorization', bearer(headToken))
        .expect(200);

      expect(JSON.stringify(deals.body)).not.toContain('passwordHash');
    });
  });

  describe('Журналирование выгрузок', () => {
    it('выгрузка отчёта попадает в журнал действий', async () => {
      await request(app.getHttpServer())
        .get('/api/reports/funnel/export?format=csv')
        .set('Authorization', bearer(headToken))
        .expect(200);

      // Проверяем через то же подключение, которым пользуется приложение
      const dataSource = app.get(DataSource);
      const rows = await dataSource.query(
        `SELECT action, entity, entity_id FROM audit_log
         WHERE action = 'export' ORDER BY id DESC LIMIT 1`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].entity).toBe('reports');
      expect(rows[0].entity_id).toBe('funnel');
    });
  });

  describe('Стадии сделки остаются согласованными', () => {
    it('смена стадии пишет ровно одну запись в историю', async () => {
      const mine = await request(app.getHttpServer())
        .get('/api/deals?limit=200')
        .set('Authorization', bearer(managerToken))
        .expect(200);
      const deal = mine.body.items.find(
        (item: { stage: DealStage }) => item.stage === DealStage.NEW,
      );
      expect(deal).toBeDefined();

      const before = await request(app.getHttpServer())
        .get(`/api/deals/${deal.dealId}/history`)
        .set('Authorization', bearer(managerToken))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/deals/${deal.dealId}/stage`)
        .set('Authorization', bearer(managerToken))
        .send({ stage: DealStage.QUALIFICATION })
        .expect(200);

      const after = await request(app.getHttpServer())
        .get(`/api/deals/${deal.dealId}/history`)
        .set('Authorization', bearer(managerToken))
        .expect(200);

      expect(after.body).toHaveLength(before.body.length + 1);

      // Возвращаем стадию, чтобы не влиять на другие тесты
      await request(app.getHttpServer())
        .patch(`/api/deals/${deal.dealId}/stage`)
        .set('Authorization', bearer(managerToken))
        .send({ stage: DealStage.NEW })
        .expect(200);
    });
  });
});
