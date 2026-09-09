import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';

/**
 * Проверка ограничения частоты попыток входа (регрессия на подбор паролей).
 *
 * Сьют поднимает приложение с включённым ограничителем, поэтому AppModule
 * загружается динамически — уже после снятия переменной, которой остальные
 * тесты этот ограничитель отключают. Отдельный файл нужен и потому, что два
 * приложения в одном файле делят подключение к БД: закрытие одного обрывает
 * запросы другого.
 */
describe('Ограничение частоты попыток входа', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env.RATE_LIMIT_DISABLED;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppModule } = require('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('после пяти неудачных попыток вход отвечает 429', async () => {
    const codes: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: 'manager', password: 'неверный' });
      codes.push(response.status);
    }

    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    // Дальнейшие попытки отсекаются до обращения к базе и расчёта bcrypt
    expect(codes.slice(5)).toEqual([429, 429]);
  });

  it('ограничение распространяется и на верный пароль', async () => {
    // Иначе подбор можно было бы продолжать, чередуя запросы
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'manager', password: 'manager123' });
    expect(response.status).toBe(429);
  });
});
