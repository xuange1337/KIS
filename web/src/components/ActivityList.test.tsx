import { ActivityStatus, ActivityType, ActivityDto } from '@crm/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ActivityList } from './ActivityList';

const DAY = 24 * 3600 * 1000;

/** Активность с нужным сроком и статусом. */
const activity = (
  overrides: Partial<ActivityDto> & { plannedAt: string },
): ActivityDto =>
  ({
    activityId: 1,
    clientId: 1,
    client: { clientId: 1, name: 'ООО «Пример»' },
    dealId: null,
    deal: null,
    type: ActivityType.CALL,
    subject: 'Звонок клиенту',
    doneAt: null,
    status: ActivityStatus.PLANNED,
    result: null,
    comment: null,
    ownerUserId: 1,
    ...overrides,
  }) as ActivityDto;

const renderList = (activities: ActivityDto[], props = {}) =>
  render(
    <MemoryRouter>
      <ActivityList
        activities={activities}
        emptyText="Активностей нет"
        {...props}
      />
    </MemoryRouter>,
  );

describe('Лента активностей', () => {
  it('подписывает срок словами вместо голой даты', () => {
    renderList([
      activity({
        plannedAt: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      }),
    ]);
    expect(screen.getByText(/Сегодня/)).toBeInTheDocument();
  });

  it('отмечает завтрашние активности', () => {
    const tomorrow = new Date(Date.now() + DAY);
    tomorrow.setHours(12, 0, 0, 0);
    renderList([activity({ plannedAt: tomorrow.toISOString() })]);
    expect(screen.getByText(/Завтра/)).toBeInTheDocument();
  });

  it('показывает давность просрочки, а не время суток', () => {
    // Для просроченной задачи важно, сколько она висит: это определяет
    // очерёдность работы
    renderList([
      activity({ plannedAt: new Date(Date.now() - 3 * DAY).toISOString() }),
    ]);
    expect(screen.getByText(/Просрочено · 3 дня/)).toBeInTheDocument();
  });

  it('не считает выполненную активность просроченной', () => {
    // Прошедшая дата у выполненной задачи — норма, помечать её красным
    // значит вводить пользователя в заблуждение
    renderList([
      activity({
        plannedAt: new Date(Date.now() - 10 * DAY).toISOString(),
        status: ActivityStatus.DONE,
        doneAt: new Date(Date.now() - 10 * DAY).toISOString(),
      }),
    ]);
    expect(screen.queryByText(/Просрочено/)).toBeNull();
    expect(screen.getByText(/Выполнено/)).toBeInTheDocument();
  });

  it('не помечает отменённую активность просроченной', () => {
    renderList([
      activity({
        plannedAt: new Date(Date.now() - 5 * DAY).toISOString(),
        status: ActivityStatus.CANCELED,
      }),
    ]);
    expect(screen.queryByText(/Просрочено/)).toBeNull();
    expect(screen.getByText(/Отменено/)).toBeInTheDocument();
  });

  it('сообщает о пустом списке вместо пустого места', () => {
    // Пустой блок неотличим от сбоя загрузки
    renderList([]);
    expect(screen.getByText('Активностей нет')).toBeInTheDocument();
  });

  it('выводит результат в истории взаимодействий', () => {
    renderList(
      [
        activity({
          plannedAt: new Date(Date.now() - DAY).toISOString(),
          status: ActivityStatus.DONE,
          result: 'Клиент подтвердил интерес',
        }),
      ],
      { showResult: true },
    );
    expect(screen.getByText(/Клиент подтвердил интерес/)).toBeInTheDocument();
  });

  it('во второй строке показывает клиента, если не задано иное', () => {
    renderList([activity({ plannedAt: new Date().toISOString() })]);
    expect(screen.getByText('ООО «Пример»')).toBeInTheDocument();
  });
});
