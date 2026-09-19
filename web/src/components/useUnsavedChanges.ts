import { useCallback, useEffect, useState } from 'react';

/**
 * Защита несохранённых изменений формы.
 *
 * Форма клиента или сделки — это десяток полей, и закрыть её случайно
 * легко: Esc вместо Tab, «Отмена» вместо «Сохранить», закрытая вкладка.
 * Введённое пропадало молча, и восстановить его было неоткуда.
 *
 * Пока изменений нет, ничего не происходит: подтверждение на каждое
 * закрытие раздражает сильнее, чем помогает.
 */
export function useUnsavedChanges(isDirty: boolean, onClose: () => void) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  /**
   * Закрытие вкладки и перезагрузка страницы.
   * Браузер показывает своё окно; текст задать нельзя, но сам вопрос
   * важнее текста.
   */
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /** Закрытие формы: с изменениями — через подтверждение. */
  const requestClose = useCallback(() => {
    if (isDirty) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  const discard = useCallback(() => {
    setConfirmOpen(false);
    onClose();
  }, [onClose]);

  const keepEditing = useCallback(() => setConfirmOpen(false), []);

  return { requestClose, confirmOpen, discard, keepEditing };
}
