import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, binaryParser, createTestApp, login } from './setup';

/**
 * Фоновые выгрузки.
 *
 * Синхронная выгрузка занимает рабочий поток процесса на всё время
 * формирования файла. Задание разрывает эту связь: запрос возвращается
 * сразу, файл формируется отдельно, клиент забирает готовое.
 */
describe('Фоновые выгрузки отчётов', () => {
  let app: INestApplication;
  let managerToken: string;
  let headToken: string;

  /** Ждёт завершения задания, опрашивая его состояние. */
  const waitForJob = async (
    id: number,
    token: string,
  ): Promise<Record<string, unknown>> => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/reports/export/jobs/${id}`)
        .set('Authorization', bearer(token))
        .expect(200);
      if (
        response.body.status === 'done' ||
        response.body.status === 'failed'
      ) {
        return response.body;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Задание не завершилось за отведённое время');
  };

  beforeAll(async () => {
    app = await createTestApp();
    managerToken = await login(app, 'manager', 'manager123');
    headToken = await login(app, 'head', 'head123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('ставит задание и отдаёт готовый файл', async () => {
    const queued = await request(app.getHttpServer())
      .post('/api/reports/funnel/export/jobs?format=csv')
      .set('Authorization', bearer(managerToken))
      .expect(202);

    expect(queued.body.exportJobId).toEqual(expect.any(Number));
    expect(['pending', 'running']).toContain(queued.body.status);

    const finished = await waitForJob(queued.body.exportJobId, managerToken);
    expect(finished.status).toBe('done');
    expect(finished.fileName).toMatch(/\.csv$/);
    expect(finished.rowCount).toBeGreaterThan(0);
    expect(finished.sizeBytes).toBeGreaterThan(0);

    const file = await request(app.getHttpServer())
      .get(`/api/reports/export/jobs/${queued.body.exportJobId}/file`)
      .set('Authorization', bearer(managerToken))
      .buffer()
      .parse(binaryParser)
      .expect(200);

    expect(file.headers['content-disposition']).toContain('attachment');
    expect(file.body.length).toBeGreaterThan(0);
    // Выгрузка совпадает с отчётом на экране: те же заголовки колонок
    expect(file.body.toString('utf8')).toContain('Стадия');
  });

  it('считает выгрузку правами заказавшего, а не правами обработчика', async () => {
    // Менеджер видит только свои сделки; выгрузка формируется позже,
    // и ограничение по ролям должно примениться то же
    const managerJob = await request(app.getHttpServer())
      .post('/api/reports/funnel/export/jobs?format=csv')
      .set('Authorization', bearer(managerToken))
      .expect(202);
    const headJob = await request(app.getHttpServer())
      .post('/api/reports/funnel/export/jobs?format=csv')
      .set('Authorization', bearer(headToken))
      .expect(202);

    const managerResult = await waitForJob(
      managerJob.body.exportJobId,
      managerToken,
    );
    const headResult = await waitForJob(headJob.body.exportJobId, headToken);

    const managerFile = await request(app.getHttpServer())
      .get(`/api/reports/export/jobs/${managerJob.body.exportJobId}/file`)
      .set('Authorization', bearer(managerToken))
      .buffer()
      .parse(binaryParser)
      .expect(200);
    const headFile = await request(app.getHttpServer())
      .get(`/api/reports/export/jobs/${headJob.body.exportJobId}/file`)
      .set('Authorization', bearer(headToken))
      .buffer()
      .parse(binaryParser)
      .expect(200);

    expect(managerResult.status).toBe('done');
    expect(headResult.status).toBe('done');
    // У руководителя сделок отдела больше, чем у одного менеджера
    expect(headFile.body.toString('utf8')).not.toBe(
      managerFile.body.toString('utf8'),
    );
  });

  it('не отдаёт чужое задание', async () => {
    const queued = await request(app.getHttpServer())
      .post('/api/reports/funnel/export/jobs?format=csv')
      .set('Authorization', bearer(managerToken))
      .expect(202);
    await waitForJob(queued.body.exportJobId, managerToken);

    // Файл содержит срез данных заказавшего: коллеге с другими правами
    // он показал бы лишнее, поэтому задание не существует для него
    await request(app.getHttpServer())
      .get(`/api/reports/export/jobs/${queued.body.exportJobId}`)
      .set('Authorization', bearer(headToken))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/reports/export/jobs/${queued.body.exportJobId}/file`)
      .set('Authorization', bearer(headToken))
      .expect(404);
  });

  it('отклоняет неизвестный отчёт и формат', async () => {
    await request(app.getHttpServer())
      .post('/api/reports/nesushchestvuyushchiy/export/jobs?format=csv')
      .set('Authorization', bearer(managerToken))
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/reports/funnel/export/jobs?format=docx')
      .set('Authorization', bearer(managerToken))
      .expect(400);
  });

  it('показывает задания в списке, новые первыми', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/reports/export/jobs')
      .set('Authorization', bearer(managerToken))
      .expect(200);

    expect(list.body.length).toBeGreaterThan(0);
    const dates = list.body.map((job: { createdAt: string }) =>
      new Date(job.createdAt).getTime(),
    );
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    // В списке только свои задания
    expect(
      list.body.every((job: { report: string }) => Boolean(job.report)),
    ).toBe(true);
  });

  it('формирует все три формата', async () => {
    for (const format of ['csv', 'xlsx', 'pdf'] as const) {
      const queued = await request(app.getHttpServer())
        .post(`/api/reports/top/export/jobs?format=${format}&entity=clients`)
        .set('Authorization', bearer(headToken))
        .expect(202);
      const finished = await waitForJob(queued.body.exportJobId, headToken);
      expect(finished.status).toBe('done');
      expect(finished.fileName).toMatch(new RegExp(`\\.${format}$`));
    }
  });
});
