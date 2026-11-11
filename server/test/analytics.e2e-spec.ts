import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

describe('Расширенная аналитика', () => {
  let app: INestApplication;
  let head: string;
  let manager: string;
  let other: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: bearer(token) });

  beforeAll(async () => {
    app = await createTestApp();
    head = await login(app, 'head', 'head123');
    manager = await login(app, 'manager', 'manager123');
    other = await login(app, 'other-admin', 'other123');
  });
  afterAll(async () => {
    await app.close();
  });

  it('прогноз группирует открытые сделки по месяцам, взвешенная сумма не больше полной', async () => {
    const response = await http()
      .get('/api/analytics/forecast?months=12')
      .set(as(head))
      .expect(200);
    expect(response.body.length).toBeGreaterThan(0);
    for (const row of response.body) {
      expect(row.weightedAmount).toBeLessThanOrEqual(row.amount);
      expect(row.month === null || /^\d{4}-\d{2}$/.test(row.month)).toBe(true);
    }
    const months = response.body
      .filter((r: { month: string | null }) => r.month)
      .map((r: { month: string }) => r.month);
    expect([...months].sort()).toEqual(months);
  });

  it('прогноз менеджера не больше прогноза руководителя', async () => {
    const all = await http()
      .get('/api/analytics/forecast?months=24')
      .set(as(head))
      .expect(200);
    const mine = await http()
      .get('/api/analytics/forecast?months=24')
      .set(as(manager))
      .expect(200);
    const sum = (rows: { dealsCount: number }[]) =>
      rows.reduce((s, r) => s + r.dealsCount, 0);
    expect(sum(mine.body)).toBeLessThanOrEqual(sum(all.body));
  });

  it('конверсия монотонно не растёт вдоль воронки', async () => {
    const response = await http()
      .get('/api/analytics/conversion')
      .set(as(head))
      .expect(200);
    expect(response.body.map((r: { stage: string }) => r.stage)).toEqual([
      'new',
      'qualification',
      'proposal',
      'negotiation',
      'won',
    ]);
    const reached = response.body.map((r: { reached: number }) => r.reached);
    for (let i = 1; i < reached.length; i += 1)
      expect(reached[i]).toBeLessThanOrEqual(reached[i - 1]);
    expect(response.body[0].conversionFromPrevious).toBeNull();
  });

  it('рейтинг: руководитель видит всех, менеджер только себя', async () => {
    const all = await http()
      .get('/api/analytics/managers')
      .set(as(head))
      .expect(200);
    expect(all.body.length).toBeGreaterThan(1);
    const mine = await http()
      .get('/api/analytics/managers')
      .set(as(manager))
      .expect(200);
    expect(mine.body).toHaveLength(1);
    for (const row of all.body) {
      expect(
        row.winRate === null || (row.winRate >= 0 && row.winRate <= 100),
      ).toBe(true);
    }
  });

  it('проверяет период и изолирует организации', async () => {
    await http()
      .get('/api/analytics/managers?from=вчера')
      .set(as(head))
      .expect(400);
    await http()
      .get('/api/analytics/forecast?months=99')
      .set(as(head))
      .expect(400);
    const foreign = await http()
      .get('/api/analytics/managers')
      .set(as(other))
      .expect(200);
    expect(JSON.stringify(foreign.body)).not.toContain('Фёдорова');
    await http().get('/api/analytics/forecast').expect(401);
  });
});
