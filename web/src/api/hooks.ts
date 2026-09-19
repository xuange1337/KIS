import {
  ActivityDto,
  ClientDto,
  ContactDto,
  DashboardSummary,
  DealDto,
  DealStage,
  DealStageHistoryDto,
  ExportFormat,
  FunnelRow,
  ManagerActivityRow,
  OfferDto,
  OverdueActivityRow,
  Paginated,
  ReportName,
  SalesDynamicsRow,
  TopRow,
  UserDto,
} from '@crm/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { api, extractBlobErrorMessage } from './client';

/** Справочники: значения загружаются один раз и живут весь сеанс. */
export interface Dictionaries {
  clientStatuses: { value: string; label: string }[];
  clientSources: { value: string; label: string }[];
  industries: { value: string; label: string }[];
  dealStages: { value: string; label: string }[];
  dealStageProbability: Record<string, number>;
  currencies: { value: string; label: string }[];
  activityTypes: { value: string; label: string }[];
  activityStatuses: { value: string; label: string }[];
  preferredChannels: { value: string; label: string }[];
  offerStatuses: { value: string; label: string }[];
  userRoles: { value: string; label: string }[];
}

export function useDictionaries(): UseQueryResult<Dictionaries> {
  return useQuery({
    queryKey: ['dictionaries'],
    queryFn: async () => (await api.get<Dictionaries>('/dictionaries')).data,
    staleTime: Infinity,
  });
}

/* ---------------------------- Клиенты ---------------------------- */

export type ClientsQuery = Record<string, unknown>;

export function useClients(params: ClientsQuery) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: async () =>
      (await api.get<Paginated<ClientDto>>('/clients', { params })).data,
  });
}

export function useClient(clientId: number | undefined) {
  return useQuery({
    queryKey: ['client', clientId],
    queryFn: async () =>
      (
        await api.get<ClientDto & { contacts: ContactDto[] }>(
          `/clients/${clientId}`,
        )
      ).data,
    enabled: Boolean(clientId),
  });
}

export function useSaveClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      ...payload
    }: Partial<ClientDto> & { clientId?: number }) =>
      clientId
        ? (await api.patch<ClientDto>(`/clients/${clientId}`, payload)).data
        : (await api.post<ClientDto>('/clients', payload)).data,
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', client.clientId] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: number) => {
      await api.delete(`/clients/${clientId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

/* ---------------------------- Контакты ---------------------------- */

export function useClientContacts(clientId: number | undefined) {
  return useQuery({
    queryKey: ['contacts', clientId],
    queryFn: async () =>
      (await api.get<ContactDto[]>(`/clients/${clientId}/contacts`)).data,
    enabled: Boolean(clientId),
  });
}

export function useSaveContact(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contactId,
      ...payload
    }: Partial<ContactDto> & { contactId?: number }) =>
      contactId
        ? (await api.patch<ContactDto>(`/contacts/${contactId}`, payload)).data
        : (await api.post<ContactDto>('/contacts', { ...payload, clientId }))
            .data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['contacts', clientId] }),
  });
}

export function useDeleteContact(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: number) => {
      await api.delete(`/contacts/${contactId}`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['contacts', clientId] }),
  });
}

/* ----------------------------- Сделки ----------------------------- */

/**
 * Список сделок.
 * @param enabled позволяет не отправлять запрос, пока не выбран клиент;
 *   раньше для этого передавался limit: 0, который сервер отклонял как
 *   некорректный, и каждое открытие формы давало две ошибки 400
 */
export function useDeals(params: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: ['deals', params],
    queryFn: async () =>
      (await api.get<Paginated<DealDto>>('/deals', { params })).data,
    enabled,
  });
}

export function useDeal(dealId: number | undefined) {
  return useQuery({
    queryKey: ['deal', dealId],
    queryFn: async () => (await api.get<DealDto>(`/deals/${dealId}`)).data,
    enabled: Boolean(dealId),
  });
}

export function useDealHistory(dealId: number | undefined) {
  return useQuery({
    queryKey: ['deal-history', dealId],
    queryFn: async () =>
      (await api.get<DealStageHistoryDto[]>(`/deals/${dealId}/history`)).data,
    enabled: Boolean(dealId),
  });
}

export function useSaveDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dealId,
      ...payload
    }: Partial<DealDto> & { dealId?: number }) =>
      dealId
        ? (await api.patch<DealDto>(`/deals/${dealId}`, payload)).data
        : (await api.post<DealDto>('/deals', payload)).data,
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', deal.dealId] });
    },
  });
}

/** Смена стадии обновляет и саму сделку, и её историю, и сводки. */
export function useChangeDealStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dealId,
      stage,
    }: {
      dealId: number;
      stage: DealStage;
    }) => (await api.patch<DealDto>(`/deals/${dealId}/stage`, { stage })).data,
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', deal.dealId] });
      queryClient.invalidateQueries({
        queryKey: ['deal-history', deal.dealId],
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: number) => {
      await api.delete(`/deals/${dealId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });
}

/* --------------------------- Активности --------------------------- */

export function useActivities(params: Record<string, unknown>) {
  return useQuery({
    queryKey: ['activities', params],
    queryFn: async () =>
      (await api.get<Paginated<ActivityDto>>('/activities', { params })).data,
  });
}

/** Выборка для календаря: плоский список за период, без пагинации. */
export function useCalendarActivities(params: {
  from: string;
  to: string;
  ownerUserId?: number;
}) {
  return useQuery({
    queryKey: ['calendar', params],
    queryFn: async () =>
      (await api.get<ActivityDto[]>('/activities/calendar', { params })).data,
  });
}

export function useSaveActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      activityId,
      ...payload
    }: Partial<ActivityDto> & { activityId?: number }) =>
      activityId
        ? (await api.patch<ActivityDto>(`/activities/${activityId}`, payload))
            .data
        : (await api.post<ActivityDto>('/activities', payload)).data,
    onSuccess: () => invalidateActivityViews(queryClient),
  });
}

export function useCompleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      activityId,
      result,
      comment,
    }: {
      activityId: number;
      result: string;
      comment?: string;
    }) =>
      (
        await api.patch<ActivityDto>(`/activities/${activityId}/complete`, {
          result,
          comment,
        })
      ).data,
    onSuccess: () => invalidateActivityViews(queryClient),
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activityId: number) => {
      await api.delete(`/activities/${activityId}`);
    },
    onSuccess: () => invalidateActivityViews(queryClient),
  });
}

/** Активности видны сразу в нескольких разделах — обновляем их вместе. */
function invalidateActivityViews(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  queryClient.invalidateQueries({ queryKey: ['activities'] });
  queryClient.invalidateQueries({ queryKey: ['calendar'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['report'] });
}

/* ------------------ Коммерческие предложения ------------------ */

export function useOffers(params: Record<string, unknown>) {
  return useQuery({
    queryKey: ['offers', params],
    queryFn: async () =>
      (await api.get<Paginated<OfferDto>>('/offers', { params })).data,
  });
}

export function useDealOffers(dealId: number | undefined) {
  return useQuery({
    queryKey: ['deal-offers', dealId],
    queryFn: async () =>
      (await api.get<OfferDto[]>(`/deals/${dealId}/offers`)).data,
    enabled: Boolean(dealId),
  });
}

export function useSaveOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      offerId,
      ...payload
    }: Partial<OfferDto> & { offerId?: number }) =>
      offerId
        ? (await api.patch<OfferDto>(`/offers/${offerId}`, payload)).data
        : (await api.post<OfferDto>('/offers', payload)).data,
    onSuccess: (offer) => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({
        queryKey: ['deal-offers', offer.dealId],
      });
    },
  });
}

export function useDeleteOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (offerId: number) => {
      await api.delete(`/offers/${offerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['deal-offers'] });
    },
  });
}

/* ----------------------- Дашборд и отчёты ----------------------- */

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard')).data,
  });
}

/** Строки отчёта различаются по типу — вызывающий уточняет параметром. */
export type ReportRow =
  | FunnelRow
  | SalesDynamicsRow
  | ManagerActivityRow
  | OverdueActivityRow
  | TopRow;

export function useReport<T extends ReportRow>(
  report: ReportName,
  params: Record<string, unknown>,
) {
  return useQuery({
    queryKey: ['report', report, params],
    queryFn: async () =>
      (await api.get<T[]>(`/reports/${report}`, { params })).data,
  });
}

/**
 * Скачивание выгрузки отчёта.
 * Файл приходит как blob, поэтому сохраняется через временную ссылку —
 * обычный переход по URL не передал бы заголовок авторизации.
 */
export async function downloadReport(
  report: ReportName,
  format: ExportFormat,
  params: Record<string, unknown>,
): Promise<void> {
  let response;
  try {
    response = await api.get(`/reports/${report}/export`, {
      params: { ...params, format },
      responseType: 'blob',
    });
  } catch (error) {
    // Тело ошибки пришло как Blob — достаём из него сообщение сервера
    throw new Error(
      await extractBlobErrorMessage(error, 'Не удалось сформировать выгрузку'),
    );
  }

  const disposition = String(response.headers['content-disposition'] ?? '');
  const suggestedName = disposition.match(/filename="?([^"]+)"?/)?.[1];
  const url = URL.createObjectURL(response.data as Blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName ?? `${report}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* -------------------------- Пользователи -------------------------- */

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<UserDto[]>('/users')).data,
    enabled,
  });
}

export function useSaveUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      ...payload
    }: Partial<UserDto> & { userId?: number; password?: string }) =>
      userId
        ? (await api.patch<UserDto>(`/users/${userId}`, payload)).data
        : (await api.post<UserDto>('/users', payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/users/${userId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
