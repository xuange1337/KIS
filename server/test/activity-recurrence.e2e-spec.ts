import { INestApplication } from '@nestjs/common';
import { ActivityRecurrence } from '@crm/shared';
import request from 'supertest';
import { nextOccurrence } from '../src/activities/recurrence';
import { bearer, createTestApp, login } from './setup';

const iso = (value: string): Date => new Date(value);

describe('Повторы активностей: расчёт даты', () => {
  const now = iso('2026-01-01T00:00:00Z');

  it('ежедневный и еженедельный повтор сдвигают на период', () => {
    const planned = iso('2026-03-10T09:30:00Z');
    expect(
      nextOccurrence(planned, ActivityRecurrence.DAILY, now).toISOString(),
    ).toBe('2026-03-11T09:30:00.000Z');
    expect(
      nextOccurrence(planned, ActivityRecurrence.WEEKLY, now).toISOString(),
    ).toBe('2026-03-17T09:30:00.000Z');
  });

  it('месячный повтор не выходит за конец короткого месяца', () => {
    const planned = iso('2026-01-31T10:00:00Z');
    expect(
      nextOccurrence(planned, ActivityRecurrence.MONTHLY, now).toISOString(),
    ).toBe('2026-02-28T10:00:00.000Z');
  });

  it('день месяца берётся от исходной даты, а не от предыдущего повтора', () => {
    // Если после выполнения опоздали до марта, получаем 31 марта, а не 28
    const planned = iso('2026-01-31T10:00:00Z');
    const late = iso('2026-03-05T00:00:00Z');
    expect(
      nextOccurrence(planned, ActivityRecurrence.MONTHLY, late).toISOString(),
    ).toBe('2026-03-31T10:00:00.000Z');
  });

  it('високосный год и переход через год', () => {
    expect(
      nextOccurrence(
        iso('2028-01-31T00:00:00Z'),
        ActivityRecurrence.MONTHLY,
        iso('2028-01-31T12:00:00Z'),
      ).toISOString(),
    ).toBe('2028-02-29T00:00:00.000Z');
    expect(
      nextOccurrence(
        iso('2026-12-15T08:00:00Z'),
        ActivityRecurrence.MONTHLY,
        iso('2026-12-20T00:00:00Z'),
      ).toISOString(),
    ).toBe('2027-01-15T08:00:00.000Z');
  });

  it('при позднем выполнении берёт ближайшую дату после текущей, без пачки пропущенных', () => {
    const planned = iso('2026-01-05T09:00:00Z');
    const late = iso('2026-01-20T12:00:00Z');
    expect(
      nextOccurrence(planned, ActivityRecurrence.WEEKLY, late).toISOString(),
    ).toBe('2026-01-26T09:00:00.000Z');
    expect(
      nextOccurrence(planned, ActivityRecurrence.DAILY, late).toISOString(),
    ).toBe('2026-01-21T09:00:00.000Z');
  });
});

describe('Повторяющиеся активности (API)', () => {
  let app: INestApplication;
  let token: string;
  let clientId: number;

  const day = 24 * 60 * 60 * 1000;
  const inDays = (days: number): string =>
    new Date(Date.now() + days * day).toISOString();

  const create = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/activities')
      .set('Authorization', bearer(token))
      .send({
        clientId,
        type: 'call',
        subject: 'Еженедельный созвон',
        plannedAt: inDays(1),
        ...body,
      });

  const complete = (id: number) =>
    request(app.getHttpServer())
      .patch(`/api/activities/${id}/complete`)
      .set('Authorization', bearer(token))
      .send({ result: 'Согласовали шаги' });

  const listForClient = async (subject: string) => {
    const response = await request(app.getHttpServer())
      .get('/api/activities')
      .query({ clientId, q: subject, limit: 50 })
      .set('Authorization', bearer(token))
      .expect(200);
    return response.body.items as Array<{
      activityId: number;
      status: string;
      result: string | null;
      doneAt: string | null;
      recurrence: string | null;
      comment: string | null;
      ownerUserId: number | null;
      plannedAt: string;
    }>;
  };

  beforeAll(async () => {
    app = await createTestApp();
    token = await login(app, 'manager', 'manager123');
    const client = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', bearer(token))
      .send({ name: 'ООО «Повторы»', status: 'lead' })
      .expect(201);
    clientId = client.body.clientId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('по умолчанию активность одноразовая и следующая не создаётся', async () => {
    const created = await create({ subject: 'Разовая встреча' }).expect(201);
    expect(created.body.recurrence).toBeNull();
    expect(created.body.recurrenceUntil).toBeNull();

    await complete(created.body.activityId).expect(200);
    expect(await listForClient('Разовая встреча')).toHaveLength(1);
  });

  it('после выполнения создаёт следующую активность серии', async () => {
    const planned = inDays(2);
    const created = await create({
      subject: 'Планёрка по клиенту',
      plannedAt: planned,
      recurrence: 'weekly',
      comment: 'Подготовить отчёт',
    }).expect(201);
    expect(created.body.recurrence).toBe('weekly');

    const done = await complete(created.body.activityId).expect(200);
    expect(done.body.status).toBe('done');
    expect(done.body.result).toBe('Согласовали шаги');

    const series = (await listForClient('Планёрка по клиенту')).sort(
      (a, b) => a.activityId - b.activityId,
    );
    expect(series).toHaveLength(2);
    const next = series[1];
    expect(next.status).toBe('planned');
    expect(next.result).toBeNull();
    expect(next.doneAt).toBeNull();
    expect(next.recurrence).toBe('weekly');
    expect(next.comment).toBe('Подготовить отчёт');
    expect(next.ownerUserId).toBe(done.body.ownerUserId);
    expect(new Date(next.plannedAt).getTime()).toBe(
      new Date(planned).getTime() + 7 * day,
    );

    // Следующая тоже продолжает серию
    await complete(next.activityId).expect(200);
    expect(await listForClient('Планёрка по клиенту')).toHaveLength(3);
  });

  it('серия заканчивается, когда следующая дата за пределом', async () => {
    const created = await create({
      subject: 'Серия с пределом',
      plannedAt: inDays(1),
      recurrence: 'weekly',
      recurrenceUntil: inDays(4),
    }).expect(201);

    await complete(created.body.activityId).expect(200);
    expect(await listForClient('Серия с пределом')).toHaveLength(1);
  });

  it('при двух одновременных отметках следующая создаётся один раз', async () => {
    const created = await create({
      subject: 'Гонка отметок',
      recurrence: 'daily',
    }).expect(201);

    const [first, second] = await Promise.all([
      complete(created.body.activityId),
      complete(created.body.activityId),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 400]);
    expect(await listForClient('Гонка отметок')).toHaveLength(2);
  });

  it('отклоняет предел без повтора, предел раньше даты и неизвестное правило', async () => {
    await create({ recurrenceUntil: inDays(30) }).expect(400);
    await create({
      plannedAt: inDays(10),
      recurrence: 'weekly',
      recurrenceUntil: inDays(2),
    }).expect(400);
    await create({ recurrence: 'yearly' }).expect(400);
  });

  it('снятие повтора снимает и предел; изменение предела проверяется', async () => {
    const created = await create({
      subject: 'Правка серии',
      plannedAt: inDays(1),
      recurrence: 'daily',
      recurrenceUntil: inDays(20),
    }).expect(201);
    const id = created.body.activityId;

    // Предел раньше самой активности отклоняется, запись не меняется
    await request(app.getHttpServer())
      .patch(`/api/activities/${id}`)
      .set('Authorization', bearer(token))
      .send({ recurrenceUntil: inDays(-5) })
      .expect(400);

    const cleared = await request(app.getHttpServer())
      .patch(`/api/activities/${id}`)
      .set('Authorization', bearer(token))
      .send({ recurrence: null })
      .expect(200);
    expect(cleared.body.recurrence).toBeNull();
    expect(cleared.body.recurrenceUntil).toBeNull();

    await complete(id).expect(200);
    expect(await listForClient('Правка серии')).toHaveLength(1);
  });

  it('отмена активности серию не продолжает', async () => {
    const created = await create({
      subject: 'Отменяемая серия',
      recurrence: 'daily',
    }).expect(201);
    await request(app.getHttpServer())
      .patch(`/api/activities/${created.body.activityId}`)
      .set('Authorization', bearer(token))
      .send({ status: 'canceled' })
      .expect(200);
    expect(await listForClient('Отменяемая серия')).toHaveLength(1);
  });
});
