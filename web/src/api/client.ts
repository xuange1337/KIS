import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

/**
 * HTTP-клиент приложения.
 *
 * Access-токен живёт в памяти вкладки, refresh-токен — в httpOnly cookie,
 * поэтому при истечении короткого access-токена сессия продлевается
 * прозрачно для пользователя, а долгоживущий токен недоступен из JS.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

/** Вызывается, когда продлить сессию не удалось: приложение уходит на вход. */
export const setSessionExpiredHandler = (handler: () => void): void => {
  onSessionExpired = handler;
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

interface RetriableRequest extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

/** Общий запрос обновления, чтобы параллельные 401 не вызывали refresh дважды. */
let refreshRequest: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  if (!refreshRequest) {
    refreshRequest = axios
      .post<{ accessToken: string }>('/api/auth/refresh', null, {
        withCredentials: true,
      })
      .then((response) => {
        setAccessToken(response.data.accessToken);
        return response.data.accessToken;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetriableRequest | undefined;
    const isAuthRoute = request?.url?.includes('/auth/');

    if (error.response?.status === 401 && request && !request._retried && !isAuthRoute) {
      request._retried = true;
      try {
        const token = await refreshAccessToken();
        request.headers.Authorization = `Bearer ${token}`;
        return api(request);
      } catch {
        setAccessToken(null);
        onSessionExpired?.();
      }
    }
    return Promise.reject(error);
  },
);

/** Извлекает читаемое сообщение об ошибке из ответа сервера. */
export const extractErrorMessage = (
  error: unknown,
  fallback = 'Не удалось выполнить операцию',
): string => {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string | string[] })
      ?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
  }
  return fallback;
};

/**
 * Разбирает ошибку запроса, ответ которого запрашивался как Blob.
 *
 * Для выгрузок задаётся responseType: 'blob', поэтому при ошибке тело
 * приходит объектом Blob, а не JSON: сообщение сервера терялось и
 * пользователь всегда видел общий текст вместо конкретной причины.
 */
export const extractBlobErrorMessage = async (
  error: unknown,
  fallback = 'Не удалось выполнить операцию',
): Promise<string> => {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const parsed = JSON.parse(await readBlobAsText(error.response.data)) as {
        message?: string | string[];
      };
      if (Array.isArray(parsed.message)) return parsed.message.join('. ');
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {
      // Тело не JSON — остаётся общее сообщение
    }
  }
  return extractErrorMessage(error, fallback);
};

/**
 * Читает Blob как текст.
 * Blob.text() поддерживается не везде (старые версии Safari, jsdom),
 * поэтому при его отсутствии используется FileReader.
 */
const readBlobAsText = (blob: Blob): Promise<string> => {
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
};
