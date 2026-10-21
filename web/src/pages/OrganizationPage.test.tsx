import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationPage } from './OrganizationPage';

const state = vi.hoisted(() => ({
  userId: 1,
  organization: {} as Record<string, unknown>,
  members: [] as Record<string, unknown>[],
  post: vi.fn(),
  del: vi.fn(),
  reloadSession: vi.fn(),
}));

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: state.userId },
    reloadSession: state.reloadSession,
  }),
}));
vi.mock('../api/client', () => ({
  api: {
    get: (url: string) =>
      Promise.resolve({
        data: url.endsWith('/members') ? state.members : state.organization,
      }),
    post: state.post,
    delete: state.del,
    patch: vi.fn(),
  },
  extractErrorMessage: (_: unknown, fallback?: string) => fallback ?? 'Ошибка',
}));

const member = (userId: number, extra: Record<string, unknown> = {}) => ({
  userId,
  login: `user${userId}`,
  fullName: `Сотрудник ${userId}`,
  email: null,
  role: 'manager',
  isOwner: false,
  isActive: true,
  joinedAt: '2026-01-01T00:00:00Z',
  ...extra,
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OrganizationPage />
    </QueryClientProvider>,
  );

describe('Экран «Организация»', () => {
  beforeEach(() => {
    state.userId = 1;
    state.post.mockReset().mockResolvedValue({});
    state.del.mockReset().mockResolvedValue({});
    state.organization = {
      organizationId: 5,
      name: 'ООО Тест',
      status: 'active',
      ownerUserId: 1,
      closedAt: null,
      purgeAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      memberCount: 3,
      trialEndsAt: null,
      isActive: true,
    };
    state.members = [
      member(1, { role: 'admin', isOwner: true }),
      member(2),
      member(3, { role: 'admin' }),
    ];
  });

  it('владельцу показывает закрытие и передачу владения', async () => {
    renderPage();
    expect(
      await screen.findByRole('button', { name: 'Закрыть организацию' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Сделать владельцем: Сотрудник 2' }),
    ).toBeInTheDocument();
    // Владельца исключить нельзя
    expect(
      screen.queryByRole('button', { name: 'Исключить: Сотрудник 1' }),
    ).not.toBeInTheDocument();
  });

  it('другому администратору не предлагает опасных действий', async () => {
    state.userId = 3;
    renderPage();
    await screen.findByText('Сотрудник 2');
    expect(
      screen.queryByRole('button', { name: 'Закрыть организацию' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Сделать владельцем/ }),
    ).not.toBeInTheDocument();
  });

  it('исключает после подтверждения', async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Исключить: Сотрудник 2' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Исключить' }));
    await waitFor(() =>
      expect(state.del).toHaveBeenCalledWith(
        '/organizations/current/members/2',
      ),
    );
  });

  it('закрытие доступно только после ввода названия и пароля', async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Закрыть организацию' }),
    );
    const submit = screen
      .getAllByRole('button', { name: 'Закрыть организацию' })
      .at(-1)!;
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Введите название/), {
      target: { value: 'ООО Тест' },
    });
    fireEvent.change(screen.getByLabelText('Ваш пароль'), {
      target: { value: 'secret' },
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith('/organizations/current/close', {
        password: 'secret',
        confirmName: 'ООО Тест',
      }),
    );
    await waitFor(() => expect(state.reloadSession).toHaveBeenCalled());
  });

  it('у закрытой организации владелец видит возврат', async () => {
    state.organization = {
      ...state.organization,
      status: 'closed',
      closedAt: '2026-10-01T00:00:00Z',
      purgeAt: '2026-10-31T00:00:00Z',
    };
    renderPage();
    expect(
      await screen.findByRole('button', { name: 'Вернуть организацию' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Закрыть организацию' }),
    ).not.toBeInTheDocument();
  });
});
