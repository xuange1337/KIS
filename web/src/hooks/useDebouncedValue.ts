import { useEffect, useState } from 'react';

/**
 * Откладывает применение значения на заданную паузу.
 * Используется полями поиска, чтобы не отправлять запрос на каждый символ.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
