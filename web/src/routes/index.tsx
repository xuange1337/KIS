import { UserRole } from '@crm/shared';
import { Box, CircularProgress } from '@mui/material';
import { lazy, ReactNode, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../features/auth/AuthContext';

const LoginPage = lazy(() =>
  import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const ClientsPage = lazy(() =>
  import('../pages/ClientsPage').then((module) => ({ default: module.ClientsPage })),
);
const ClientCardPage = lazy(() =>
  import('../pages/ClientCardPage').then((module) => ({ default: module.ClientCardPage })),
);
const DealsPage = lazy(() =>
  import('../pages/DealsPage').then((module) => ({ default: module.DealsPage })),
);
const DealCardPage = lazy(() =>
  import('../pages/DealCardPage').then((module) => ({ default: module.DealCardPage })),
);
const CalendarPage = lazy(() =>
  import('../pages/CalendarPage').then((module) => ({ default: module.CalendarPage })),
);
const OffersPage = lazy(() =>
  import('../pages/OffersPage').then((module) => ({ default: module.OffersPage })),
);
const ReportsPage = lazy(() =>
  import('../pages/ReportsPage').then((module) => ({ default: module.ReportsPage })),
);
const UsersPage = lazy(() =>
  import('../pages/UsersPage').then((module) => ({ default: module.UsersPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);

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
    <Suspense
      fallback={
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
          <CircularProgress size={32} />
        </Box>
      }
    >
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
    </Suspense>
  );
}
