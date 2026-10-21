import { useState } from 'react';
import { api, extractErrorMessage } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAuth } from '../auth/AuthContext';

/** Выход из текущей организации. Учётная запись остаётся. */
export function LeaveOrganizationDialog({ onClose }: { onClose: () => void }) {
  const { organization, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/organizations/current/leave');
      // Сеансы в этой организации закрыты сервером: возвращаем на вход
      await logout();
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось выйти из организации'));
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open
      title="Покинуть организацию?"
      message={
        error ??
        `Вы потеряете доступ к «${organization?.name ?? ''}». Вернуться можно только по новому приглашению. Владелец организации выйти не может — сначала он передаёт владение.`
      }
      confirmLabel="Покинуть"
      loading={busy}
      onConfirm={() => void leave()}
      onCancel={onClose}
    />
  );
}
