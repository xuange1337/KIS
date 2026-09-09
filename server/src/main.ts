import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configuration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const config = configuration();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // За nginx все запросы приходят с адреса контейнера-прокси. Без доверия
  // к X-Forwarded-For ограничение частоты считалось бы общим на всех
  // пользователей сразу: неудачные попытки входа одного блокировали бы вход
  // остальным. Доверяем ровно одному прокси — своему.
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api');
  // Заголовки безопасности на уровне API: статику закрывает nginx,
  // но API доступен и напрямую (порт 3000 в разработке)
  app.use(
    helmet({
      // Политику содержимого задаёт nginx для страницы; API отдаёт только JSON
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // В разработке клиент поднимается отдельно на Vite-порту;
  // в production оба контейнера за одним nginx, и CORS не нужен
  if (config.nodeEnv !== 'production') {
    app.enableCors({ origin: true, credentials: true });
  }

  await app.listen(config.apiPort, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`API запущен на порту ${config.apiPort}`);
}

void bootstrap();
