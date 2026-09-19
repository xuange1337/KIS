import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  ACTIVITY_TYPE_LABELS,
  ActivityDto,
  DEAL_STAGE_LABELS,
  DealStage,
  OfferDto,
} from '@crm/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { ActivityList } from '../components/ActivityList';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DealStageChip, OfferStatusChip } from '../components/StatusChip';
import {
  formatDate,
  formatDateTime,
  formatMoney,
} from '../components/formatters';
import { DealFormDialog } from '../features/deals/DealFormDialog';
import { OfferFormDialog } from '../features/offers/OfferFormDialog';
import { ActivityFormDialog } from '../features/activities/ActivityFormDialog';
import { CompleteActivityDialog } from '../features/activities/CompleteActivityDialog';
import {
  useActivities,
  useChangeDealStage,
  useDeal,
  useDealHistory,
  useDealOffers,
  useDeleteDeal,
  useDeleteOffer,
  useDictionaries,
} from '../api/hooks';
import { extractErrorMessage } from '../api/client';

/** Карточка сделки: сведения, КП, активности, история стадий (ТЗ п. 2.5). */
export function DealCardPage() {
  const { id } = useParams();
  const dealId = Number(id);
  const navigate = useNavigate();

  const { data: deal, isLoading, isError } = useDeal(dealId);
  const { data: history } = useDealHistory(dealId);
  const { data: offers } = useDealOffers(dealId);
  const { data: activities } = useActivities({
    dealId,
    limit: 50,
    sort: 'plannedAt',
    order: 'DESC',
  });
  const { data: dictionaries } = useDictionaries();

  const changeStage = useChangeDealStage();
  const deleteDeal = useDeleteDeal();
  const deleteOffer = useDeleteOffer();

  const [editOpen, setEditOpen] = useState(false);
  const [offerForm, setOfferForm] = useState<{
    open: boolean;
    offer: OfferDto | null;
  }>({ open: false, offer: null });
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [completing, setCompleting] = useState<ActivityDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'deal' } | { kind: 'offer'; id: number } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !deal) {
    return (
      <Alert severity="error">
        Сделка не найдена или закреплена за другим менеджером
      </Alert>
    );
  }

  const handleStageChange = async (stage: DealStage) => {
    setError(null);
    try {
      await changeStage.mutateAsync({ dealId, stage });
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось сменить стадию'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      if (deleteTarget.kind === 'deal') {
        await deleteDeal.mutateAsync(dealId);
        navigate('/deals');
      } else {
        await deleteOffer.mutateAsync(deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось удалить запись'));
    }
  };

  return (
    <>
      <PageHeader
        title={deal.title}
        breadcrumbs={[{ label: 'Сделки', to: '/deals' }, { label: deal.title }]}
        actions={
          <>
            <Button startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>
              Редактировать
            </Button>
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteTarget({ kind: 'deal' })}
            >
              Удалить
            </Button>
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={5}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    Текущая стадия
                  </Typography>
                  <TextField
                    select
                    size="small"
                    value={deal.stage}
                    onChange={(event) =>
                      handleStageChange(event.target.value as DealStage)
                    }
                    disabled={changeStage.isPending}
                    fullWidth
                    sx={{ mt: 0.5 }}
                  >
                    {dictionaries?.dealStages.map((item) => (
                      <MenuItem key={item.value} value={item.value}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Field label="Сумма">
                  {formatMoney(deal.amount, deal.currency)}
                </Field>
                <Field label="Вероятность">{deal.probability}%</Field>
                <Field label="Плановое закрытие">
                  {formatDate(deal.plannedClose)}
                </Field>
                <Field label="Клиент">
                  {deal.client ? (
                    <Link to={`/clients/${deal.client.clientId}`}>
                      {deal.client.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </Field>
                <Field label="Ответственный">
                  {deal.owner?.fullName ?? '—'}
                </Field>
                <Field label="Создана">{formatDate(deal.createdAt)}</Field>
                <Field label="Закрыта">{formatDate(deal.closedAt)}</Field>
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography variant="h6">Коммерческие предложения</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setOfferForm({ open: true, offer: null })}
                >
                  Добавить
                </Button>
              </Stack>
              {offers && offers.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Номер</TableCell>
                      <TableCell>Дата</TableCell>
                      <TableCell align="right">Сумма</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {offers.map((offer) => (
                      <TableRow key={offer.offerId} hover>
                        <TableCell>{offer.number}</TableCell>
                        <TableCell>{formatDate(offer.date)}</TableCell>
                        <TableCell align="right">
                          {formatMoney(offer.totalAmount, deal.currency)}
                        </TableCell>
                        <TableCell>
                          <OfferStatusChip status={offer.status} />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => setOfferForm({ open: true, offer })}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() =>
                              setDeleteTarget({
                                kind: 'offer',
                                id: offer.offerId,
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
                <EmptyText text="Предложения по сделке не оформлялись" />
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography variant="h6">Активности</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setActivityFormOpen(true)}
                >
                  Запланировать
                </Button>
              </Stack>
              <ActivityList
                activities={activities?.items ?? []}
                emptyText="Активности по сделке не запланированы"
                emptyHint="Запланируйте звонок или встречу, чтобы двигать сделку"
                onComplete={setCompleting}
                // Клиент виден в сведениях сделки, поэтому здесь — тип и тема
                secondaryOf={(activity) => ACTIVITY_TYPE_LABELS[activity.type]}
                showResult
                hideOpenAction
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                История стадий
              </Typography>
              {history && history.length > 0 ? (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  {history.map((record, index) => (
                    <Box key={record.id}>
                      {index > 0 && <Divider sx={{ mb: 1.5 }} />}
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {record.fromStage && (
                          <>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {DEAL_STAGE_LABELS[record.fromStage]}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              →
                            </Typography>
                          </>
                        )}
                        <DealStageChip stage={record.toStage} />
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {formatDateTime(record.changedAt)}
                        {record.changedByUser &&
                          ` · ${record.changedByUser.fullName}`}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <EmptyText text="Записей нет" />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <DealFormDialog
        open={editOpen}
        deal={deal}
        onClose={() => setEditOpen(false)}
      />
      <OfferFormDialog
        open={offerForm.open}
        dealId={dealId}
        offer={offerForm.offer}
        defaultAmount={deal.amount}
        onClose={() => setOfferForm({ open: false, offer: null })}
      />
      <ActivityFormDialog
        open={activityFormOpen}
        clientId={deal.clientId}
        dealId={dealId}
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
          deleteTarget?.kind === 'deal'
            ? 'Удаление сделки'
            : 'Удаление предложения'
        }
        message={
          deleteTarget?.kind === 'deal'
            ? 'Сделка, её история и связанные активности будут удалены. Действие необратимо.'
            : 'Коммерческое предложение будет удалено. Действие необратимо.'
        }
        loading={deleteDeal.isPending || deleteOffer.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Grid item xs={6} sm={3}>
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
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ py: 3 }}
      align="center"
    >
      {text}
    </Typography>
  );
}
