import { UserDto, UserRole } from '@crm/shared';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  api,
  setAccessToken,
  setSessionExpiredHandler,
} from '../../api/client';

interface AuthContextValue {
  user: UserDto | null;
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
  const [initializing, setInitializing] = useState(true);

  /**
   * При открытии вкладки access-токена в памяти нет, но refresh-cookie
   * могла сохраниться: пробуем восстановить сессию до отрисовки приложения.
   */
  useEffect(() => {
    let cancelled = false;

    api
      .post<{ accessToken: string; user: UserDto }>('/auth/refresh')
      .then((response) => {
        if (cancelled) return;
        setAccessToken(response.data.accessToken);
        setUser(response.data.user);
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
  }, []);

  // Если продлить сессию не удалось уже во время работы — возвращаем на вход
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
  }, []);

  const login = useCallback(async (loginName: string, password: string) => {
    const response = await api.post<{ accessToken: string; user: UserDto }>(
      '/auth/login',
      { login: loginName, password },
    );
    setAccessToken(response.data.accessToken);
    setUser(response.data.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      login,
      logout,
      hasRole: (...roles: UserRole[]) =>
        user ? roles.includes(user.role) : false,
      canSeeAll: user?.role === UserRole.HEAD || user?.role === UserRole.ADMIN,
    }),
    [user, initializing, login, logout],
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
