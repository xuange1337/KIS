import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createAppTheme, ThemeMode } from './theme';
import { DARK_SCHEME, LIGHT_SCHEME, schemeVariables } from './tokens';

/** Что выбрал пользователь: следовать системе или конкретная схема. */
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'crm.theme';

interface ThemeModeValue {
  preference: ThemePreference;
  /** Схема, которая применена сейчас, с учётом системной настройки. */
  mode: ThemeMode;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

/**
 * Доступ к хранилищу через try/catch.
 *
 * localStorage бросает исключение в приватном режиме и при запрете
 * сайту хранить данные, а в некоторых средах его нет вовсе. Схема
 * оформления — не та настройка, ради которой приложение может не
 * открыться, поэтому недоступное хранилище означает «настройки нет».
 */
const readStored = (): string | null => {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
};

const writeStored = (value: string): void => {
  try {
    window.localStorage?.setItem(STORAGE_KEY, value);
  } catch {
    // Выбор не сохранится до конца сеанса — это лучше, чем исключение
  }
};

const readPreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  const stored = readStored();
  return stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : 'system';
};

const systemMode = (): ThemeMode =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

/**
 * Схема оформления приложения.
 *
 * По умолчанию берётся системная: у того, кто работает в тёмной системе,
 * светлый интерфейс на весь экран — это вспышка при каждом открытии.
 * Явный выбор пользователя сохраняется и системную настройку перекрывает.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readPreference);
  const [systemScheme, setSystemScheme] = useState<ThemeMode>(systemMode);

  // Системная настройка меняется на ходу — например, по расписанию
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return undefined;
    const onChange = () => setSystemScheme(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const mode: ThemeMode = preference === 'system' ? systemScheme : preference;

  /**
   * Схема проставляется атрибутом на корневом элементе: по нему
   * переключаются CSS-переменные, и цвет меняется без перерисовки дерева.
   * color-scheme нужен, чтобы собственные элементы браузера — полосы
   * прокрутки, выпадающие списки — не остались светлыми.
   */
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const setPreference = (next: ThemePreference) => {
    writeStored(next);
    setPreferenceState(next);
  };

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(
    () => ({ preference, mode, setPreference }),
    [preference, mode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <GlobalStyles
          styles={{
            ':root': schemeVariables(LIGHT_SCHEME),
            ":root[data-theme='dark']": schemeVariables(DARK_SCHEME),
          }}
        />
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeValue {
  const value = useContext(ThemeModeContext);
  if (!value) {
    throw new Error('useThemeMode используется вне ThemeModeProvider');
  }
  return value;
}
