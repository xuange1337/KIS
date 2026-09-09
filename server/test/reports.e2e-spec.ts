import { INestApplication } from '@nestjs/common';
import { DEAL_STAGE_LABELS, DealStage } from '@crm/shared';
import request from 'supertest';
import { bearer, binaryParser, createTestApp, login } from './setup';

describe('Отчёты и выгрузки (ТЗ п. 2.4)', () => {
  let app: INestApplication;
  let headToken: string;
  let managerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    headToken = await login(app, 'head', 'head123');
    managerToken = await login(app, 'manager', 'manager123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('воронка продаж содержит все стадии, включая пустые', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/funnel')
      .set('Authorization', bearer(headToken))
      .expect(200);

    const stages = response.body.map((row: { stage: string }) => row.stage);
    expect(stages).toEqual(Object.keys(DEAL_STAGE_LABELS));
    response.body.forEach((row: { count: number; amount: number }) => {
      expect(typeof row.count).toBe('number');
      expect(typeof row.amount).toBe('number');
    });
  });

  it('сумма воронки совпадает с суммой сделок в списке', async () => {
    const funnel = await request(app.getHttpServer())
      .get('/api/reports/funnel')
      .set('Authorization', bearer(headToken))
      .expect(200);

    const deals = await request(app.getHttpServer())
      .get('/api/deals?limit=200')
      .set('Authorization', bearer(headToken))
      .expect(200);

    const funnelTotal = funnel.body.reduce(
      (sum: number, row: { amount: number }) => sum + row.amount,
      0,
    );
    const dealsTotal = deals.body.items.reduce(
      (sum: number, deal: { amount: number }) => sum + Number(deal.amount),
      0,
    );
    expect(funnelTotal).toBeCloseTo(dealsTotal, 2);

    const funnelCount = funnel.body.reduce(
      (sum: number, row: { count: number }) => sum + row.count,
      0,
    );
    expect(funnelCount).toBe(deals.body.total);
  });

  it('воронка менеджера уже воронки руководителя', async () => {
    const asHead = await request(app.getHttpServer())
      .get('/api/reports/funnel')
      .set('Authorization', bearer(headToken))
      .expect(200);

    const asManager = await request(app.getHttpServer())
      .get('/api/reports/funnel')
      .set('Authorization', bearer(managerToken))
      .expect(200);

    const total = (body: { count: number }[]) =>
      body.reduce((sum, row) => sum + row.count, 0);
    expect(total(asManager.body)).toBeLessThan(total(asHead.body));
  });

  it('динамика продаж строится только по выигранным сделкам', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/sales-dynamics?granularity=month')
      .set('Authorization', bearer(headToken))
      .expect(200);

    const funnel = await request(app.getHttpServer())
      .get('/api/reports/funnel')
      .set('Authorization', bearer(headToken))
      .expect(200);

    const wonCount = funnel.body.find(
      (row: { stage: string }) => row.stage === DealStage.WON,
    ).count;
    const dynamicsCount = response.body.reduce(
      (sum: number, row: { count: number }) => sum + row.count,
      0,
    );
    expect(dynamicsCount).toBe(wonCount);

    // Продажи не могут быть датированы будущим
    response.body.forEach((row: { period: string }) => {
      expect(new Date(row.period).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  it('отчёт по активностям менеджеров разбивает данные по типам', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/manager-activities')
      .set('Authorization', bearer(headToken))
      .expect(200);

    expect(response.body.length).toBeGreaterThan(0);
    response.body.forEach(
      (row: {
        calls: number;
        meetings: number;
        emails: number;
        total: number;
      }) => {
        expect(row.calls + row.meetings + row.emails).toBe(row.total);
      },
    );
  });

  it('в просроченные попадают только незавершённые прошедшие активности', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/overdue-activities')
      .set('Authorization', bearer(headToken))
      .expect(200);

    expect(response.body.length).toBeGreaterThan(0);
    response.body.forEach((row: { plannedAt: string; daysOverdue: number }) => {
      expect(new Date(row.plannedAt).getTime()).toBeLessThan(Date.now());
      expect(row.daysOverdue).toBeGreaterThanOrEqual(0);
    });
  });

  it('ТОП клиентов отсортирован по убыванию суммы', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/top?entity=clients&limit=5')
      .set('Authorization', bearer(headToken))
      .expect(200);

    const amounts = response.body.map((row: { amount: number }) => row.amount);
    expect(amounts).toHaveLength(5);
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
  });

  it('фильтр по периоду сужает выборку отчёта', async () => {
    const full = await request(app.getHttpServer())
      .get('/api/reports/funnel')
      .set('Authorization', bearer(headToken))
      .expect(200);

    // Заведомо пустой период в прошлом
    const empty = await request(app.getHttpServer())
      .get('/api/reports/funnel?from=2000-01-01&to=2000-12-31')
      .set('Authorization', bearer(headToken))
      .expect(200);

    const total = (body: { count: number }[]) =>
      body.reduce((sum, row) => sum + row.count, 0);
    expect(total(full.body)).toBeGreaterThan(0);
    expect(total(empty.body)).toBe(0);
  });

  describe('Выгрузка отчётов', () => {
    it('формирует CSV с заголовками на русском языке', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/funnel/export?format=csv')
        .set('Authorization', bearer(headToken))
        .buffer(true)
        .parse(binaryParser)
        .expect(200)
        .expect('Content-Type', /text\/csv/);

      const text = response.body.toString('utf-8');
      expect(text).toContain('Стадия');
      expect(text).toContain('Первичный контакт');
    });

    it('формирует файл Excel', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/funnel/export?format=xlsx')
        .set('Authorization', bearer(headToken))
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      // Файлы xlsx — это zip-архив, начинающийся с сигнатуры PK
      expect(response.body.slice(0, 2).toString()).toBe('PK');
      expect(response.headers['content-disposition']).toContain('.xlsx');
    });

    it('формирует PDF со встроенным кириллическим шрифтом', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/funnel/export?format=pdf')
        .set('Authorization', bearer(headToken))
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      expect(response.body.slice(0, 4).toString()).toBe('%PDF');
      // Без вшитого DejaVu кириллица в отчёте не отрисуется
      expect(response.body.includes(Buffer.from('DejaVu'))).toBe(true);
    });

    it('отклоняет неизвестный отчёт и неподдерживаемый формат', async () => {
      await request(app.getHttpServer())
        .get('/api/reports/unknown-report/export?format=csv')
        .set('Authorization', bearer(headToken))
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/reports/funnel/export?format=doc')
        .set('Authorization', bearer(headToken))
        .expect(400);
    });
  });

  it('дашборд возвращает показатели и списки активностей', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard')
      .set('Authorization', bearer(managerToken))
      .expect(200);

    expect(response.body.dealsInWork).toEqual(expect.any(Number));
    expect(response.body.funnel).toHaveLength(
      Object.keys(DEAL_STAGE_LABELS).length,
    );
    expect(Array.isArray(response.body.upcomingActivities)).toBe(true);

    // Счётчик просроченных не должен обрезаться лимитом показываемого списка
    const overdue = await request(app.getHttpServer())
      .get('/api/reports/overdue-activities')
      .set('Authorization', bearer(managerToken))
      .expect(200);
    expect(response.body.overdueCount).toBe(overdue.body.length);
  });
});
