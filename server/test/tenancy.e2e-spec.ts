import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createTestApp, login } from './setup';

/**
 * Изоляция организаций.
 *
 * Демонстрационная база содержит две организации. Каждая проверка берёт
 * идентификатор записи соседней организации и убеждается, что для
 * пользователя она не существует: ни в списках, ни по прямой ссылке,
 * ни как значение поля связи.
 */
describe('Изоляция организаций', () => {
  let app: INestApplication;
  let adminToken: string;
  let headToken: string;
  let managerToken: string;
  let otherAdminToken: string;

  /** Идентификаторы записей соседней организации. */
  let foreign: {
    organizationId: number;
    userId: number;
    clientId: number;
    contactId: number;
    dealId: number;
    activityId: number;
    offerId: number;
  };

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await login(app, 'admin', 'admin123');
    headToken = await login(app, 'head', 'head123');
    managerToken = await login(app, 'manager', 'manager123');
    otherAdminToken = await login(app, 'other-admin', 'other123');

    const dataSource = app.get(DataSource);
    const [row] = await dataSource.query(`
      SELECT o.organization_id      AS "organizationId",
             u.user_id              AS "userId",
             c.client_id            AS "clientId",
             ct.contact_id          AS "contactId",
             d.deal_id              AS "dealId",
             a.activity_id          AS "activityId",
             co.offer_id            AS "offerId"
        FROM organizations o
        JOIN users u ON u.organization_id = o.organization_id AND u.login = 'other-manager'
        JOIN clients c ON c.organization_id = o.organization_id
        JOIN contacts ct ON ct.organization_id = o.organization_id
        JOIN deals d ON d.organization_id = o.organization_id
        JOIN activities a ON a.organization_id = o.organization_id
        JOIN commercial_offers co ON co.organization_id = o.organization_id
       WHERE o.name = 'ЗАО «Соседняя компания»'
       LIMIT 1
    `);
    foreign = row;
    expect(foreign?.clientId).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Чужие записи не существуют', () => {
    const cases: { name: string; url: (ids: typeof foreign) => string }[] = [
      { name: 'клиент', url: (ids) => `/api/clients/${ids.clientId}` },
      {
        name: 'контактное лицо',
        url: (ids) => `/api/contacts/${ids.contactId}`,
      },
      { name: 'сделка', url: (ids) => `/api/deals/${ids.dealId}` },
      {
        name: 'история сделки',
        url: (ids) => `/api/deals/${ids.dealId}/history`,
      },
      { name: 'активность', url: (ids) => `/api/activities/${ids.activityId}` },
      {
        name: 'коммерческое предложение',
        url: (ids) => `/api/offers/${ids.offerId}`,
      },
      { name: 'пользователь', url: (ids) => `/api/users/${ids.userId}` },
    ];

    for (const testCase of cases) {
      it(`${testCase.name} соседней организации не открывается администратором`, async () => {
        // Именно 404, а не 403: иначе перебором идентификаторов видно,
        // какие записи есть у соседней организации
        await request(app.getHttpServer())
          .get(testCase.url(foreign))
          .set('Authorization', bearer(adminToken))
          .expect(404);
      });
    }
  });

  describe('Чужие записи не изменяются', () => {
    it('клиент соседней организации не правится и не удаляется', async () => {
      await request(app.getHttpServer())
        .patch(`/api/clients/${foreign.clientId}`)
        .set('Authorization', bearer(adminToken))
        .send({ name: 'Переименовано извне' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/api/clients/${foreign.clientId}?force=true`)
        .set('Authorization', bearer(adminToken))
        .expect(404);
    });

    it('стадия чужой сделки не меняется', async () => {
      await request(app.getHttpServer())
        .patch(`/api/deals/${foreign.dealId}/stage`)
        .set('Authorization', bearer(adminToken))
        .send({ stage: 'won' })
        .expect(404);
    });

    it('чужая учётная запись не блокируется', async () => {
      await request(app.getHttpServer())
        .delete(`/api/users/${foreign.userId}`)
        .set('Authorization', bearer(adminToken))
        .expect(404);
    });
  });

  describe('Чужие записи нельзя указать в своих', () => {
    it('сделка не заводится по клиенту соседней организации', async () => {
      await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(adminToken))
        .send({
          clientId: foreign.clientId,
          title: 'Чужой клиент',
          amount: 1000,
        })
        .expect(404);
    });

    it('активность не привязывается к чужой сделке', async () => {
      const own = await request(app.getHttpServer())
        .get('/api/clients?limit=1')
        .set('Authorization', bearer(adminToken))
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', bearer(adminToken))
        .send({
          clientId: own.body.items[0].clientId,
          dealId: foreign.dealId,
          type: 'call',
          subject: 'Попытка привязки к чужой сделке',
          plannedAt: new Date().toISOString(),
        })
        .expect(404);
    });

    it('КП не оформляется по чужой сделке', async () => {
      await request(app.getHttpServer())
        .post('/api/offers')
        .set('Authorization', bearer(adminToken))
        .send({
          dealId: foreign.dealId,
          number: 'КП-ЧУЖОЕ/001',
          date: new Date().toISOString().slice(0, 10),
          totalAmount: 1000,
        })
        .expect(404);
    });

    it('ответственным нельзя назначить сотрудника соседней организации', async () => {
      // Внешний ключ проверяет только существование пользователя:
      // без проверки организации запись ушла бы к чужому сотруднику
      const created = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(headToken))
        .send({ name: 'ООО «Проверка ответственного»' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/clients/${created.body.clientId}`)
        .set('Authorization', bearer(headToken))
        .send({ ownerUserId: foreign.userId })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/api/clients/${created.body.clientId}`)
        .set('Authorization', bearer(headToken))
        .expect(200);
    });
  });

  describe('Списки и отчёты не смешивают организации', () => {
    it('списки не содержат записей соседней организации', async () => {
      const paths = [
        '/api/clients?limit=200',
        '/api/deals?limit=200',
        '/api/activities?limit=200',
        '/api/offers?limit=200',
        '/api/users',
      ];
      for (const path of paths) {
        const response = await request(app.getHttpServer())
          .get(path)
          .set('Authorization', bearer(adminToken))
          .expect(200);
        const items = Array.isArray(response.body)
          ? response.body
          : response.body.items;
        expect(items.length).toBeGreaterThan(0);
        expect(JSON.stringify(items)).not.toContain('Соседн');
      }
    });

    it('отчёты считают только свою организацию', async () => {
      const ownFunnel = await request(app.getHttpServer())
        .get('/api/reports/funnel')
        .set('Authorization', bearer(adminToken))
        .expect(200);
      const otherFunnel = await request(app.getHttpServer())
        .get('/api/reports/funnel')
        .set('Authorization', bearer(otherAdminToken))
        .expect(200);

      const total = (rows: { count: number }[]): number =>
        rows.reduce((sum, row) => sum + row.count, 0);

      expect(total(ownFunnel.body)).toBeGreaterThan(1);
      // В контрольной организации ровно одна сделка
      expect(total(otherFunnel.body)).toBe(1);
    });

    it('дашборд соседней организации показывает её собственные данные', async () => {
      const summary = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', bearer(otherAdminToken))
        .expect(200);

      expect(summary.body.dealsInWork).toBe(1);
      expect(JSON.stringify(summary.body)).not.toContain('Орлов');
    });

    it('справочник сотрудников не раскрывает чужих пользователей', async () => {
      const users = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', bearer(otherAdminToken))
        .expect(200);

      expect(users.body).toHaveLength(2);
      expect(JSON.stringify(users.body)).not.toContain('manager2');
    });
  });

  describe('Роли не переносятся между организациями', () => {
    it('менеджер соседней организации не видит данных первой', async () => {
      const otherManagerToken = await login(app, 'other-manager', 'other123');
      const clients = await request(app.getHttpServer())
        .get('/api/clients?limit=200')
        .set('Authorization', bearer(otherManagerToken))
        .expect(200);

      expect(clients.body.items).toHaveLength(1);
      expect(clients.body.items[0].name).toContain('Соседний');
    });

    it('менеджер своей организации не получает доступ к чужой по ownerUserId', async () => {
      const deals = await request(app.getHttpServer())
        .get(`/api/deals?ownerUserId=${foreign.userId}&limit=200`)
        .set('Authorization', bearer(managerToken))
        .expect(200);

      expect(deals.body.items).toHaveLength(0);
    });
  });
});
