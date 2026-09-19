import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** Версия контракта API; меняется при несовместимых изменениях. */
export const API_VERSION = '1.0.0';

/**
 * Описание API в формате OpenAPI.
 *
 * Спецификация собирается из уже существующих контроллеров и DTO, поэтому
 * не расходится с кодом: интеграторам не нужно сверять README с реальным
 * поведением, а генераторы клиентов работают без ручного описания.
 */
export const buildOpenApiDocument = (app: INestApplication): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle('CRM API')
    .setDescription(
      'API АРМ менеджера по работе с клиентами. ' +
        'Все маршруты требуют access-токена, кроме входа, обновления ' +
        'токена и проверок состояния. Ошибки возвращаются единым форматом: ' +
        'statusCode, code, message, path, requestId, timestamp. ' +
        'Каждый маршрут описан дважды: с версией (/api/v1/...) и без неё. ' +
        'Версионный путь — основной, путь без версии сохранён для ранее ' +
        'написанных клиентов и будет объявлен устаревшим отдельно. ' +
        'Операции создания принимают заголовок Idempotency-Key: повтор ' +
        'с тем же ключом возвращает результат первой попытки.',
    )
    .setVersion(API_VERSION)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addCookieAuth(
      'crm_refresh',
      { type: 'apiKey', in: 'cookie' },
      'refresh-cookie',
    )
    .addTag('auth', 'Вход, обновление токена и сессии')
    .addTag('clients', 'Клиенты и контакты')
    .addTag('deals', 'Сделки и история стадий')
    .addTag('activities', 'Звонки, встречи и письма')
    .addTag('offers', 'Коммерческие предложения')
    .addTag('reports', 'Отчёты и выгрузки')
    .addTag('users', 'Пользователи и роли')
    .addTag('health', 'Проверки состояния')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  /**
   * Токен требуется по умолчанию для всех маршрутов: их закрывает
   * глобальный guard, а исключения (@Public) перечислены в описании.
   * Описывать это декоратором на каждом контроллере — значит завести
   * второй источник правды, который рано или поздно разойдётся с кодом.
   */
  document.security = [{ 'access-token': [] }];
  return document;
};

/**
 * Публикует спецификацию и интерфейс просмотра.
 * В production выключается переменной OPENAPI_ENABLED=false, если
 * развёртывание не должно раскрывать структуру API анонимно.
 */
export const setupOpenApi = (app: INestApplication): void => {
  if (process.env.OPENAPI_ENABLED === 'false') {
    return;
  }
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app), {
    jsonDocumentUrl: 'api/docs/openapi.json',
    swaggerOptions: { persistAuthorization: true },
  });
};
