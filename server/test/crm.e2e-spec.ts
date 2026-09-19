import { INestApplication } from '@nestjs/common';
import { DealStage } from '@crm/shared';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

describe('Модули CRM: клиенты, контакты, сделки, активности (ТЗ п. 1.2)', () => {
  let app: INestApplication;
  let token: string;
  let createdClientId: number;
  let createdDealId: number;

  beforeAll(async () => {
    app = await createTestApp();
    token = await login(app, 'manager', 'manager123');
  });

  afterAll(async () => {
    // Тестовые записи удаляются, чтобы не искажать отчёты и скриншоты
    if (createdDealId) {
      await request(app.getHttpServer())
        .delete(`/api/deals/${createdDealId}`)
        .set('Authorization', bearer(token));
    }
    if (createdClientId) {
      await request(app.getHttpServer())
        .delete(`/api/clients/${createdClientId}`)
        .set('Authorization', bearer(token));
    }
    await app.close();
  });

  describe('Модуль управления клиентами (1.2.1)', () => {
    it('создаёт карточку клиента и назначает владельцем текущего менеджера', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(token))
        .send({
          name: 'ООО «Тестовая Компания»',
          inn: '7712345678',
          industry: 'ИТ и телеком',
          status: 'lead',
          source: 'website',
          address: 'г. Москва, ул. Тестовая, д. 1',
        })
        .expect(201);

      createdClientId = response.body.clientId;
      expect(response.body.name).toBe('ООО «Тестовая Компания»');
      expect(response.body.ownerUserId).toEqual(expect.any(Number));
    });

    it('отклоняет некорректный ИНН', async () => {
      await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(token))
        .send({ name: 'ООО «Неверный ИНН»', inn: '123' })
        .expect(400);
    });

    it('находит клиента поиском по наименованию', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients')
        .query({ q: 'Тестовая Компания' })
        .set('Authorization', bearer(token))
        .expect(200);

      expect(response.body.total).toBeGreaterThanOrEqual(1);
    });

    it('фильтрует список по статусу', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients')
        .query({ status: 'lead', limit: 100 })
        .set('Authorization', bearer(token))
        .expect(200);

      const statuses: string[] = response.body.items.map(
        (item: { status: string }) => item.status,
      );
      expect(statuses.every((status) => status === 'lead')).toBe(true);
    });

    it('обновляет карточку клиента', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/clients/${createdClientId}`)
        .set('Authorization', bearer(token))
        .send({ status: 'in_work' })
        .expect(200);

      expect(response.body.status).toBe('in_work');
    });
  });

  describe('Модуль контактов (1.2.2)', () => {
    let contactId: number;

    it('добавляет контактное лицо клиенту', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', bearer(token))
        .send({
          clientId: createdClientId,
          fullName: 'Иванов Иван Иванович',
          position: 'Директор',
          phone: '+7 495 000-00-00',
          email: 'ivanov@test.example',
          preferredChannel: 'phone',
        })
        .expect(201);

      contactId = response.body.contactId;
      expect(response.body.fullName).toBe('Иванов Иван Иванович');
    });

    it('отклоняет некорректный адрес электронной почты', async () => {
      await request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', bearer(token))
        .send({
          clientId: createdClientId,
          fullName: 'Петров Пётр',
          email: 'не-почта',
        })
        .expect(400);
    });

    it('возвращает контакты в карточке клиента', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/clients/${createdClientId}/contacts`)
        .set('Authorization', bearer(token))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].contactId).toBe(contactId);
    });
  });

  describe('Модуль сделок (1.2.3)', () => {
    it('создаёт сделку и первую запись истории стадий', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(token))
        .send({
          clientId: createdClientId,
          title: 'Тестовая сделка',
          amount: 500000,
          currency: 'RUB',
        })
        .expect(201);

      createdDealId = response.body.dealId;
      expect(response.body.stage).toBe(DealStage.NEW);
      // Вероятность подставляется по стадии автоматически
      expect(response.body.probability).toBe(10);

      const history = await request(app.getHttpServer())
        .get(`/api/deals/${createdDealId}/history`)
        .set('Authorization', bearer(token))
        .expect(200);

      expect(history.body).toHaveLength(1);
      expect(history.body[0].fromStage).toBeNull();
      expect(history.body[0].toStage).toBe(DealStage.NEW);
    });

    it('фиксирует переход по стадиям в истории', async () => {
      await request(app.getHttpServer())
        .patch(`/api/deals/${createdDealId}/stage`)
        .set('Authorization', bearer(token))
        .send({ stage: DealStage.QUALIFICATION })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/deals/${createdDealId}/history`)
        .set('Authorization', bearer(token))
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[1].fromStage).toBe(DealStage.NEW);
      expect(response.body[1].toStage).toBe(DealStage.QUALIFICATION);
    });

    it('проставляет дату закрытия при переводе в выигранные', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/deals/${createdDealId}/stage`)
        .set('Authorization', bearer(token))
        .send({ stage: DealStage.WON })
        .expect(200);

      expect(response.body.closedAt).not.toBeNull();
      expect(response.body.probability).toBe(100);
    });

    it('снимает дату закрытия при возврате сделки в работу', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/deals/${createdDealId}/stage`)
        .set('Authorization', bearer(token))
        .send({ stage: DealStage.NEGOTIATION })
        .expect(200);

      expect(response.body.closedAt).toBeNull();
    });

    it('отклоняет перевод на текущую стадию', async () => {
      await request(app.getHttpServer())
        .patch(`/api/deals/${createdDealId}/stage`)
        .set('Authorization', bearer(token))
        .send({ stage: DealStage.NEGOTIATION })
        .expect(400);
    });
  });

  describe('Модуль активностей (1.2.4)', () => {
    let activityId: number;

    it('планирует звонок по сделке', async () => {
      const plannedAt = new Date(Date.now() + 3 * 24 * 3600 * 1000);
      const response = await request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', bearer(token))
        .send({
          clientId: createdClientId,
          dealId: createdDealId,
          type: 'call',
          subject: 'Тестовый звонок',
          plannedAt: plannedAt.toISOString(),
        })
        .expect(201);

      activityId = response.body.activityId;
      expect(response.body.status).toBe('planned');
    });

    it('возвращает активность в выборке календаря за период', async () => {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      const response = await request(app.getHttpServer())
        .get('/api/activities/calendar')
        .query({ from, to })
        .set('Authorization', bearer(token))
        .expect(200);

      const ids = response.body.map(
        (item: { activityId: number }) => item.activityId,
      );
      expect(ids).toContain(activityId);
    });

    it('требует указания периода для календаря', async () => {
      await request(app.getHttpServer())
        .get('/api/activities/calendar')
        .set('Authorization', bearer(token))
        .expect(400);
    });

    it('отмечает выполнение с фиксацией результата', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/activities/${activityId}/complete`)
        .set('Authorization', bearer(token))
        .send({ result: 'Клиент подтвердил интерес' })
        .expect(200);

      expect(response.body.status).toBe('done');
      expect(response.body.doneAt).not.toBeNull();
      expect(response.body.result).toBe('Клиент подтвердил интерес');
    });

    it('не позволяет выполнить активность повторно', async () => {
      await request(app.getHttpServer())
        .patch(`/api/activities/${activityId}/complete`)
        .set('Authorization', bearer(token))
        .send({ result: 'Повторная отметка' })
        .expect(400);
    });

    it('удаляет тестовую активность', async () => {
      await request(app.getHttpServer())
        .delete(`/api/activities/${activityId}`)
        .set('Authorization', bearer(token))
        .expect(200);
    });
  });
});
