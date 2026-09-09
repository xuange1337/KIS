import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request, { Response } from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Общая подготовка приложения для e2e-тестов.
 * Тесты работают с отдельной базой crm_test, которая пересоздаётся и
 * наполняется в test/global-setup.ts перед каждым прогоном, поэтому
 * могут свободно создавать и удалять записи.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

/** Авторизуется и возвращает access-токен для указанной учётной записи. */
export async function login(
  app: INestApplication,
  loginName: string,
  password: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ login: loginName, password })
    .expect(200);
  return response.body.accessToken;
}

export const bearer = (token: string): string => `Bearer ${token}`;

/**
 * Собирает тело ответа в Buffer без разбора.
 * Нужен для проверки выгрузок: по умолчанию supertest пытается распарсить
 * text/csv и xlsx как текст или JSON и портит бинарное содержимое.
 */
export const binaryParser = (
  res: Response,
  callback: (error: Error | null, body: Buffer) => void,
): void => {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
  stream.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
};
