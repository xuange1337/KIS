import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './RegisterPage';

const state = vi.hoisted(() => ({
  register: vi.fn(),
  impl: null as null | ((data: unknown) => Promise<void>),
}));
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({
    register: (data: unknown) =>
      state.impl ? state.impl(data) : state.register(data),
  }),
}));

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillAll = () => {
  fill(/Название организации/, 'ООО Ромашка');
  fill(/Ваше имя/, 'Иван Петров');
  fill(/Электронная почта/, 'ivan@example.com');
  fill(/^Логин/, 'ivan');
  fill(/^Пароль/, 'secret-pass');
};

describe('Регистрация', () => {
  beforeEach(() => {
    state.impl = null;
    state.register.mockReset().mockResolvedValue(undefined);
  });

  it('не даёт отправить форму без согласия', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    fillAll();
    expect(
      screen.getByRole('button', { name: 'Создать организацию' }),
    ).toBeDisabled();
  });

  it('отправляет данные и согласие', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    fillAll();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Создать организацию' }),
    );
    await waitFor(() =>
      expect(state.register).toHaveBeenCalledWith({
        organizationName: 'ООО Ромашка',
        fullName: 'Иван Петров',
        login: 'ivan',
        email: 'ivan@example.com',
        password: 'secret-pass',
        acceptTerms: true,
      }),
    );
  });

  it('показывает отказ сервера', async () => {
    // Обычная функция, а не шпион: шпион vitest сообщает об отклонённом
    // промисе как о необработанном, хотя страница его обрабатывает
    state.impl = () => Promise.reject(new Error('x'));
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    fillAll();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Создать организацию' }),
    );
    expect(
      await screen.findByText('Не удалось зарегистрироваться'),
    ).toBeInTheDocument();
  });
});
