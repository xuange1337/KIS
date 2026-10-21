import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import {
  MemberDto,
  ORGANIZATION_STATUS_LABELS,
  OrganizationDto,
  OrganizationStatus,
  USER_ROLE_LABELS,
  UserRole,
} from '@crm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, extractErrorMessage } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { formatDate } from '../components/formatters';
import { useAuth } from '../features/auth/AuthContext';
import { PasswordActionDialog } from '../features/organization/PasswordActionDialog';

/**
 * Экран «Организация»: состав, владение, выгрузка данных, закрытие.
 *
 * Доступен администратору. Действия владельца показываются только ему:
 * остальным администраторам сервер всё равно ответит отказом, а кнопка,
 * которая не работает, хуже её отсутствия.
 */
export function OrganizationPage() {
  const { user, reloadSession } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberDto | null>(null);
  const [transferTarget, setTransferTarget] = useState<MemberDto | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);

  const organization = useQuery({
    queryKey: ['organization'],
    queryFn: async () =>
      (await api.get<OrganizationDto>('/organizations/current')).data,
  });
  const members = useQuery({
    queryKey: ['organization-members'],
    queryFn: async () =>
      (await api.get<MemberDto[]>('/organizations/current/members')).data,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['organization'] }),
      queryClient.invalidateQueries({ queryKey: ['organization-members'] }),
    ]);
  };

  const action = useMutation({
    mutationFn: async (request: () => Promise<unknown>) => request(),
    onSuccess: refresh,
    onError: (caught) => setError(extractErrorMessage(caught)),
  });

  const org = organization.data;
  const isOwner = Boolean(org && user && org.ownerUserId === user.userId);
  const closed = org?.status === OrganizationStatus.CLOSED;

  const exportData = async () => {
    setError(null);
    try {
      const response = await api.get('/organizations/current/export', {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `organization-${org?.organizationId ?? 'export'}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось выгрузить данные'));
    }
  };

  return (
    <Box>
      <PageHeader
        title="Организация"
        subtitle={org ? org.name : undefined}
        actions={
          <Button variant="outlined" onClick={() => void exportData()}>
            Выгрузить данные
          </Button>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {org && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Chip
            size="small"
            label={ORGANIZATION_STATUS_LABELS[org.status]}
            color={closed ? 'error' : 'default'}
          />
          <Typography variant="body2" color="text.secondary">
            Создана {formatDate(org.createdAt)}, участников: {org.memberCount}
          </Typography>
        </Stack>
      )}

      {closed && org?.purgeAt && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            isOwner ? (
              <Button
                color="inherit"
                size="small"
                onClick={() =>
                  action.mutate(async () => {
                    await api.post('/organizations/current/reopen');
                    await reloadSession();
                  })
                }
              >
                Вернуть организацию
              </Button>
            ) : undefined
          }
        >
          Организация закрыта. Данные будут удалены безвозвратно{' '}
          {formatDate(org.purgeAt)}; до этого их можно выгрузить.
        </Alert>
      )}

      <Typography variant="overline">Участники</Typography>
      <Paper variant="outlined" sx={{ mb: 4, overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Сотрудник</TableCell>
              <TableCell>Почта</TableCell>
              <TableCell>Роль</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(members.data ?? []).map((member) => {
              const self = member.userId === user?.userId;
              return (
                <TableRow key={member.userId}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{member.fullName}</span>
                      {member.isOwner && (
                        <Chip size="small" color="primary" label="Владелец" />
                      )}
                      {!member.isActive && (
                        <Chip size="small" label="Заблокирован" />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {member.login}
                    </Typography>
                  </TableCell>
                  <TableCell>{member.email ?? '—'}</TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={member.role}
                      disabled={member.isOwner || self || closed}
                      inputProps={{
                        'aria-label': `Роль: ${member.fullName}`,
                      }}
                      onChange={(event) =>
                        action.mutate(() =>
                          api.patch(
                            `/organizations/current/members/${member.userId}`,
                            { role: event.target.value },
                          ),
                        )
                      }
                    >
                      {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map(
                        (role) => (
                          <MenuItem key={role} value={role}>
                            {USER_ROLE_LABELS[role]}
                          </MenuItem>
                        ),
                      )}
                    </Select>
                  </TableCell>
                  <TableCell align="right">
                    {isOwner &&
                      !member.isOwner &&
                      member.isActive &&
                      !closed && (
                        <Tooltip title="Сделать владельцем">
                          <IconButton
                            aria-label={`Сделать владельцем: ${member.fullName}`}
                            onClick={() => setTransferTarget(member)}
                          >
                            <SwapHorizOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    {!member.isOwner && !self && !closed && (
                      <Tooltip title="Исключить из организации">
                        <IconButton
                          aria-label={`Исключить: ${member.fullName}`}
                          onClick={() => setRemoveTarget(member)}
                        >
                          <PersonRemoveOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      {isOwner && !closed && (
        <>
          <Typography variant="overline" color="error">
            Опасная зона
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, borderColor: 'error.main' }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              spacing={2}
              alignItems={{ sm: 'center' }}
            >
              <Typography variant="body2">
                Закрытие останавливает работу: данные остаются только для чтения
                и выгрузки 30 дней, затем удаляются безвозвратно. До истечения
                срока организацию можно вернуть.
              </Typography>
              <Button
                color="error"
                variant="outlined"
                onClick={() => setCloseOpen(true)}
              >
                Закрыть организацию
              </Button>
            </Stack>
          </Paper>
        </>
      )}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Исключить сотрудника?"
        message={`${removeTarget?.fullName ?? ''} потеряет доступ к организации сразу. Созданные им записи останутся.`}
        confirmLabel="Исключить"
        loading={action.isPending}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          const target = removeTarget;
          setRemoveTarget(null);
          if (target) {
            action.mutate(() =>
              api.delete(`/organizations/current/members/${target.userId}`),
            );
          }
        }}
      />

      <PasswordActionDialog
        open={Boolean(transferTarget)}
        title="Передать владение"
        description={`${transferTarget?.fullName ?? ''} станет владельцем и администратором. Вы останетесь администратором, но закрывать организацию и передавать владение сможет только новый владелец.`}
        confirmLabel="Передать"
        onClose={() => setTransferTarget(null)}
        onSubmit={async (password) => {
          if (!transferTarget) return;
          await api.post('/organizations/current/transfer-ownership', {
            userId: transferTarget.userId,
            password,
          });
          setTransferTarget(null);
          await refresh();
        }}
      />

      <PasswordActionDialog
        open={closeOpen}
        title="Закрыть организацию"
        description="Работа остановится для всех сотрудников. Данные будут доступны для просмотра и выгрузки 30 дней, затем удалены безвозвратно."
        confirmLabel="Закрыть организацию"
        confirmPhrase={{
          label: 'Введите название организации для подтверждения',
          value: org?.name ?? '',
        }}
        onClose={() => setCloseOpen(false)}
        onSubmit={async (password, confirmName) => {
          await api.post('/organizations/current/close', {
            password,
            confirmName,
          });
          setCloseOpen(false);
          await reloadSession();
          await refresh();
        }}
      />
    </Box>
  );
}
