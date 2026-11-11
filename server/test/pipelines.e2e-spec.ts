import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

describe('Воронки продаж', () => {
  let app: INestApplication;
  let head: string;
  let manager: string;
  let other: string;
  let mainId: number;
  let smallId: number;
  let clientId: number;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: bearer(token) });

  beforeAll(async () => {
    app = await createTestApp();
    head = await login(app, 'head', 'head123');
    manager = await login(app, 'manager', 'manager123');
    other = await login(app, 'other-admin', 'other123');
    const clients = await http()
      .get('/api/clients?limit=1')
      .set(as(head))
      .expect(200);
    clientId = clients.body.items[0].clientId;
  });
  afterAll(async () => {
    await app.close();
  });

  it('основная воронка есть у каждой организации и содержит все стадии', async () => {
    const list = await http()
      .get('/api/pipelines')
      .set(as(manager))
      .expect(200);
    const main = list.body.find((p: { isDefault: boolean }) => p.isDefault);
    mainId = main.pipelineId;
    expect(main.stages).toEqual([
      'new',
      'qualification',
      'proposal',
      'negotiation',
      'won',
      'lost',
    ]);
  });

  it('руководитель создаёт короткую воронку, терминальные стадии добавляются сами', async () => {
    const created = await http()
      .post('/api/pipelines')
      .set(as(head))
      .send({ name: 'Быстрые продажи', stages: ['new', 'proposal'] })
      .expect(201);
    smallId = created.body.pipelineId;
    expect(created.body.stages).toEqual(['new', 'proposal', 'won', 'lost']);
    await http()
      .post('/api/pipelines')
      .set(as(manager))
      .send({ name: 'Менеджерская', stages: ['new'] })
      .expect(403);
    await http()
      .post('/api/pipelines')
      .set(as(head))
      .send({ name: 'быстрые продажи', stages: ['new'] })
      .expect(409);
    await http()
      .post('/api/pipelines')
      .set(as(head))
      .send({ name: 'Плохая', stages: ['won'] })
      .expect(400);
  });

  it('сделка берёт стадии своей воронки', async () => {
    const deal = await http()
      .post('/api/deals')
      .set(as(head))
      .send({
        clientId,
        title: 'Быстрая сделка',
        amount: 10,
        pipelineId: smallId,
      })
      .expect(201);
    expect(deal.body.pipelineId).toBe(smallId);
    await http()
      .post('/api/deals')
      .set(as(head))
      .send({
        clientId,
        title: 'Не та стадия',
        amount: 10,
        pipelineId: smallId,
        stage: 'negotiation',
      })
      .expect(400);
    await http()
      .patch(`/api/deals/${deal.body.dealId}/stage`)
      .set(as(head))
      .send({ stage: 'qualification' })
      .expect(400);
    await http()
      .patch(`/api/deals/${deal.body.dealId}/stage`)
      .set(as(head))
      .send({ stage: 'proposal' })
      .expect(200);
  });

  it('список сделок фильтруется по воронке', async () => {
    const small = await http()
      .get(`/api/deals?pipelineId=${smallId}`)
      .set(as(head))
      .expect(200);
    expect(small.body.total).toBe(1);
    const main = await http()
      .get(`/api/deals?pipelineId=${mainId}&limit=200`)
      .set(as(head))
      .expect(200);
    expect(
      main.body.items.some(
        (d: { title: string }) => d.title === 'Быстрая сделка',
      ),
    ).toBe(false);
    expect(main.body.total).toBeGreaterThan(5);
  });

  it('перенос сделки в воронку без её стадии отклоняется, с подходящей — проходит', async () => {
    const deal = await http()
      .post('/api/deals')
      .set(as(head))
      .send({ clientId, title: 'Переезд', amount: 1, stage: 'negotiation' })
      .expect(201);
    await http()
      .patch(`/api/deals/${deal.body.dealId}`)
      .set(as(head))
      .send({ pipelineId: smallId })
      .expect(400);
    const moved = await http()
      .patch(`/api/deals/${deal.body.dealId}/stage`)
      .set(as(head))
      .send({ stage: 'new' })
      .expect(200);
    expect(moved.body.stage).toBe('new');
    const ok = await http()
      .patch(`/api/deals/${deal.body.dealId}`)
      .set(as(head))
      .send({ pipelineId: smallId })
      .expect(200);
    expect(ok.body.pipelineId).toBe(smallId);
  });

  it('нельзя убрать стадию, на которой есть сделки, и удалить воронку со сделками', async () => {
    await http()
      .patch(`/api/pipelines/${smallId}`)
      .set(as(head))
      .send({ stages: ['new'] })
      .expect(409);
    await http().delete(`/api/pipelines/${smallId}`).set(as(head)).expect(409);
    await http().delete(`/api/pipelines/${mainId}`).set(as(head)).expect(400);
  });

  it('пустую воронку можно переименовать и удалить; чужая организация её не видит', async () => {
    const extra = await http()
      .post('/api/pipelines')
      .set(as(head))
      .send({ name: 'Временная', stages: ['new'] })
      .expect(201);
    const renamed = await http()
      .patch(`/api/pipelines/${extra.body.pipelineId}`)
      .set(as(head))
      .send({ name: 'Временная 2' })
      .expect(200);
    expect(renamed.body.name).toBe('Временная 2');
    const foreign = await http()
      .get('/api/pipelines')
      .set(as(other))
      .expect(200);
    expect(
      foreign.body.some(
        (p: { pipelineId: number }) => p.pipelineId === smallId,
      ),
    ).toBe(false);
    await http()
      .delete(`/api/pipelines/${extra.body.pipelineId}`)
      .set(as(head))
      .expect(200);
  });
});
