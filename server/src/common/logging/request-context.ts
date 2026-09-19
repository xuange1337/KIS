import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  /** Сквозной идентификатор запроса. */
  requestId: string;
  /** Пользователь, если запрос уже прошёл проверку токена. */
  userId?: number;
}

/**
 * Хранилище контекста запроса.
 *
 * Идентификатор нужен и в логах контроллера, и в логе ошибки, и в теле
 * ответа. Протаскивать его параметром через каждый сервис невозможно,
 * поэтому он живёт в AsyncLocalStorage — на всё время обработки запроса.
 */
export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export const currentRequestContext = (): RequestContext | undefined =>
  requestContextStorage.getStore();

export const currentRequestId = (): string | undefined =>
  requestContextStorage.getStore()?.requestId;
