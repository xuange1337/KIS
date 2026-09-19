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
  /** Граница контролов и нейтральные маркеры: 3:1 к белому (WCAG 1.4.11). */
  450: '#8E8E87',
  500: '#6E6E68',
  600: '#4E4E49',
  700: '#373733',
  800: '#232320',
  900: '#141412',
} as const;

/**
 * Семантические токены.
 *
 * Компоненты обращаются к ним, а не к шкале напрямую, и получают не
 * значение цвета, а ссылку на CSS-переменную. Благодаря этому смена
 * схемы оформления не требует перерисовки дерева React и не заставляет
 * переписывать каждый компонент: переменные переопределяются один раз
 * на корневом элементе.
 */
const cssVar = (name: string): string => `var(--c-${name})`;

export const TOKENS = {
  background: cssVar('background'),
  surface: cssVar('surface'),
  surfaceHover: cssVar('surface-hover'),
  surfaceSunken: cssVar('surface-sunken'),

  /** Декоративные разделители: карточки, строки таблиц, линии секций. */
  border: cssVar('border'),
  borderStrong: cssVar('border-strong'),
  /**
   * Граница, по которой опознаётся поле ввода. Отделена от декоративной:
   * 1.4.11 требует для неё 3:1, тогда как разделители из-под нормы выведены.
   */
  borderControl: cssVar('border-control'),

  textPrimary: cssVar('text-primary'),
  textSecondary: cssVar('text-secondary'),
  textMuted: cssVar('text-muted'),
  /** Только для нетекстовых элементов: иконки-заглушки, выключенные контролы. */
  textDisabled: cssVar('text-disabled'),

  /** Основное действие. В светлой схеме почти чёрное, в тёмной — почти белое. */
  primary: cssVar('primary'),
  primaryHover: cssVar('primary-hover'),

  /** Акцент отмечает интерактивность: ссылки, выбранное, кольцо фокуса. */
  accent: cssVar('accent'),
  accentHover: cssVar('accent-hover'),
  accentSoft: cssVar('accent-soft'),

  success: cssVar('success'),
  successSoft: cssVar('success-soft'),
  warning: cssVar('warning'),
  warningSoft: cssVar('warning-soft'),
  danger: cssVar('danger'),
  dangerSoft: cssVar('danger-soft'),
  /** Рамка блока с просроченным: тревожная, но не кричащая. */
  dangerBorder: cssVar('danger-border'),
} as const;

/**
 * Светлая схема — основная.
 * Нейтральные тона слегка тёплые: чистый серый выглядит стерильно.
 */
export const LIGHT_SCHEME = {
  background: NEUTRAL[50],
  surface: NEUTRAL[0],
  surfaceHover: NEUTRAL[50],
  surfaceSunken: NEUTRAL[25],
  border: NEUTRAL[200],
  borderStrong: NEUTRAL[300],
  borderControl: NEUTRAL[450],
  textPrimary: NEUTRAL[900],
  textSecondary: NEUTRAL[600],
  textMuted: NEUTRAL[500],
  textDisabled: NEUTRAL[400],
  primary: NEUTRAL[900],
  primaryHover: NEUTRAL[700],
  accent: '#2B5CE6',
  accentHover: '#1E48C4',
  accentSoft: '#EEF2FE',
  success: '#2F7A3E',
  successSoft: '#EDF6EE',
  warning: '#8C5B0C',
  warningSoft: '#FBF4E6',
  danger: '#B3352C',
  dangerSoft: '#FBEFEE',
  dangerBorder: '#E9C4C0',
  slate: '#5B6B7C',
  indigo: '#4C5BA8',
  teal: '#2E7D74',
  green: '#3F7D3A',
  amber: '#B7791F',
  orange: '#C05621',
  red: '#B03A32',
  violet: '#6B4E9B',
  /** Нейтральный маркер статуса: 3:1 к поверхности, иначе точка теряется. */
  dotNeutral: NEUTRAL[450],
  /** Единственная тень — для всплывающих слоёв. */
  overlayShadow: '0 8px 24px -8px rgba(20, 20, 18, 0.18)',
} as const;

/**
 * Тёмная схема.
 *
 * Не инверсия светлой: на тёмном фоне те же насыщенные цвета выглядят
 * грязными, а тонкие границы пропадают. Поверхности чуть светлее фона,
 * данные и акцент осветлены до читаемых значений — текст и границы
 * контролов проверены на 4.5:1 и 3:1 к своей поверхности.
 */
export const DARK_SCHEME = {
  background: '#131311',
  surface: '#1B1B18',
  surfaceHover: '#232320',
  surfaceSunken: '#0F0F0E',
  border: '#2F2F2B',
  borderStrong: '#3E3E38',
  borderControl: '#6E6E66',
  textPrimary: '#F2F2EE',
  textSecondary: '#BDBDB5',
  textMuted: '#9C9C94',
  textDisabled: '#6E6E66',
  primary: '#F2F2EE',
  primaryHover: '#D6D6D0',
  accent: '#87A4FF',
  accentHover: '#A6BBFF',
  accentSoft: '#1D2438',
  success: '#6FC07B',
  successSoft: '#16251A',
  warning: '#DCA94B',
  warningSoft: '#2A2114',
  danger: '#EE8074',
  dangerSoft: '#2C1817',
  dangerBorder: '#5C312B',
  slate: '#9BAEC1',
  indigo: '#94A0E0',
  teal: '#62B8AD',
  green: '#7FBE79',
  amber: '#DDA94A',
  orange: '#E08A56',
  red: '#E87F76',
  violet: '#AE93DC',
  dotNeutral: '#84847C',
  // На тёмном фоне мягкая тень не видна: отрыв слоя задаётся более
  // плотной тенью и границей поверхности
  overlayShadow: '0 12px 32px -8px rgba(0, 0, 0, 0.64)',
} as const;

/** Набор значений одной схемы оформления: светлой или тёмной. */
export type ColorScheme = typeof LIGHT_SCHEME;

/**
 * Палитра данных: стадии, типы активностей, серии графиков.
 * Оттенки приглушены и различимы в том числе в чёрно-белой печати.
 */
export const DATA = {
  slate: cssVar('slate'),
  indigo: cssVar('indigo'),
  teal: cssVar('teal'),
  green: cssVar('green'),
  amber: cssVar('amber'),
  orange: cssVar('orange'),
  red: cssVar('red'),
  violet: cssVar('violet'),
} as const;

/** Имя CSS-переменной по имени токена: surfaceHover → --c-surface-hover. */
const variableName = (token: string): string =>
  `--c-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

/** Объявление переменных схемы — подставляется в глобальные стили. */
export const schemeVariables = (
  scheme: ColorScheme | typeof DARK_SCHEME,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(scheme).map(([token, value]) => [
      variableName(token),
      value,
    ]),
  );

/**
 * Нейтральный маркер статуса. Шкала 400 даёт 2.83:1 к белому — точка такого
 * цвета в плотной таблице теряется, поэтому маркеры берут отдельный токен.
 */
export const DOT_NEUTRAL = cssVar('dot-neutral');

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
export const OVERLAY_SHADOW = cssVar('overlay-shadow');

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
