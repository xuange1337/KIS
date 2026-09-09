import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { extractBlobErrorMessage, extractErrorMessage } from './client';

/** Собирает ошибку axios с заданным телом ответа. */
const axiosErrorWith = (data: unknown): AxiosError => {
  const error = new AxiosError('Request failed');
  error.response = {
    data,
    status: 400,
    statusText: 'Bad Request',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
};

describe('Извлечение сообщения об ошибке', () => {
  it('берёт текст из ответа сервера', () => {
    expect(axiosErrorWith({ message: 'Сумма слишком велика' })).toBeDefined();
    expect(
      extractErrorMessage(axiosErrorWith({ message: 'Сумма слишком велика' })),
    ).toBe('Сумма слишком велика');
  });

  it('склеивает список ошибок валидации', () => {
    expect(
      extractErrorMessage(
        axiosErrorWith({ message: ['Укажите логин', 'Укажите пароль'] }),
      ),
    ).toBe('Укажите логин. Укажите пароль');
  });

  it('возвращает запасной текст, если сервер ничего не пояснил', () => {
    expect(extractErrorMessage(new Error('сеть'), 'Запасной текст')).toBe(
      'Запасной текст',
    );
  });
});

describe('Извлечение сообщения из ответа-Blob', () => {
  it('читает текст ошибки из тела выгрузки', async () => {
    // Выгрузки запрашиваются как Blob, поэтому сообщение сервера
    // приходило нечитаемым объектом и всегда подменялось общим текстом
    const blob = new Blob(
      [JSON.stringify({ message: 'Неподдерживаемый формат выгрузки: doc' })],
      { type: 'application/json' },
    );

    await expect(extractBlobErrorMessage(axiosErrorWith(blob))).resolves.toBe(
      'Неподдерживаемый формат выгрузки: doc',
    );
  });

  it('возвращает запасной текст, если тело не JSON', async () => {
    const blob = new Blob(['<html>ошибка шлюза</html>'], { type: 'text/html' });

    await expect(
      extractBlobErrorMessage(axiosErrorWith(blob), 'Не удалось сформировать выгрузку'),
    ).resolves.toBe('Не удалось сформировать выгрузку');
  });

  it('обрабатывает обычный JSON-ответ так же, как и раньше', async () => {
    await expect(
      extractBlobErrorMessage(axiosErrorWith({ message: 'Доступ запрещён' })),
    ).resolves.toBe('Доступ запрещён');
  });
});
