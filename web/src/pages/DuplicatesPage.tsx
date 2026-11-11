import { DuplicateGroupDto, DuplicateReason } from '@crm/shared';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Radio,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { extractErrorMessage } from '../api/client';
import { useDuplicateClients, useMergeClients } from '../api/hooks';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { formatDate } from '../components/formatters';
import { TOKENS } from '../theme/tokens';

const REASON_LABELS: Record<DuplicateReason, string> = {
  inn: 'Совпадает ИНН',
  name: 'Похожее название',
  email: 'Общая почта контакта',
  phone: 'Общий телефон контакта',
};

/**
 * Основной картой по умолчанию становится самая «богатая» запись: у неё
 * больше сделок и контактов, значит, переносить с неё придётся меньше.
 */
function defaultTarget(group: DuplicateGroupDto): number {
  return [...group.clients].sort(
    (a, b) =>
      b.dealsCount + b.contactsCount - (a.dealsCount + a.contactsCount) ||
      a.clientId - b.clientId,
  )[0].clientId;
}

export function DuplicatesPage() {
  const { data, isLoading, isError } = useDuplicateClients();
  const merge = useMergeClients();
  const [targets, setTargets] = useState<Record<number, number>>({});
  const [pending, setPending] = useState<DuplicateGroupDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const targetOf = (group: DuplicateGroupDto) =>
    targets[group.key] ?? defaultTarget(group);

  const confirm = async () => {
    if (!pending) return;
    const targetId = targetOf(pending);
    setError(null);
    try {
      const result = await merge.mutateAsync({
        targetId,
        sourceIds: pending.clients
          .map((c) => c.clientId)
          .filter((id) => id !== targetId),
      });
      setDone(
        `Объединено карточек: ${result.mergedCount}. Перенесено контактов: ${result.movedContacts}, сделок: ${result.movedDeals}, активностей: ${result.movedActivities}`,
      );
      setPending(null);
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось объединить карточки'));
      setPending(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Дубли клиентов"
        subtitle="Карточки с одинаковым ИНН, похожим названием, общей почтой или телефоном контакта"
        breadcrumbs={[{ label: 'Клиенты', to: '/clients' }, { label: 'Дубли' }]}
      />
      {done && (
        <Alert severity="success" onClose={() => setDone(null)} sx={{ mb: 2 }}>
          {done}
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {isError && (
        <Alert severity="error">Не удалось загрузить список дублей</Alert>
      )}
      {isLoading && <Skeleton variant="rounded" height={160} />}
      {data && data.length === 0 && (
        <Paper variant="outlined">
          <EmptyState
            title="Дублей не найдено"
            hint="Проверка идёт по ИНН, названию без правовой формы, почте и телефону контактов"
          />
        </Paper>
      )}
      <Stack spacing={2}>
        {data?.map((group) => (
          <Paper key={group.key} variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              spacing={1}
              sx={{ mb: 1 }}
            >
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {group.reasons.map((reason) => (
                  <Chip
                    key={reason}
                    size="small"
                    label={REASON_LABELS[reason]}
                  />
                ))}
              </Stack>
              <Button
                variant="contained"
                size="small"
                startIcon={<MergeTypeIcon />}
                onClick={() => setPending(group)}
              >
                Объединить в выбранную
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Выберите основную карточку: остальные вольются в неё и будут
              удалены
            </Typography>
            <Box role="radiogroup" aria-label="Основная карточка">
              {group.clients.map((client) => (
                <Stack
                  key={client.clientId}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ borderTop: `1px solid ${TOKENS.border}`, py: 0.5 }}
                >
                  <Radio
                    checked={targetOf(group) === client.clientId}
                    onChange={() =>
                      setTargets((prev) => ({
                        ...prev,
                        [group.key]: client.clientId,
                      }))
                    }
                    slotProps={{
                      input: {
                        'aria-label': `Основная карточка: ${client.name}`,
                      },
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      component={RouterLink}
                      to={`/clients/${client.clientId}`}
                      sx={{ fontWeight: 500, color: 'inherit' }}
                    >
                      {client.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {[
                        client.inn ? `ИНН ${client.inn}` : null,
                        client.ownerName,
                        `контактов: ${client.contactsCount}`,
                        `сделок: ${client.dealsCount}`,
                        `создан ${formatDate(client.createdAt)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Box>
          </Paper>
        ))}
      </Stack>
      <ConfirmDialog
        open={pending !== null}
        title="Объединить карточки?"
        message={
          pending
            ? `Контакты, сделки и активности ${pending.clients.length - 1} карточек будут перенесены в «${
                pending.clients.find((c) => c.clientId === targetOf(pending))
                  ?.name
              }», сами карточки удалятся. Отменить это действие нельзя.`
            : ''
        }
        confirmLabel="Объединить"
        loading={merge.isPending}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
