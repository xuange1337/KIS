import { LocalizationProvider } from '@mui/x-date-pickers';
// Для date-fns 3.x нужен отдельный адаптер: AdapterDateFns рассчитан
// на вторую версию библиотеки и обращается к её внутренним модулям
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ru } from 'date-fns/locale';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Переменные начертания: один файл вместо набора весов, поддержка кириллицы
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { App } from './App';
import { AuthProvider } from './features/auth/AuthContext';
import { ThemeModeProvider } from './theme/ThemeModeContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Справочники и списки редко меняются в рамках одного сеанса работы
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeModeProvider>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </LocalizationProvider>
    </ThemeModeProvider>
  </StrictMode>,
);
