import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { requestContextMiddleware } from './middleware/request-context.middleware';

/**
 * Предел размера тела запроса.
 *
 * Формы CRM короткие, а явного предела не было: один запрос мог занять
 * память процесса, и вместо понятного 413 клиент получал обрыв соединения.
 */
export const BODY_LIMIT = process.env.BODY_LIMIT ?? '256kb';

/**
 * Настройка, общая для рабочего запуска и e2e-тестов.
 *
 * Раньше разбор cookie, валидация и префикс задавались в main.ts и
 * повторялись в test/setup.ts: тесты проверяли приложение, собранное
 * немного иначе, чем то, которое уходит в production.
 */
export const configureApp = (app: INestApplication): void => {
  app.setGlobalPrefix('api');
  // Идентификатор присваивается раньше разбора тела: иначе ответ об
  // ошибке разбора остаётся без идентификатора и не ищется в логах
  app.use(requestContextMiddleware);
  app.use(cookieParser());
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
};
