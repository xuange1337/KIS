/**
 * Дизайн-токены АРМ.
 *
 * Хром интерфейса монохромный, цвет несёт смысл: акцент отмечает то, с чем
 * можно взаимодействовать, семантические цвета — состояние данных. Так в
 * плотной таблице взгляд не рассеивается по декоративным заливкам.
 */

/** Нейтральная шкала, слегка тёплая: чистый серый выглядит стерильно. */
export const NEUTRAL = {
  0: '#FFFFFF',
  25: '#FCFCFB',
  50: '#F7F7F5',
  100: '#EFEFEC',
  200: '#E3E3DF',
  300: '#CBCBC5',
  400: '#9A9A93',
  500: '#6E6E68',
  600: '#4E4E49',
  700: '#373733',
  800: '#232320',
  900: '#141412',
} as const;

/**
 * Семантические токены. Компоненты обращаются к ним, а не к шкале напрямую:
 * это позволяет менять оформление в одном месте.
 */
export const TOKENS = {
  background: NEUTRAL[50],
  surface: NEUTRAL[0],
  surfaceHover: NEUTRAL[50],
  surfaceSunken: NEUTRAL[25],

  border: NEUTRAL[200],
  borderStrong: NEUTRAL[300],

  textPrimary: NEUTRAL[900],
  textSecondary: NEUTRAL[500],
  textMuted: NEUTRAL[400],

  /** Основное действие — почти чёрный, как в современных рабочих системах. */
  primary: NEUTRAL[900],
  primaryHover: NEUTRAL[700],

  /** Акцент отмечает интерактивность: ссылки, выбранное, кольцо фокуса. */
  accent: '#2B5CE6',
  accentHover: '#1E48C4',
  accentSoft: '#EEF2FE',

  success: '#2F7A3E',
  successSoft: '#EDF6EE',
  warning: '#A9700F',
  warningSoft: '#FBF4E6',
  danger: '#B3352C',
  dangerSoft: '#FBEFEE',
} as const;

/**
 * Палитра данных: стадии, типы активностей, серии графиков.
 * Оттенки приглушены и различимы в том числе в чёрно-белой печати.
 */
export const DATA = {
  slate: '#5B6B7C',
  indigo: '#4C5BA8',
  teal: '#2E7D74',
  green: '#3F7D3A',
  amber: '#B7791F',
  orange: '#C05621',
  red: '#B03A32',
  violet: '#6B4E9B',
} as const;

/** Единый шаг сетки: 4, 8, 12, 16, 20, 24, 32, 40 — кратные восьми и четырём. */
export const SPACING = 8;

export const RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

/** Границы вместо теней: тень зашумляет плотные списки. */
export const BORDER = `1px solid ${TOKENS.border}`;

/** Единственная тень — для всплывающих слоёв, где нужен отрыв от фона. */
export const OVERLAY_SHADOW = '0 8px 24px -8px rgba(20, 20, 18, 0.18)';

/** Длительность переходов: заметно, но не задерживает работу. */
export const DURATION = { fast: 120, normal: 180 } as const;

/** Минимальный размер элемента управления для уверенного попадания. */
export const CONTROL_SIZE = 40;

export const FONT_SANS =
  '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Моноширинный — для сумм, дат и идентификаторов в таблицах. */
export const FONT_MONO =
  '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';

/** Видимое кольцо фокуса для навигации с клавиатуры. */
export const FOCUS_RING = {
  outline: `2px solid ${TOKENS.accent}`,
  outlineOffset: '2px',
} as const;
