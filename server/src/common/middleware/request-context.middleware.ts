import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { requestContextStorage } from '../logging/request-context';

/** Заголовок сквозного идентификатора запроса. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Предел длины идентификатора, пришедшего снаружи. */
const MAX_INCOMING_ID_LENGTH = 128;

/** Допустимые символы внешнего идентификатора: он попадает в логи и заголовки. */
const SAFE_ID = /^[A-Za-z0-9._-]+$/;

/**
 * Присваивает каждому запросу идентификатор и кладёт его в контекст.
 *
 * Идентификатор из заголовка сохраняется, чтобы цепочку можно было собрать
 * от балансировщика до записи в логе; но он приходит снаружи, поэтому
 * принимается только короткая строка из безопасных символов — иначе в лог
 * попадали бы переводы строк и подделанные строки чужих запросов.
 */
export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const incoming = req.get(REQUEST_ID_HEADER);
  const requestId =
    typeof incoming === 'string' &&
    incoming.length <= MAX_INCOMING_ID_LENGTH &&
    SAFE_ID.test(incoming)
      ? incoming
      : randomUUID();

  res.setHeader(REQUEST_ID_HEADER, requestId);
  requestContextStorage.run({ requestId }, () => next());
};
