import { createTheme } from '@mui/material/styles';
import { ruRU } from '@mui/material/locale';
import { ruRU as gridRuRU } from '@mui/x-data-grid/locales';
import { ruRU as pickersRuRU } from '@mui/x-date-pickers/locales';
import {
  BORDER,
  CONTROL_SIZE,
  DARK_SCHEME,
  DURATION,
  FOCUS_RING,
  FONT_MONO,
  FONT_SANS,
  LIGHT_SCHEME,
  NEUTRAL,
  OVERLAY_SHADOW,
  RADIUS,
  SPACING,
  TOKENS,
} from './tokens';

export type ThemeMode = 'light' | 'dark';

/**
 * Оформление АРМ.
 *
 * Принципы: монохромный хром и цвет только у данных; границы вместо теней;
 * иерархия задаётся размером и насыщенностью текста, а не рамками и заливками;
 * цифры набираются моноширинным начертанием, чтобы разряды в таблицах
 * выстраивались по вертикали и суммы можно было сравнивать взглядом.
 */
/**
 * Оформление для выбранной схемы.
 *
 * Компоненты берут цвета из CSS-переменных и о схеме не знают. Палитре
 * MUI переменные не подходят: она вычисляет производные оттенки и
 * контрастный текст, а для этого нужны настоящие значения цвета —
 * поэтому сюда передаётся набор схемы, а не ссылки на переменные.
 */
export const createAppTheme = (mode: ThemeMode = 'light') => {
  const scheme = mode === 'dark' ? DARK_SCHEME : LIGHT_SCHEME;
  return createTheme(
    {
      palette: {
        mode,
        // Основной цвет — почти чёрный: кнопки и активные состояния не спорят
        // с цветовой маркировкой стадий и статусов
        primary: {
          main: scheme.primary,
          light: scheme.primaryHover,
          // Контрастный текст кнопки — цвет поверхности: в тёмной схеме
          // основная кнопка светлая, и белая подпись на ней исчезла бы
          contrastText: scheme.surface,
        },
        // Акцент отмечает интерактивность: ссылки, выбранное, кольцо фокуса
        secondary: {
          main: scheme.accent,
          dark: scheme.accentHover,
          contrastText: scheme.surface,
        },
        success: { main: scheme.success },
        warning: { main: scheme.warning },
        error: { main: scheme.danger },
        info: { main: scheme.slate },
        text: {
          primary: scheme.textPrimary,
          secondary: scheme.textSecondary,
          disabled: scheme.textDisabled,
        },
        divider: scheme.border,
        background: { default: scheme.background, paper: scheme.surface },
        grey: {
          50: NEUTRAL[50],
          100: NEUTRAL[100],
          200: NEUTRAL[200],
          300: NEUTRAL[300],
          400: NEUTRAL[400],
          500: NEUTRAL[500],
          600: NEUTRAL[600],
          700: NEUTRAL[700],
          800: NEUTRAL[800],
          900: NEUTRAL[900],
        },
      },

      spacing: SPACING,
      shape: { borderRadius: RADIUS.md },

      typography: {
        fontFamily: FONT_SANS,
        // Плотная типографика: крупные заголовки со сжатым межбуквенным
        // расстоянием читаются собраннее и не выглядят «шаблонно»
        h4: {
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          lineHeight: 1.15,
        },
        h5: {
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        },
        h6: { fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' },
        subtitle1: { fontSize: 14, fontWeight: 600 },
        subtitle2: { fontSize: 13, fontWeight: 600 },
        body1: { fontSize: 14, lineHeight: 1.5 },
        body2: { fontSize: 13, lineHeight: 1.5 },
        caption: { fontSize: 12, color: TOKENS.textSecondary },
        // Микрозаголовки разделов: капитель с разрядкой вместо крупного текста
        overline: {
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: TOKENS.textSecondary,
          lineHeight: 1.4,
        },
        button: { fontSize: 13, fontWeight: 500, textTransform: 'none' },
      },

      // Тени отключены полностью: разделение строится на границах
      shadows: Array(25).fill('none') as never,

      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              backgroundColor: TOKENS.background,
              WebkitFontSmoothing: 'antialiased',
            },
            // Цифры выравниваются по разрядам во всех таблицах и сводках
            '.tabular': {
              fontFamily: FONT_MONO,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            },
            '::selection': {
              backgroundColor: TOKENS.primary,
              color: TOKENS.surface,
            },
            // Кольцо фокуса появляется только при навигации с клавиатуры,
            // но появляется всегда: без него интерфейс непроходим без мыши
            '*:focus-visible': FOCUS_RING,
            // Пользователям с отключённой анимацией переходы не нужны
            '@media (prefers-reduced-motion: reduce)': {
              '*': { transitionDuration: '0ms !important' },
            },
          },
        },

        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: {
            root: { backgroundImage: 'none' },
            outlined: { border: BORDER },
          },
        },

        MuiCard: {
          defaultProps: { variant: 'outlined' },
          styleOverrides: { root: { border: BORDER, borderRadius: RADIUS.lg } },
        },
        MuiCardContent: {
          styleOverrides: {
            root: { padding: 20, '&:last-child': { paddingBottom: 20 } },
          },
        },

        MuiButton: {
          defaultProps: { disableElevation: true, disableRipple: true },
          styleOverrides: {
            root: {
              borderRadius: RADIUS.sm,
              padding: '8px 14px',
              minHeight: 36,
              transition: `background-color ${DURATION.fast}ms, border-color ${DURATION.fast}ms`,
            },
            sizeLarge: { minHeight: CONTROL_SIZE, padding: '10px 18px' },
            // Только основной цвет: общий слот contained перебивал и containedError,
            // из-за чего необратимое действие выглядело как обычное
            containedPrimary: {
              backgroundColor: TOKENS.primary,
              color: TOKENS.surface,
              '&:hover': { backgroundColor: TOKENS.primaryHover },
            },
            containedError: {
              backgroundColor: TOKENS.danger,
              color: TOKENS.surface,
              // Затемнение выводится из самого цвета: отдельное значение
              // осталось бы от светлой схемы и в тёмной выглядело грязью
              '&:hover': {
                backgroundColor:
                  'color-mix(in srgb, var(--c-danger) 82%, black)',
              },
            },
            outlined: {
              borderColor: TOKENS.borderStrong,
              color: TOKENS.textPrimary,
              '&:hover': {
                borderColor: TOKENS.primary,
                backgroundColor: 'transparent',
              },
            },
            text: {
              color: TOKENS.textSecondary,
              '&:hover': { backgroundColor: TOKENS.surfaceHover },
            },
          },
        },

        MuiIconButton: {
          defaultProps: { disableRipple: true },
          styleOverrides: {
            root: {
              borderRadius: RADIUS.sm,
              color: TOKENS.textMuted,
              transition: `background-color ${DURATION.fast}ms, color ${DURATION.fast}ms`,
              '&:hover': {
                backgroundColor: TOKENS.surfaceHover,
                color: TOKENS.textPrimary,
              },
            },
            // Размер цели нажатия: мелкие иконки трудно попасть мышью
            sizeSmall: { width: 32, height: 32 },
            sizeMedium: { width: CONTROL_SIZE, height: CONTROL_SIZE },
          },
        },

        MuiChip: {
          styleOverrides: {
            root: { borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 500 },
            outlined: { borderColor: TOKENS.border },
            sizeSmall: { height: 22 },
          },
        },

        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: RADIUS.sm,
              backgroundColor: TOKENS.surface,
              '& fieldset': { borderColor: TOKENS.borderControl },
              '&:hover fieldset': { borderColor: TOKENS.textSecondary },
              '&.Mui-focused fieldset': {
                borderColor: TOKENS.primary,
                borderWidth: 1,
              },
            },
            input: { fontSize: 14 },
          },
        },
        MuiInputLabel: { styleOverrides: { root: { fontSize: 14 } } },
        MuiFormHelperText: {
          styleOverrides: { root: { fontSize: 12, marginLeft: 2 } },
        },

        MuiTabs: {
          styleOverrides: {
            root: { minHeight: 40 },
            indicator: { height: 2, backgroundColor: TOKENS.primary },
          },
        },
        MuiTab: {
          defaultProps: { disableRipple: true },
          styleOverrides: {
            root: {
              minHeight: 40,
              padding: '0 2px',
              marginRight: 24,
              fontSize: 13,
              fontWeight: 500,
              textTransform: 'none',
              color: TOKENS.textMuted,
              minWidth: 0,
              '&.Mui-selected': { color: TOKENS.textPrimary },
            },
          },
        },

        MuiTableCell: {
          styleOverrides: {
            root: { borderBottom: `1px solid ${TOKENS.border}`, fontSize: 13 },
            head: {
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: TOKENS.textSecondary,
              borderBottom: BORDER,
            },
          },
        },

        MuiDialog: {
          styleOverrides: {
            paper: {
              border: BORDER,
              borderRadius: RADIUS.lg,
              boxShadow: OVERLAY_SHADOW,
            },
          },
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              border: BORDER,
              borderRadius: RADIUS.md,
              boxShadow: OVERLAY_SHADOW,
            },
          },
        },
        MuiPopover: {
          styleOverrides: {
            paper: { border: BORDER, boxShadow: OVERLAY_SHADOW },
          },
        },
        MuiDialogTitle: {
          styleOverrides: {
            root: { fontSize: 16, fontWeight: 600, padding: '20px 24px 4px' },
          },
        },

        MuiAlert: {
          styleOverrides: {
            root: { borderRadius: RADIUS.sm, fontSize: 13 },
            standardError: {
              backgroundColor: TOKENS.dangerSoft,
              color: TOKENS.danger,
            },
            standardWarning: {
              backgroundColor: TOKENS.warningSoft,
              color: TOKENS.warning,
            },
            standardSuccess: {
              backgroundColor: TOKENS.successSoft,
              color: TOKENS.success,
            },
            standardInfo: {
              backgroundColor: TOKENS.accentSoft,
              color: TOKENS.accentHover,
            },
          },
        },

        MuiToggleButton: {
          styleOverrides: {
            root: {
              border: BORDER,
              borderRadius: RADIUS.sm,
              color: TOKENS.textMuted,
              padding: '5px 10px',
              textTransform: 'none',
              fontSize: 13,
              '&.Mui-selected': {
                backgroundColor: TOKENS.primary,
                color: TOKENS.surface,
                '&:hover': { backgroundColor: TOKENS.primaryHover },
              },
            },
          },
        },

        MuiDivider: {
          styleOverrides: { root: { borderColor: TOKENS.border } },
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              // Подсказка инвертирована относительно поверхности:
              // в тёмной схеме она светлая, иначе сливается с фоном
              backgroundColor: TOKENS.primary,
              color: TOKENS.surface,
              fontSize: 12,
              borderRadius: RADIUS.sm,
              padding: '6px 10px',
            },
          },
        },
        MuiLink: {
          styleOverrides: {
            root: {
              color: TOKENS.accent,
              // Цвет подчёркивания выводится из акцента, а не задан
              // отдельным значением: иначе в тёмной схеме он остался бы
              // от светлой и ссылка получила бы чужую линию
              textDecorationColor:
                'color-mix(in srgb, currentColor 35%, transparent)',
              textUnderlineOffset: 2,
              '&:hover': { color: TOKENS.accentHover },
            },
          },
        },
      },
    },
    ruRU,
    gridRuRU,
    pickersRuRU,
  );
};

/** Светлая тема по умолчанию — используется в тестах и как запасной вариант. */
export const theme = createAppTheme('light');
