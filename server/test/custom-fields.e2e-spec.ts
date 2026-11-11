import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

describe('Пользовательские поля', () => {
  let app: INestApplication;
  let head: string;
  let manager: string;
  let other: string;
  let textId: number;
  let numberId: number;
  let selectId: number;
  let clientId: number;

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

  const define = (body: object, token = head) =>
    http().post('/api/custom-fields').set(as(token)).send(body);

  it('руководитель создаёт поля разных типов, менеджер — нет', async () => {
    textId = (
      await define({ entity: 'client', name: 'Сайт', type: 'text' }).expect(201)
    ).body.fieldId;
    numberId = (
      await define({
        entity: 'client',
        name: 'Сотрудников',
        type: 'number',
      }).expect(201)
    ).body.fieldId;
    selectId = (
      await define({
        entity: 'client',
        name: 'Сегмент',
        type: 'select',
        options: ['SMB', 'Enterprise'],
      }).expect(201)
    ).body.fieldId;
    await define(
      { entity: 'client', name: 'Чужое', type: 'text' },
      manager,
    ).expect(403);
  });

  it('проверяет уникальность названия и значения списка', async () => {
    await define({ entity: 'client', name: 'сайт', type: 'text' }).expect(409);
    await define({
      entity: 'client',
      name: 'Список',
      type: 'select',
      options: ['один'],
    }).expect(400);
    await define({ entity: 'client', name: 'Тип', type: 'color' }).expect(400);
  });

  it('сохраняет значения в карточке клиента и возвращает их', async () => {
    const created = await http()
      .post('/api/clients')
      .set(as(head))
      .send({
        name: 'Клиент с полями',
        customFields: {
          [textId]: 'example.com',
          [numberId]: '120',
          [selectId]: 'SMB',
        },
      })
      .expect(201);
    clientId = created.body.clientId;
    expect(created.body.customFields).toEqual({
      [textId]: 'example.com',
      [numberId]: 120,
      [selectId]: 'SMB',
    });
  });

  it('отклоняет неизвестные поля и значения неверного типа', async () => {
    const patch = (customFields: object) =>
      http()
        .patch(`/api/clients/${clientId}`)
        .set(as(head))
        .send({ customFields });
    await patch({ 999999: 'x' }).expect(400);
    await patch({ [numberId]: 'много' }).expect(400);
    await patch({ [selectId]: 'Другое' }).expect(400);
  });

  it('частичное обновление сохраняет остальные значения, пустое очищает поле', async () => {
    const updated = await http()
      .patch(`/api/clients/${clientId}`)
      .set(as(head))
      .send({ customFields: { [textId]: '' } })
      .expect(200);
    expect(updated.body.customFields[textId]).toBeUndefined();
    expect(updated.body.customFields[numberId]).toBe(120);
  });

  it('поля сделок живут отдельно, чужая организация их не видит', async () => {
    const field = (
      await define({
        entity: 'deal',
        name: 'Дата подписания',
        type: 'date',
      }).expect(201)
    ).body.fieldId;
    const deal = await http()
      .post('/api/deals')
      .set(as(head))
      .send({
        clientId,
        title: 'Сделка с полем',
        amount: 1,
        customFields: { [field]: '2026-12-01' },
      })
      .expect(201);
    expect(deal.body.customFields[field]).toBe('2026-12-01');
    await http()
      .patch(`/api/deals/${deal.body.dealId}`)
      .set(as(head))
      .send({ customFields: { [field]: '01.12.2026' } })
      .expect(400);
    const foreign = await http()
      .get('/api/custom-fields?entity=client')
      .set(as(other))
      .expect(200);
    expect(foreign.body).toEqual([]);
  });

  it('удаление поля убирает значения из карточек', async () => {
    await http()
      .delete(`/api/custom-fields/${numberId}`)
      .set(as(head))
      .expect(200);
    const card = await http()
      .get(`/api/clients/${clientId}`)
      .set(as(head))
      .expect(200);
    expect(card.body.customFields[numberId]).toBeUndefined();
    expect(card.body.customFields[selectId]).toBe('SMB');
  });
});
