import { UserRole } from '@crm/shared';
import { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../features/auth/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ClientsPage } from '../pages/ClientsPage';
import { ClientCardPage } from '../pages/ClientCardPage';
import { DealsPage } from '../pages/DealsPage';
import { DealCardPage } from '../pages/DealCardPage';
import { CalendarPage } from '../pages/CalendarPage';
import { OffersPage } from '../pages/OffersPage';
import { ReportsPage } from '../pages/ReportsPage';
import { UsersPage } from '../pages/UsersPage';
import { NotFoundPage } from '../pages/NotFoundPage';

/** Пускает дальше только авторизованного пользователя. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Запомненный адрес возвращает пользователя туда, куда он шёл
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <AppLayout>{children}</AppLayout>;
}

/** Дополнительно ограничивает раздел по роли. */
function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  const { hasRole } = useAuth();
  return hasRole(...roles) ? <>{children}</> : <Navigate to="/" replace />;
}

export function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />

      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/clients"
        element={
          <RequireAuth>
            <ClientsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/clients/:id"
        element={
          <RequireAuth>
            <ClientCardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/deals"
        element={
          <RequireAuth>
            <DealsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/deals/:id"
        element={
          <RequireAuth>
            <DealCardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/calendar"
        element={
          <RequireAuth>
            <CalendarPage />
          </RequireAuth>
        }
      />
      <Route
        path="/offers"
        element={
          <RequireAuth>
            <OffersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth>
            <ReportsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/users"
        element={
          <RequireAuth>
            <RequireRole roles={[UserRole.ADMIN]}>
              <UsersPage />
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
