import {
  LoginResponse,
  OrganizationSummary,
  UserDto,
  UserRole,
} from '@crm/shared';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  api,
  setAccessToken,
  setSessionExpiredHandler,
} from '../../api/client';

interface AuthContextValue {
  user: UserDto | null;
  /** Организация текущего сеанса. */
  organization: OrganizationSummary | null;
  /** Организации, между которыми можно переключаться. */
  organizations: OrganizationSummary[];
  /** Переключение на другую организацию: открывается новый сеанс. */
  switchOrganization: (organizationId: number) => Promise<void>;
  /** true, пока идёт первичная проверка сохранённой сессии. */
  initializing: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Проверка роли для показа разделов интерфейса. */
  hasRole: (...roles: UserRole[]) => boolean;
  /** Руководитель и администратор видят данные всего отдела. */
  canSeeAll: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [organization, setOrganization] = useState<OrganizationSummary | null>(
    null,
  );
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [initializing, setInitializing] = useState(true);
  const queryClient = useQueryClient();

  /** Сохраняет ответ входа или продления: пользователь и организации. */
  const applySession = useCallback((data: LoginResponse) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
    setOrganization(data.organization ?? null);
    setOrganizations(data.organizations ?? []);
  }, []);

  /**
   * При открытии вкладки access-токена в памяти нет, но refresh-cookie
   * могла сохраниться: пробуем восстановить сессию до отрисовки приложения.
   */
  useEffect(() => {
    let cancelled = false;

    api
      .post<LoginResponse>('/auth/refresh')
      .then((response) => {
        if (cancelled) return;
        applySession(response.data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  // Если продлить сессию не удалось уже во время работы — возвращаем на вход
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
  }, []);

  const login = useCallback(
    async (loginName: string, password: string) => {
      const response = await api.post<LoginResponse>('/auth/login', {
        login: loginName,
        password,
      });
      applySession(response.data);
    },
    [applySession],
  );

  /**
   * Переключение организации.
   *
   * Сервер открывает новый сеанс, поэтому обновляются и токен, и роль:
   * в разных организациях у одного человека права могут отличаться.
   */
  const switchOrganization = useCallback(
    async (organizationId: number) => {
      const response = await api.post<LoginResponse>(
        `/auth/organizations/${organizationId}/activate`,
      );
      applySession(response.data);
      /**
       * Кэш запросов сбрасывается целиком.
       *
       * В нём лежат списки и сводки прежней организации; без сброса
       * экран после переключения ещё несколько секунд показывает чужие
       * данные — выглядит это как утечка, даже когда сервер отдаёт
       * всё правильно.
       */
      queryClient.clear();
    },
    [applySession, queryClient],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    setOrganization(null);
    setOrganizations([]);
    // Следующий вошедший не должен увидеть данные предыдущего
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      organization,
      organizations,
      switchOrganization,
      initializing,
      login,
      logout,
      hasRole: (...roles: UserRole[]) =>
        user ? roles.includes(user.role) : false,
      canSeeAll: user?.role === UserRole.HEAD || user?.role === UserRole.ADMIN,
    }),
    [
      user,
      organization,
      organizations,
      switchOrganization,
      initializing,
      login,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
}
