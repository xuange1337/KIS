import 'reflect-metadata';
import { writeFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './common/openapi';

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
  // Префикс задаётся так же, как в main.ts: иначе в спецификации окажутся
  // пути без /api, и сгенерированный клиент не попадёт ни в один маршрут
  app.setGlobalPrefix('api');
  const document = buildOpenApiDocument(app);
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
  // eslint-disable-next-line no-console
  console.log(`Спецификация сохранена: ${target}`);
}

void exportOpenApi();
