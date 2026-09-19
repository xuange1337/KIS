import {
  ActivityStatus,
  ActivityType,
  ActivityDto,
  ClientStatus,
  DealStage,
} from '@crm/shared';
import { ThemeProvider } from '@mui/material/styles';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ActivityList } from './ActivityList';
import { ConfirmDialog } from './ConfirmDialog';
import { DataTable } from './DataTable';
import { EmptyState } from './EmptyState';
import { MetricTile } from './MetricTile';
import { PageHeader } from './PageHeader';
import { ClientStatusChip, DealStageChip } from './StatusChip';
import { theme } from '../theme/theme';
import { expectNoAccessibilityViolations } from '../test/axe';

const wrap = (node: React.ReactNode) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{node}</ThemeProvider>
    </MemoryRouter>,
  );

const activity: ActivityDto = {
  activityId: 1,
  clientId: 1,
  client: { clientId: 1, name: 'ООО «Пример»' },
  dealId: null,
  deal: null,
  type: ActivityType.CALL,
  subject: 'Звонок клиенту',
  plannedAt: new Date('2026-09-20T12:00:00+03:00').toISOString(),
  doneAt: null,
  status: ActivityStatus.PLANNED,
  result: null,
  comment: null,
  ownerUserId: 1,
} as ActivityDto;

describe('Доступность интерфейса', () => {
  it('шапка экрана', async () => {
    const { container } = wrap(
      <PageHeader
        title="Клиенты"
        subtitle="Клиенты, закреплённые за вами"
        breadcrumbs={[{ label: 'Обзор', to: '/' }, { label: 'Клиенты' }]}
        actions={<button type="button">Добавить клиента</button>}
      />,
    );
    await expectNoAccessibilityViolations(container);
  });

  it('лента активностей', async () => {
    const { container } = wrap(
      <ActivityList activities={[activity]} emptyText="Активностей нет" />,
    );
    await expectNoAccessibilityViolations(container);
  });

  it('таблица данных', async () => {
    const { container } = wrap(
      <DataTable
        rows={[{ clientId: 1, name: 'ООО «Пример»' }]}
        columns={[{ field: 'name', headerName: 'Наименование', flex: 1 }]}
        rowCount={1}
        getRowId={(row) => row.clientId}
        paginationModel={{ page: 0, pageSize: 25 }}
        onPaginationModelChange={() => undefined}
      />,
    );
    await expectNoAccessibilityViolations(container);
  });

  it('подтверждение удаления', async () => {
    const { baseElement } = wrap(
      <ConfirmDialog
        open
        title="Удалить клиента?"
        message="Связанные записи будут удалены."
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    // Диалог рендерится в портал, поэтому проверяется весь документ
    await expectNoAccessibilityViolations(baseElement);
  });

  it('плитка показателя и пустое состояние', async () => {
    const { container } = wrap(
      <>
        <MetricTile label="Сделок в работе" value="10" context="25 960 000 ₽" />
        <EmptyState title="Ничего не найдено" hint="Измените фильтры" />
      </>,
    );
    await expectNoAccessibilityViolations(container);
  });

  it('ссылка пропуска навигации ведёт к содержимому', async () => {
    const { container } = wrap(
      <>
        <a href="#main-content">Перейти к содержимому</a>
        <main id="main-content" tabIndex={-1}>
          <PageHeader title="Клиенты" />
        </main>
      </>,
    );
    const link = container.querySelector('a[href="#main-content"]');
    const target = container.querySelector('#main-content');
    // Цель ссылки должна существовать: иначе пропуск никуда не ведёт
    expect(link).not.toBeNull();
    expect(target).not.toBeNull();
    await expectNoAccessibilityViolations(container);
  });

  it('метки статусов', async () => {
    const { container } = wrap(
      <>
        <DealStageChip stage={DealStage.NEW} />
        <ClientStatusChip status={ClientStatus.ACTIVE} />
      </>,
    );
    await expectNoAccessibilityViolations(container);
  });
});
