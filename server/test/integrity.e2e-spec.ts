import { INestApplication } from '@nestjs/common';
import { DealStage } from '@crm/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createTestApp, login } from './setup';

/**
 * Регрессионные проверки целостности данных.
 * Каждый тест соответствует дефекту, найденному при ревью.
 */
describe('Целостность данных', () => {
  let app: INestApplication;
  let token: string;
  let clientId: number;

  beforeAll(async () => {
    app = await createTestApp();
    token = await login(app, 'manager', 'manager123');

    const client = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', bearer(token))
      .send({ name: 'ООО «Целостность»' })
      .expect(201);
    clientId = client.body.clientId;
  });

  afterAll(async () => {
    await request(app.getHttpServer())
      .delete(`/api/clients/${clientId}?force=true`)
      .set('Authorization', bearer(token));
    await app.close();
  });

  describe('Границы числовых значений', () => {
    it('сумма сделки сверх разрядности колонки отклоняется как ошибка ввода', async () => {
      // Раньше значение уходило в БД и роняло запрос: пользователь видел
      // «Внутренняя ошибка сервера» вместо понятного сообщения
      const response = await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(token))
        .send({
          clientId,
          title: 'Сделка с переполнением',
          amount: 999999999999999999,
        })
        .expect(400);

      expect(JSON.stringify(response.body)).toContain('слишком велика');
    });

    it('отрицательная сумма отклоняется', async () => {
      await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(token))
        .send({ clientId, title: 'Отрицательная', amount: -1 })
        .expect(400);
    });

    it('сумма коммерческого предложения ограничена сверху', async () => {
      const deal = await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(token))
        .send({ clientId, title: 'Для КП', amount: 1000 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/offers')
        .set('Authorization', bearer(token))
        .send({
          dealId: deal.body.dealId,
          number: 'КП-ТЕСТ',
          date: '2026-09-01',
          totalAmount: 999999999999999999,
        })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/api/deals/${deal.body.dealId}?force=true`)
        .set('Authorization', bearer(token))
        .expect(200);
    });

    it('база отвергает недопустимые значения даже в обход валидации', async () => {
      // CHECK-ограничения описаны в docs/schema.sql; проверяем, что они
      // действительно существуют, а не только задекларированы в документации
      const dataSource = app.get(DataSource);
      const constraints = await dataSource.query(
        `SELECT conname FROM pg_constraint WHERE conname LIKE 'ck_%' ORDER BY conname`,
      );
      const names = constraints.map((row: { conname: string }) => row.conname);
      expect(names).toEqual([
        'ck_deals_amount',
        'ck_deals_probability',
        'ck_offers_amount',
      ]);

      await expect(
        dataSource.query(
          `UPDATE deals SET probability = 150 WHERE deal_id = (SELECT MIN(deal_id) FROM deals)`,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Удаление связанных записей', () => {
    it('удаление клиента со сделками запрещено', async () => {
      const deal = await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(token))
        .send({ clientId, title: 'Блокирует удаление', amount: 1000 })
        .expect(201);

      const response = await request(app.getHttpServer())
        .delete(`/api/clients/${clientId}`)
        .set('Authorization', bearer(token))
        .expect(409);
      expect(JSON.stringify(response.body)).toContain('сделки');

      await request(app.getHttpServer())
        .delete(`/api/deals/${deal.body.dealId}?force=true`)
        .set('Authorization', bearer(token))
        .expect(200);
    });

    it('удаление клиента с активностями требует подтверждения', async () => {
      const activity = await request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', bearer(token))
        .send({
          clientId,
          type: 'call',
          subject: 'Активность перед удалением',
          plannedAt: new Date().toISOString(),
        })
        .expect(201);

      const refused = await request(app.getHttpServer())
        .delete(`/api/clients/${clientId}`)
        .set('Authorization', bearer(token))
        .expect(409);
      // В ответе перечислено, что именно будет потеряно
      expect(refused.body.dependents.activities).toBeGreaterThanOrEqual(1);

      await request(app.getHttpServer())
        .delete(`/api/activities/${activity.body.activityId}`)
        .set('Authorization', bearer(token))
        .expect(200);
    });

    it('удаление сделки с историей и КП требует подтверждения', async () => {
      const deal = await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(token))
        .send({ clientId, title: 'Сделка с КП', amount: 5000 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/offers')
        .set('Authorization', bearer(token))
        .send({
          dealId: deal.body.dealId,
          number: 'КП-УДАЛЕНИЕ',
          date: '2026-09-01',
          totalAmount: 5000,
        })
        .expect(201);

      const refused = await request(app.getHttpServer())
        .delete(`/api/deals/${deal.body.dealId}`)
        .set('Authorization', bearer(token))
        .expect(409);
      expect(refused.body.dependents.offers).toBe(1);

      await request(app.getHttpServer())
        .delete(`/api/deals/${deal.body.dealId}?force=true`)
        .set('Authorization', bearer(token))
        .expect(200);
    });
  });

  describe('Согласованность стадий сделки', () => {
    it('дата закрытия проставляется и снимается вместе со стадией', async () => {
      const deal = await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(token))
        .send({ clientId, title: 'Стадии', amount: 1000 })
        .expect(201);
      const dealId = deal.body.dealId;

      const won = await request(app.getHttpServer())
        .patch(`/api/deals/${dealId}/stage`)
        .set('Authorization', bearer(token))
        .send({ stage: DealStage.WON })
        .expect(200);
      expect(won.body.closedAt).not.toBeNull();
      expect(won.body.probability).toBe(100);

      const back = await request(app.getHttpServer())
        .patch(`/api/deals/${dealId}/stage`)
        .set('Authorization', bearer(token))
        .send({ stage: DealStage.NEGOTIATION })
        .expect(200);
      expect(back.body.closedAt).toBeNull();

      await request(app.getHttpServer())
        .delete(`/api/deals/${dealId}?force=true`)
        .set('Authorization', bearer(token))
        .expect(200);
    });

    it('параллельные переводы не создают двух записей в истории', async () => {
      const deal = await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(token))
        .send({ clientId, title: 'Гонка стадий', amount: 1000 })
        .expect(201);
      const dealId = deal.body.dealId;

      // Оба запроса читают исходную стадию одновременно: без блокировки
      // строки оба проходили проверку и писали в историю
      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/api/deals/${dealId}/stage`)
          .set('Authorization', bearer(token))
          .send({ stage: DealStage.QUALIFICATION }),
        request(app.getHttpServer())
          .patch(`/api/deals/${dealId}/stage`)
          .set('Authorization', bearer(token))
          .send({ stage: DealStage.QUALIFICATION }),
      ]);

      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([200, 400]);

      const history = await request(app.getHttpServer())
        .get(`/api/deals/${dealId}/history`)
        .set('Authorization', bearer(token))
        .expect(200);
      // Запись о создании плюс ровно один переход
      expect(history.body).toHaveLength(2);

      await request(app.getHttpServer())
        .delete(`/api/deals/${dealId}?force=true`)
        .set('Authorization', bearer(token))
        .expect(200);
    });
  });
});
