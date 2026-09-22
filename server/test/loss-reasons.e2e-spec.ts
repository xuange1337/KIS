import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

/**
 * Причины проигрыша.
 *
 * Воронка отвечает, сколько сделок проиграно; причина отвечает почему —
 * ради этого проигрыши и разбирают. Проигрыш без причины означает, что
 * разбирать потом не по чему.
 */
describe('Причины проигрыша сделок', () => {
  let app: INestApplication;
  let token: string;
  let clientId: number;

  const createDeal = async (title: string): Promise<number> => {
    const deal = await request(app.getHttpServer())
      .post('/api/deals')
      .set('Authorization', bearer(token))
      .send({ clientId, title, amount: 100000 })
      .expect(201);
    return deal.body.dealId;
  };

  const removeDeal = async (dealId: number): Promise<void> => {
    await request(app.getHttpServer())
      .delete(`/api/deals/${dealId}?force=true`)
      .set('Authorization', bearer(token))
      .expect(200);
  };

  beforeAll(async () => {
    app = await createTestApp();
    token = await login(app, 'head', 'head123');
    const clients = await request(app.getHttpServer())
      .get('/api/clients?limit=1')
      .set('Authorization', bearer(token))
      .expect(200);
    clientId = clients.body.items[0].clientId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('не проигрывает сделку без причины', async () => {
    const dealId = await createDeal('Сделка без причины проигрыша');

    await request(app.getHttpServer())
      .patch(`/api/deals/${dealId}/stage`)
      .set('Authorization', bearer(token))
      .send({ stage: 'lost' })
      .expect(400);

    // Сделка осталась в работе: отказ не должен оставлять её в
    // половинчатом состоянии
    const deal = await request(app.getHttpServer())
      .get(`/api/deals/${dealId}`)
      .set('Authorization', bearer(token))
      .expect(200);
    expect(deal.body.stage).toBe('new');

    await removeDeal(dealId);
  });

  it('требует пояснение для причины «другое»', async () => {
    const dealId = await createDeal('Сделка с причиной другое');

    await request(app.getHttpServer())
      .patch(`/api/deals/${dealId}/stage`)
      .set('Authorization', bearer(token))
      .send({ stage: 'lost', lossReason: 'other' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/deals/${dealId}/stage`)
      .set('Authorization', bearer(token))
      .send({
        stage: 'lost',
        lossReason: 'other',
        lossComment: 'Проект заморожен решением головной компании',
      })
      .expect(200);

    await removeDeal(dealId);
  });

  it('сохраняет причину и снимает её при возврате в работу', async () => {
    const dealId = await createDeal('Сделка для проверки причины');

    const lost = await request(app.getHttpServer())
      .patch(`/api/deals/${dealId}/stage`)
      .set('Authorization', bearer(token))
      .send({ stage: 'lost', lossReason: 'price' })
      .expect(200);
    expect(lost.body.lossReason).toBe('price');
    expect(lost.body.closedAt).not.toBeNull();

    // Вернули в работу: причина больше не относится к сделке, иначе
    // отчёт считал бы её среди проигрышей
    const reopened = await request(app.getHttpServer())
      .patch(`/api/deals/${dealId}/stage`)
      .set('Authorization', bearer(token))
      .send({ stage: 'negotiation' })
      .expect(200);
    expect(reopened.body.lossReason).toBeNull();
    expect(reopened.body.closedAt).toBeNull();

    await removeDeal(dealId);
  });

  it('строит отчёт по причинам и считает суммы', async () => {
    const first = await createDeal('Проигрыш по цене');
    const second = await createDeal('Проигрыш конкуренту');

    for (const [dealId, reason] of [
      [first, 'price'],
      [second, 'competitor'],
    ] as const) {
      await request(app.getHttpServer())
        .patch(`/api/deals/${dealId}/stage`)
        .set('Authorization', bearer(token))
        .send({ stage: 'lost', lossReason: reason })
        .expect(200);
    }

    const report = await request(app.getHttpServer())
      .get('/api/reports/loss-reasons')
      .set('Authorization', bearer(token))
      .expect(200);

    const byReason = Object.fromEntries(
      report.body.map((row: { reason: string; count: number }) => [
        row.reason,
        row.count,
      ]),
    );
    expect(byReason.price).toBeGreaterThanOrEqual(1);
    expect(byReason.competitor).toBeGreaterThanOrEqual(1);
    // Причины без сделок тоже в выдаче: пустая строка отвечает на
    // вопрос «по этой причине мы не проигрываем»
    expect(Object.keys(byReason)).toHaveLength(7);

    const sums = report.body.filter(
      (row: { reason: string }) => row.reason === 'price',
    );
    expect(sums[0].amount).toBeGreaterThanOrEqual(100000);

    await removeDeal(first);
    await removeDeal(second);
  });

  it('выгружает отчёт по причинам', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/loss-reasons/export?format=csv')
      .set('Authorization', bearer(token))
      .expect(200);

    expect(response.headers['content-disposition']).toContain('loss-reasons');
    expect(response.text).toContain('Причина');
  });

  it('база не принимает причину у непроигранной сделки', async () => {
    const dealId = await createDeal('Сделка в работе с причиной');
    // Ограничение стоит в базе, а не только в приложении: отчёт
    // строится прямым запросом, и мусор в колонке исказил бы его молча
    const dataSource = app.get(
      (await import('typeorm')).DataSource as never,
    ) as import('typeorm').DataSource;
    await expect(
      dataSource.query(
        `UPDATE deals SET loss_reason = 'price' WHERE deal_id = $1`,
        [dealId],
      ),
    ).rejects.toThrow();

    await removeDeal(dealId);
  });
});
