import { NextFunction, Request, Response } from 'express';
import { httpDuration, httpRequests } from './metrics.registry';

/**
 * Учёт запросов.
 *
 * Маршрут берётся из шаблона (`/api/clients/:id`), а не из фактического
 * пути: иначе каждый идентификатор порождал бы отдельный ряд метрик.
 * Не найденные маршруты сводятся в одну метку, чтобы сканер,
 * перебирающий адреса, не раздувал память.
 */
export const metricsMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  const startedAt = process.hrtime.bigint();
  response.on('finish', () => {
    const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    const route: string = request.route?.path
      ? `${request.baseUrl ?? ''}${request.route.path}`
      : 'unmatched';
    // Сами метрики и проверки живости не учитываются: опрос раз в
    // несколько секунд забил бы статистику собственным шумом
    if (route.startsWith('/api/metrics') || route.startsWith('/api/health')) {
      return;
    }
    const labels = { method: request.method, route };
    httpRequests.inc({ ...labels, status: String(response.statusCode) });
    httpDuration.observe(labels, seconds);
  });
  next();
};
