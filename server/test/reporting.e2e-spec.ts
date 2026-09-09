import { INestApplication } from '@nestjs/common';
import { Currency, DealStage, FunnelRow } from '@crm/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, binaryParser, createTestApp, login } from './setup';

/**
 * Регрессионные проверки отчётности: валюты, часовые пояса и безопасность
 * выгрузок. Каждый тест соответствует дефекту, найденному при ревью.
 */
describe('Отчётность: валюты, периоды и выгрузки', () => {
  let app: INestApplication;
  let managerToken: string;
  let headToken: string;
  let clientId: number;

  beforeAll(async () => {
    app = await createTestApp();
    managerToken = await login(app, 'manager', 'manager123');
    headToken = await login(app, 'head', 'head123');

    const client = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', bearer(managerToken))
      .send({ name: 'ООО «Отчётность»' })
      .expect(201);
    clientId = client.body.clientId;
  });

  afterAll(async () => {
    await request(app.getHttpServer())
      .delete(`/api/clients/${clientId}?force=true`)
      .set('Authorization', bearer(managerToken));
    await app.close();
  });

  const totalAmount = (rows: FunnelRow[]): number =>
    rows.reduce((sum, row) => sum + row.amount, 0);

  describe('Разделение валют', () => {
    it('сделка в долларах не попадает в рублёвую воронку', async () => {
      // Суммы разных валют складывались без конвертации, и 100 000 USD
      // добавляли 100 000 к рублёвому итогу
      const before = await request(app.getHttpServer())
        .get('/api/reports/funnel?currency=RUB')
        .set('Authorization', bearer(headToken))
        .expect(200);

      const deal = await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(managerToken))
        .send({
          clientId,
          title: 'Валютная сделка',
          amount: 100000,
          currency: Currency.USD,
        })
        .expect(201);

      const afterRub = await request(app.getHttpServer())
        .get('/api/reports/funnel?currency=RUB')
        .set('Authorization', bearer(headToken))
        .expect(200);
      expect(totalAmount(afterRub.body)).toBe(totalAmount(before.body));

      const afterUsd = await request(app.getHttpServer())
        .get('/api/reports/funnel?currency=USD')
        .set('Authorization', bearer(headToken))
        .expect(200);
      expect(totalAmount(afterUsd.body)).toBeGreaterThanOrEqual(100000);

      await request(app.getHttpServer())
        .delete(`/api/deals/${deal.body.dealId}?force=true`)
        .set('Authorization', bearer(managerToken))
        .expect(200);
    });

    it('по умолчанию отчёт считается в базовой валюте', async () => {
      const explicit = await request(app.getHttpServer())
        .get('/api/reports/funnel?currency=RUB')
        .set('Authorization', bearer(headToken))
        .expect(200);
      const implicit = await request(app.getHttpServer())
        .get('/api/reports/funnel')
        .set('Authorization', bearer(headToken))
        .expect(200);

      expect(totalAmount(implicit.body)).toBe(totalAmount(explicit.body));
    });

    it('сводка на главной сообщает валюту показателей', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', bearer(managerToken))
        .expect(200);

      expect(response.body.currency).toBe(Currency.RUB);
    });

    it('неизвестная валюта отклоняется', async () => {
      await request(app.getHttpServer())
        .get('/api/reports/funnel?currency=GBP')
        .set('Authorization', bearer(headToken))
        .expect(400);
    });
  });

  describe('Границы периодов в деловом часовом поясе', () => {
    it('соединение работает в деловом часовом поясе, а не в UTC', async () => {
      // Иначе DATE_TRUNC и сравнение дат смещаются, и сделка, закрытая
      // первого числа в час ночи, уезжает в предыдущий месяц
      const dataSource = app.get(DataSource);
      const [{ TimeZone }] = await dataSource.query('SHOW timezone');
      expect(TimeZone).toBe(process.env.TZ ?? 'Europe/Moscow');
    });

    it('группировка по месяцам начинается с местной полуночи', async () => {
      const dataSource = app.get(DataSource);
      const [row] = await dataSource.query(
        `SELECT DATE_TRUNC('month', TIMESTAMPTZ '2026-09-15 12:00') AS start`,
      );
      // Начало сентября по Москве — 31 августа 21:00 UTC
      expect(new Date(row.start).toISOString()).toBe('2026-08-31T21:00:00.000Z');
    });

    it('верхняя граница периода включает весь последний день', async () => {
      const deal = await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(managerToken))
        .send({ clientId, title: 'Граница периода', amount: 777 })
        .expect(201);

      const dataSource = app.get(DataSource);
      // Сделка закрыта в последний час суток по местному времени
      await dataSource.query(
        `UPDATE deals SET stage = 'won', closed_at = TIMESTAMPTZ '2026-06-30 23:30'
         WHERE deal_id = $1`,
        [deal.body.dealId],
      );

      const report = await request(app.getHttpServer())
        .get('/api/reports/sales-dynamics?from=2026-06-01&to=2026-06-30')
        .set('Authorization', bearer(managerToken))
        .expect(200);

      const june = report.body.find((row: { period: string }) =>
        row.period.startsWith('2026-06'),
      );
      expect(june).toBeDefined();
      expect(june.amount).toBeGreaterThanOrEqual(777);

      await request(app.getHttpServer())
        .delete(`/api/deals/${deal.body.dealId}?force=true`)
        .set('Authorization', bearer(managerToken))
        .expect(200);
    });
  });

  describe('Безопасность выгрузок', () => {
    it('значение, похожее на формулу, обезвреживается в CSV', async () => {
      // Наименование клиента вводит пользователь; Excel выполнил бы
      // содержимое ячейки, начинающееся со знака равенства
      const payload = '=HYPERLINK("http://example.test")';
      const client = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', bearer(managerToken))
        .send({ name: payload })
        .expect(201);

      // Сумма заведомо больше остальных, чтобы клиент попал в ТОП-10
      const deal = await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(managerToken))
        .send({
          clientId: client.body.clientId,
          title: 'Для выгрузки',
          amount: 99_000_000,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/reports/top/export?format=csv&entity=clients')
        .set('Authorization', bearer(managerToken))
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      const text = response.body.toString('utf-8');
      // Значение экранировано по правилам CSV (кавычки удвоены) и снабжено
      // апострофом, поэтому табличный процессор покажет его как текст
      expect(text).toContain(`"'=HYPERLINK(""http://example.test"")"`);
      // Ни одна ячейка не начинается со знака, который трактуется как формула
      const cellsWithFormula = (text as string)
        .split(/\r?\n/)
        .flatMap((line: string) => line.split(';'))
        .filter((cell: string) => /^[=+@]/.test(cell));
      expect(cellsWithFormula).toEqual([]);

      await request(app.getHttpServer())
        .delete(`/api/deals/${deal.body.dealId}?force=true`)
        .set('Authorization', bearer(managerToken))
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/api/clients/${client.body.clientId}?force=true`)
        .set('Authorization', bearer(managerToken))
        .expect(200);
    });

    it('подзаголовок выгрузки называет валюту показателей', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/funnel/export?format=csv&currency=USD')
        .set('Authorization', bearer(headToken))
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      // В CSV подзаголовка нет, но заголовок колонки больше не обещает рубли
      const text = response.body.toString('utf-8');
      expect(text).toContain('Сумма');
      expect(text).not.toContain('Сумма, руб.');
    });
  });

  describe('Согласованность отчётов со списками', () => {
    it('сумма воронки совпадает с суммой рублёвых сделок', async () => {
      const funnel = await request(app.getHttpServer())
        .get('/api/reports/funnel?currency=RUB')
        .set('Authorization', bearer(headToken))
        .expect(200);

      const deals = await request(app.getHttpServer())
        .get('/api/deals?limit=200')
        .set('Authorization', bearer(headToken))
        .expect(200);

      const listTotal = deals.body.items
        .filter((deal: { currency: Currency }) => deal.currency === Currency.RUB)
        .reduce(
          (sum: number, deal: { amount: number }) => sum + Number(deal.amount),
          0,
        );

      expect(totalAmount(funnel.body)).toBeCloseTo(listTotal, 2);
    });

    it('динамика продаж не содержит будущих периодов', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/sales-dynamics?granularity=month')
        .set('Authorization', bearer(headToken))
        .expect(200);

      response.body.forEach((row: { period: string }) => {
        expect(new Date(row.period).getTime()).toBeLessThanOrEqual(Date.now());
      });
      expect(response.body.every((row: { count: number }) => row.count > 0)).toBe(
        true,
      );
    });
  });

  describe('Стадия сделки не рассогласуется с вероятностью', () => {
    it('вероятность нельзя задать в обход стадии', async () => {
      const deal = await request(app.getHttpServer())
        .post('/api/deals')
        .set('Authorization', bearer(managerToken))
        .send({ clientId, title: 'Вероятность', amount: 100 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/deals/${deal.body.dealId}`)
        .set('Authorization', bearer(managerToken))
        .send({ probability: 90 })
        .expect(200);

      const after = await request(app.getHttpServer())
        .get(`/api/deals/${deal.body.dealId}`)
        .set('Authorization', bearer(managerToken))
        .expect(200);
      // Значение определяется стадией и остаётся прежним
      expect(after.body.probability).toBe(10);
      expect(after.body.stage).toBe(DealStage.NEW);

      await request(app.getHttpServer())
        .delete(`/api/deals/${deal.body.dealId}?force=true`)
        .set('Authorization', bearer(managerToken))
        .expect(200);
    });
  });
});
