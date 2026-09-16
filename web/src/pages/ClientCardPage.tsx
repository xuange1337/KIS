import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  IconButton,
  Link as MuiLink,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  ACTIVITY_TYPE_LABELS,
  ActivityDto,
  CLIENT_SOURCE_LABELS,
  ContactDto,
  PREFERRED_CHANNEL_LABELS,
} from '@crm/shared';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { ActivityList } from '../components/ActivityList';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  ClientStatusChip,
  DealStageChip,
} from '../components/StatusChip';
import { formatDate, formatMoney } from '../components/formatters';
import { ClientFormDialog } from '../features/clients/ClientFormDialog';
import { ContactFormDialog } from '../features/contacts/ContactFormDialog';
import { DealFormDialog } from '../features/deals/DealFormDialog';
import { ActivityFormDialog } from '../features/activities/ActivityFormDialog';
import { CompleteActivityDialog } from '../features/activities/CompleteActivityDialog';
import {
  useActivities,
  useClient,
  useClientContacts,
  useDeals,
  useDeleteClient,
  useDeleteContact,
} from '../api/hooks';
import { TOKENS } from '../theme/tokens';

/** Карточка клиента: сведения, контакты, сделки, история взаимодействий (ТЗ п. 2.5). */
export function ClientCardPage() {
  const { id } = useParams();
  const clientId = Number(id);
  const navigate = useNavigate();

  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [contactForm, setContactForm] = useState<{
    open: boolean;
    contact: ContactDto | null;
  }>({ open: false, contact: null });
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [completing, setCompleting] = useState<ActivityDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'client' } | { kind: 'contact'; id: number } | null
  >(null);

  const { data: client, isLoading, isError } = useClient(clientId);
  const { data: contacts } = useClientContacts(clientId);
  const { data: deals } = useDeals({ clientId, limit: 100 });
  const { data: activities } = useActivities({
    clientId,
    limit: 100,
    sort: 'plannedAt',
    order: 'DESC',
  });

  const deleteClient = useDeleteClient();
  const deleteContact = useDeleteContact(clientId);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !client) {
    return (
      <Alert severity="error">
        Клиент не найден или закреплён за другим менеджером
      </Alert>
    );
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      if (deleteTarget.kind === 'client') {
        await deleteClient.mutateAsync(clientId);
        navigate('/clients');
      } else {
        await deleteContact.mutateAsync(deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (caught) {
      const message =
        (caught as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? 'Не удалось удалить запись';
      setDeleteError(message);
    }
  };

  return (
    <>
      <PageHeader
        title={client.name}
        breadcrumbs={[
          { label: 'Клиенты', to: '/clients' },
          { label: client.name },
        ]}
        actions={
          <>
            <Button startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>
              Редактировать
            </Button>
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteTarget({ kind: 'client' })}
            >
              Удалить
            </Button>
          </>
        }
      />

      {deleteError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteError(null)}>
          {deleteError}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Field label="Статус">
              <ClientStatusChip status={client.status} />
            </Field>
            <Field label="ИНН">{client.inn ?? '—'}</Field>
            <Field label="Отрасль">{client.industry ?? '—'}</Field>
            <Field label="Источник">
              {client.source ? CLIENT_SOURCE_LABELS[client.source] : '—'}
            </Field>
            <Field label="Ответственный">{client.owner?.fullName ?? '—'}</Field>
            <Field label="Дата создания">{formatDate(client.createdAt)}</Field>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                Адрес
              </Typography>
              <Typography variant="body2">{client.address ?? '—'}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <Tabs
          value={tab}
          onChange={(_event, value) => setTab(value)}
          sx={{ px: 2, borderBottom: `1px solid ${TOKENS.border}` }}
        >
          <Tab label={`Контакты (${contacts?.length ?? 0})`} />
          <Tab label={`Сделки (${deals?.total ?? 0})`} />
          <Tab label={`История взаимодействий (${activities?.total ?? 0})`} />
        </Tabs>

        <CardContent>
          {tab === 0 && (
            <>
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setContactForm({ open: true, contact: null })}
                >
                  Добавить контакт
                </Button>
              </Stack>
              {contacts && contacts.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ФИО</TableCell>
                      <TableCell>Должность</TableCell>
                      <TableCell>Телефон</TableCell>
                      <TableCell>Электронная почта</TableCell>
                      <TableCell>Канал связи</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.contactId} hover>
                        <TableCell>{contact.fullName}</TableCell>
                        <TableCell>{contact.position ?? '—'}</TableCell>
                        <TableCell>{contact.phone ?? '—'}</TableCell>
                        <TableCell>
                          {contact.email ? (
                            <MuiLink href={`mailto:${contact.email}`}>
                              {contact.email}
                            </MuiLink>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.preferredChannel
                            ? PREFERRED_CHANNEL_LABELS[contact.preferredChannel]
                            : '—'}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() =>
                              setContactForm({ open: true, contact })
                            }
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() =>
                              setDeleteTarget({
                                kind: 'contact',
                                id: contact.contactId,
                              })
                            }
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyText text="Контактные лица не добавлены" />
              )}
            </>
          )}

          {tab === 1 && (
            <>
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setDealFormOpen(true)}
                >
                  Создать сделку
                </Button>
              </Stack>
              {deals && deals.items.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Сделка</TableCell>
                      <TableCell>Стадия</TableCell>
                      <TableCell align="right">Сумма</TableCell>
                      <TableCell>Плановое закрытие</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deals.items.map((deal) => (
                      <TableRow
                        key={deal.dealId}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/deals/${deal.dealId}`)}
                      >
                        <TableCell>{deal.title}</TableCell>
                        <TableCell>
                          <DealStageChip stage={deal.stage} />
                        </TableCell>
                        <TableCell align="right">
                          {formatMoney(deal.amount)}
                        </TableCell>
                        <TableCell>{formatDate(deal.plannedClose)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyText text="По клиенту ещё нет сделок" />
              )}
            </>
          )}

          {tab === 2 && (
            <>
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setActivityFormOpen(true)}
                >
                  Запланировать активность
                </Button>
              </Stack>
              <ActivityList
                activities={activities?.items ?? []}
                emptyText="Взаимодействий пока не было"
                emptyHint="Запланируйте звонок, встречу или письмо по этому клиенту"
                onComplete={setCompleting}
                // Клиент уже открыт, поэтому во второй строке полезнее сделка
                secondaryOf={(activity) =>
                  activity.deal
                    ? `${ACTIVITY_TYPE_LABELS[activity.type]} · ${activity.deal.title}`
                    : ACTIVITY_TYPE_LABELS[activity.type]
                }
                showResult
                hideOpenAction
              />
            </>
          )}
        </CardContent>
      </Card>

      <ClientFormDialog
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
      />
      <ContactFormDialog
        open={contactForm.open}
        clientId={clientId}
        contact={contactForm.contact}
        onClose={() => setContactForm({ open: false, contact: null })}
      />
      <DealFormDialog
        open={dealFormOpen}
        clientId={clientId}
        onClose={() => setDealFormOpen(false)}
      />
      <ActivityFormDialog
        open={activityFormOpen}
        clientId={clientId}
        onClose={() => setActivityFormOpen(false)}
      />
      <CompleteActivityDialog
        open={Boolean(completing)}
        activity={completing}
        onClose={() => setCompleting(null)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={
          deleteTarget?.kind === 'client'
            ? 'Удаление клиента'
            : 'Удаление контакта'
        }
        message={
          deleteTarget?.kind === 'client'
            ? 'Карточка клиента и все его контакты будут удалены. Действие необратимо.'
            : 'Контактное лицо будет удалено. Действие необратимо.'
        }
        loading={deleteClient.isPending || deleteContact.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Grid item xs={6} sm={4} md={2}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
        {children}
      </Typography>
    </Grid>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }} align="center">
      {text}
    </Typography>
  );
}
