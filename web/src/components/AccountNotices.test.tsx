import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OrganizationStatus } from '@crm/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountNotices } from './AccountNotices';

const state = vi.hoisted(() => ({
  auth: {} as Record<string, unknown>,
  post: vi.fn(),
}));
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => state.auth,
}));
vi.mock('../api/client', () => ({
  api: { post: state.post },
  extractErrorMessage: (_: unknown, fallback: string) => fallback,
}));

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

const setAuth = (
  organization: Record<string, unknown>,
  user: Record<string, unknown> = {},
) => {
  state.auth = {
    user: { email: null, emailVerified: false, ...user },
    organization: {
      organizationId: 1,
      name: 'Тест',
      status: OrganizationStatus.ACTIVE,
      trialEndsAt: null,
      ...organization,
    },
  };
};

describe('Уведомления об учётной записи', () => {
  beforeEach(() => {
    state.post.mockReset().mockResolvedValue({});
  });

  it('ничего не показывает активной организации с подтверждённой почтой', () => {
    setAuth({}, { email: 'a@example.com', emailVerified: true });
    const { container } = render(<AccountNotices />);
    expect(container).toBeEmptyDOMElement();
  });

  it('показывает остаток пробного периода', () => {
    setAuth({ status: OrganizationStatus.TRIAL, trialEndsAt: inDays(5) });
    render(<AccountNotices />);
    expect(screen.getByText(/Пробный период до/)).toHaveTextContent(
      'осталось дней: 5',
    );
  });

  it('объясняет, что запись закрыта, когда организация приостановлена', () => {
    setAuth({ status: OrganizationStatus.SUSPENDED });
    render(<AccountNotices />);
    expect(screen.getByText(/вносить изменения нельзя/)).toBeInTheDocument();
  });

  it('предлагает повторить письмо, пока адрес не подтверждён', async () => {
    setAuth({}, { email: 'a@example.com', emailVerified: false });
    render(<AccountNotices />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Отправить письмо снова' }),
    );
    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith('/auth/email/resend'),
    );
    expect(
      await screen.findByText('Письмо отправлено на a@example.com.'),
    ).toBeInTheDocument();
  });

  it('не беспокоит учётную запись без адреса', () => {
    setAuth({}, { email: null });
    const { container } = render(<AccountNotices />);
    expect(container).toBeEmptyDOMElement();
  });
});
