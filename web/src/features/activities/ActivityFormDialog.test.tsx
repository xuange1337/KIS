import { ActivityDto, ActivityRecurrence, ActivityType } from '@crm/shared';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ru } from 'date-fns/locale';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityFormDialog } from './ActivityFormDialog';

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock('../../api/hooks', () => ({
  useDictionaries: () => ({
    data: {
      activityTypes: [
        { value: 'call', label: 'Звонок' },
        { value: 'meeting', label: 'Встреча' },
      ],
    },
  }),
  useClients: () => ({ data: { items: [] } }),
  useDeals: () => ({ data: { items: [] } }),
  useSaveActivity: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));

const existing = {
  activityId: 9,
  clientId: 3,
  dealId: null,
  type: ActivityType.CALL,
  subject: 'Еженедельный созвон',
  plannedAt: '2026-11-02T09:00:00.000Z',
  doneAt: null,
  status: 'planned',
  result: null,
  comment: null,
  recurrence: ActivityRecurrence.WEEKLY,
  recurrenceUntil: null,
  ownerUserId: 1,
} as ActivityDto;

const renderDialog = (activity: ActivityDto | null) =>
  render(
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <ActivityFormDialog open activity={activity} onClose={vi.fn()} />
    </LocalizationProvider>,
  );

describe('Форма активности: повтор', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset().mockResolvedValue({});
  });

  it('показывает текущий повтор и предел только при заданном повторе', async () => {
    renderDialog(existing);
    expect(await screen.findByLabelText('Повторять до')).toBeInTheDocument();
    expect(screen.getByText('Каждую неделю')).toBeInTheDocument();
  });

  it('у одноразовой активности поле предела скрыто', async () => {
    renderDialog({ ...existing, recurrence: null });
    await screen.findByLabelText(/^Тема/);
    expect(screen.queryByLabelText('Повторять до')).not.toBeInTheDocument();
  });

  it('сохраняет правило повтора и снимает предел, когда повтор убран', async () => {
    renderDialog({
      ...existing,
      recurrenceUntil: '2026-12-31T20:59:59.000Z',
    });
    fireEvent.mouseDown(await screen.findByLabelText('Повторять'));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Не повторять' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
    expect(mocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: 9,
        recurrence: null,
        recurrenceUntil: null,
      }),
    );
  });
});
