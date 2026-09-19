import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configureApp } from './common/app-setup';
import { configuration } from './config/configuration';
import { JsonLogger } from './common/logging/json.logger';
import { setupOpenApi } from './common/openapi';

async function bootstrap(): Promise<void> {
  const config = configuration();
  const isProduction = config.nodeEnv === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // В production логи собираются машиной, в разработке читаются человеком
    logger: isProduction ? new JsonLogger() : undefined,
  });

  // За nginx все запросы приходят с адреса контейнера-прокси. Без доверия
  // к X-Forwarded-For ограничение частоты считалось бы общим на всех
  // пользователей сразу: неудачные попытки входа одного блокировали бы вход
  // остальным. Доверяем ровно одному прокси — своему.
  app.set('trust proxy', 1);

  // Заголовки безопасности на уровне API: статику закрывает nginx,
  // но API доступен и напрямую (порт 3000 в разработке)
  app.use(
    helmet({
      // Политику содержимого задаёт nginx для страницы; API отдаёт только JSON
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  configureApp(app);

  // В разработке клиент поднимается отдельно на Vite-порту;
  // в production оба контейнера за одним nginx, и CORS не нужен
  if (!isProduction) {
    app.enableCors({ origin: true, credentials: true });
  }

  setupOpenApi(app);

  await app.listen(config.apiPort, '0.0.0.0');
  // Через логгер, а не console.log: иначе единственная строка о старте
  // выпадает из структурированного вывода и теряется в сборщике логов
  new Logger('Bootstrap').log(`API запущен на порту ${config.apiPort}`);
}

void bootstrap();
