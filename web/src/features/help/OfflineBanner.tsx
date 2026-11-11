import { Alert } from '@mui/material';
import { useEffect, useState } from 'react';

/**
 * Сообщает о потере соединения. Без него неудавшееся сохранение выглядит
 * как поломка формы, хотя причина — пропавшая сеть.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (online) return null;
  return (
    <Alert severity="warning" role="status" sx={{ borderRadius: 0 }}>
      Нет соединения с интернетом. Введённые данные не сохранятся, пока связь не
      восстановится
    </Alert>
  );
}
