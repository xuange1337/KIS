import 'reflect-metadata';
import { writeFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './common/openapi';
import { configureApp } from './common/app-setup';

/**
 * Выгружает спецификацию API в файл.
 *
 * Спецификация хранится в репозитории, чтобы изменения контракта были
 * видны в ревью: молчаливое переименование поля иначе замечает только
 * интегратор и уже в production.
 */
async function exportOpenApi(): Promise<void> {
  const target = process.argv[2] ?? 'docs/openapi.json';
  const app = await NestFactory.create(AppModule, { logger: false });
  // Приложение настраивается так же, как при запуске: иначе в
  // спецификации окажутся пути без префикса и без версии, и
  // сгенерированный клиент не попадёт ни в один маршрут
  configureApp(app);
  const document = buildOpenApiDocument(app);
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
  // eslint-disable-next-line no-console
  console.log(`Спецификация сохранена: ${target}`);
}

void exportOpenApi();
