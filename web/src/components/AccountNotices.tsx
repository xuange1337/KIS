import { Alert, Button, Stack } from '@mui/material';
import { OrganizationStatus } from '@crm/shared';
import { useState } from 'react';
import { api, extractErrorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { daysUntil, formatDate } from './formatters';

/**
 * Уведомления о состоянии учётной записи и организации.
 *
 * Показываются над содержимым любой страницы: пробный период и
 * блокировка записи касаются всей работы, а не одного раздела.
 */
export function AccountNotices() {
  const { user, organization } = useAuth();
  const [resent, setResent] = useState<'idle' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!user || !organization) return null;

  const resend = async () => {
    setError(null);
    try {
      await api.post('/auth/email/resend');
      setResent('sent');
    } catch (caught) {
      setResent('error');
      setError(extractErrorMessage(caught, 'Не удалось отправить письмо'));
    }
  };

  const suspended = organization.status === OrganizationStatus.SUSPENDED;
  const closed = organization.status === OrganizationStatus.CLOSED;
  const onTrial =
    organization.status === OrganizationStatus.TRIAL &&
    organization.trialEndsAt;
  const unverified = Boolean(user.email) && !user.emailVerified;

  if (!suspended && !closed && !onTrial && !unverified) return null;

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      {(suspended || closed) && (
        <Alert severity="error">
          {closed
            ? 'Организация закрыта.'
            : 'Доступ ограничен: данные доступны для просмотра и выгрузки, вносить изменения нельзя.'}
        </Alert>
      )}
      {onTrial && organization.trialEndsAt && (
        <Alert severity="info">
          Пробный период до {formatDate(organization.trialEndsAt)}, осталось
          дней: {Math.max(daysUntil(organization.trialEndsAt), 0)}.
        </Alert>
      )}
      {unverified && (
        <Alert
          severity="warning"
          action={
            resent === 'sent' ? undefined : (
              <Button
                color="inherit"
                size="small"
                onClick={() => void resend()}
              >
                Отправить письмо снова
              </Button>
            )
          }
        >
          {resent === 'sent'
            ? `Письмо отправлено на ${user.email}.`
            : `Подтвердите адрес ${user.email}: без этого нельзя приглашать сотрудников и восстанавливать пароль.`}
          {error && ` ${error}`}
        </Alert>
      )}
    </Stack>
  );
}
