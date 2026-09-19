import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeModeProvider, useThemeMode } from './ThemeModeContext';
import { createAppTheme } from './theme';
import { DARK_SCHEME, LIGHT_SCHEME } from './tokens';

/**
 * Заглушка хранилища: в jsdom этой среды localStorage нет, а проверяется
 * здесь сохранение выбора, а не поведение конкретного браузера.
 */
const storage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
};

/** Управляемая заглушка системной настройки оформления. */
const mockSystemDark = (dark: boolean) => {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_: string, handler: () => void) =>
      listeners.add(handler),
    removeEventListener: (_: string, handler: () => void) =>
      listeners.delete(handler),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  );
  return {
    setDark(next: boolean) {
      query.matches = next;
      listeners.forEach((handler) => handler());
    },
  };
};

function Probe() {
  const { preference, mode, setPreference } = useThemeMode();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="mode">{mode}</span>
      <button type="button" onClick={() => setPreference('light')}>
        Светлое
      </button>
    </div>
  );
}

describe('Схема оформления', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: storage(),
      configurable: true,
      writable: true,
    });
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('по умолчанию следует настройке системы', () => {
    mockSystemDark(true);
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );

    // У того, кто работает в тёмной системе, светлый интерфейс на весь
    // экран — это вспышка при каждом открытии
    expect(screen.getByTestId('preference')).toHaveTextContent('system');
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('следит за сменой системной настройки на ходу', () => {
    const system = mockSystemDark(false);
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('light');

    act(() => system.setDark(true));
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });

  it('явный выбор перекрывает систему и сохраняется', () => {
    mockSystemDark(true);
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );

    act(() => screen.getByRole('button', { name: 'Светлое' }).click());

    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(window.localStorage.getItem('crm.theme')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('восстанавливает сохранённый выбор при следующем открытии', () => {
    window.localStorage.setItem('crm.theme', 'dark');
    mockSystemDark(false);
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );

    expect(screen.getByTestId('preference')).toHaveTextContent('dark');
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });

  it('обе схемы задают все токены и различаются', () => {
    // Пропущенный токен в тёмной схеме означает цвет из светлой на
    // тёмном фоне — такой дефект виден только глазами, поэтому ключи
    // схем сверяются автоматически
    expect(Object.keys(DARK_SCHEME).sort()).toEqual(
      Object.keys(LIGHT_SCHEME).sort(),
    );
    // Сравниваются значения, а не литеральные типы: TypeScript знает
    // константы обеих схем и считает такое сравнение заведомо ложным
    const light: Record<string, string> = LIGHT_SCHEME;
    const dark: Record<string, string> = DARK_SCHEME;
    const overlapping = Object.keys(light).filter(
      (key) => light[key] === dark[key],
    );
    expect(overlapping).toEqual([]);
  });

  it('палитра MUI берёт значения выбранной схемы', () => {
    expect(createAppTheme('light').palette.background.default).toBe(
      LIGHT_SCHEME.background,
    );
    expect(createAppTheme('dark').palette.background.default).toBe(
      DARK_SCHEME.background,
    );
    // Контрастный текст основной кнопки — цвет поверхности: иначе в
    // тёмной схеме белая подпись исчезла бы на светлой кнопке
    expect(createAppTheme('dark').palette.primary.contrastText).toBe(
      DARK_SCHEME.surface,
    );
  });
});
