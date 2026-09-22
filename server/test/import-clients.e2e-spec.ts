import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, login } from './setup';

/**
 * Импорт клиентской базы.
 *
 * Опасность у импорта одна: молча создать сотню дублей или наполовину
 * загрузить кривой файл. Поэтому шага два — предпросмотр без единой
 * записи в базу и загрузка одной транзакцией.
 */
describe('Импорт клиентов из файла', () => {
  let app: INestApplication;
  let headToken: string;
  let managerToken: string;
  const created: number[] = [];

  const csv = (lines: string[]): Buffer =>
    Buffer.from(lines.join('\n'), 'utf8');

  const preview = (file: Buffer, name = 'clients.csv', token = headToken) =>
    request(app.getHttpServer())
      .post('/api/clients/import/preview')
      .set('Authorization', bearer(token))
      .attach('file', file, name);

  const rememberCreated = async (names: string[]): Promise<void> => {
    for (const name of names) {
      const found = await request(app.getHttpServer())
        .get(`/api/clients?q=${encodeURIComponent(name)}&limit=5`)
        .set('Authorization', bearer(headToken));
      for (const client of found.body.items ?? []) {
        created.push(client.clientId);
      }
    }
  };

  beforeAll(async () => {
    app = await createTestApp();
    headToken = await login(app, 'head', 'head123');
    managerToken = await login(app, 'manager', 'manager123');
  });

  afterAll(async () => {
    for (const clientId of created) {
      await request(app.getHttpServer())
        .delete(`/api/clients/${clientId}?force=true`)
        .set('Authorization', bearer(headToken));
    }
    await app.close();
  });

  it('распознаёт колонки по русским заголовкам и проверяет строки', async () => {
    const response = await preview(
      csv([
        'Наименование;ИНН;Отрасль;Статус;Источник;Адрес',
        'ООО «Импорт Первый»;7701111111;Строительство;В работе;Сайт;Москва',
        'ООО «Импорт Второй»;;ИТ и телеком;;;',
      ]),
    ).expect(201);

    // Выгрузка из другой системы приходит с заголовками на русском:
    // требовать переименования колонок — значит заставить править файл
    expect(response.body.columns.name).toBe('Наименование');
    expect(response.body.columns.inn).toBe('ИНН');
    expect(response.body.validCount).toBe(2);
    expect(response.body.errorCount).toBe(0);
    expect(response.body.rows[0].status).toBe('in_work');
    expect(response.body.rows[0].source).toBe('website');
  });

  it('собирает все ошибки строки сразу и не пишет в базу', async () => {
    const response = await preview(
      csv([
        'Наименование,ИНН,Статус',
        'О,123,Неизвестный',
        'ООО «Нормальный Импорт»,7702222222,Лид',
      ]),
    ).expect(201);

    const bad = response.body.rows[0];
    // Исправлять ошибки по одной — это N загрузок файла
    expect(bad.errors.length).toBeGreaterThanOrEqual(3);
    expect(response.body.validCount).toBe(1);

    const search = await request(app.getHttpServer())
      .get('/api/clients?q=Нормальный Импорт&limit=5')
      .set('Authorization', bearer(headToken))
      .expect(200);
    expect(search.body.items).toHaveLength(0);
  });

  it('находит дубли внутри файла и уже заведённых клиентов', async () => {
    const response = await preview(
      csv([
        'Наименование;ИНН',
        'ООО «Дубль»;7703333333',
        'ООО «Дубль-2»;7703333333',
        'ООО «ЦифраСофт»;',
      ]),
    ).expect(201);

    expect(response.body.rows[1].errors.join(' ')).toContain('Дубль ИНН');
    // Клиент уже есть в базе — загружать второй раз незачем
    expect(response.body.rows[2].errors.join(' ')).toContain('уже есть в базе');
  });

  it('загружает только отобранные строки одной операцией', async () => {
    const parsed = await preview(
      csv([
        'Наименование;ИНН;Статус',
        'ООО «Загруженный Первый»;7704444444;Действующий',
        'ООО «Загруженный Второй»;7705555555;Лид',
      ]),
    ).expect(201);

    const result = await request(app.getHttpServer())
      .post('/api/clients/import')
      .set('Authorization', bearer(headToken))
      .send({ rows: parsed.body.rows })
      .expect(201);

    expect(result.body.created).toBe(2);
    expect(result.body.skipped).toBe(0);
    await rememberCreated(['Загруженный Первый', 'Загруженный Второй']);

    const search = await request(app.getHttpServer())
      .get('/api/clients?q=Загруженный&limit=10')
      .set('Authorization', bearer(headToken))
      .expect(200);
    expect(search.body.items.length).toBe(2);
    expect(search.body.items[0].status).toBeDefined();
  });

  it('проверяет строки заново при загрузке', async () => {
    // Предпросмотр — удобство, а не источник доверия: между ним и
    // загрузкой в базе мог появиться клиент с тем же ИНН
    const result = await request(app.getHttpServer())
      .post('/api/clients/import')
      .set('Authorization', bearer(headToken))
      .send({
        rows: [
          { line: 2, name: 'ООО «Загруженный Первый»', inn: '7704444444' },
          { line: 3, name: 'ООО «Совсем Новый Импорт»', inn: '7706666666' },
        ],
      })
      .expect(201);

    expect(result.body.created).toBe(1);
    expect(result.body.skipped).toBe(1);
    expect(result.body.errors[0].errors.join(' ')).toContain('уже есть');
    await rememberCreated(['Совсем Новый Импорт']);
  });

  it('не даёт загружать менеджеру', async () => {
    await preview(
      csv(['Наименование', 'ООО «Менеджерский импорт»']),
      'clients.csv',
      managerToken,
    ).expect(400);

    await request(app.getHttpServer())
      .post('/api/clients/import')
      .set('Authorization', bearer(managerToken))
      .send({ rows: [{ line: 2, name: 'ООО «Менеджерский импорт»' }] })
      .expect(400);
  });

  it('отклоняет файл без колонки наименования и чужой формат', async () => {
    await preview(csv(['ИНН;Адрес', '7700000000;Москва'])).expect(400);
    await preview(csv(['Наименование', 'ООО «Тест»']), 'clients.txt').expect(
      400,
    );
  });
});
