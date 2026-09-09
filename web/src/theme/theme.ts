import { createTheme } from '@mui/material/styles';
import { ruRU } from '@mui/material/locale';
import { ruRU as gridRuRU } from '@mui/x-data-grid/locales';
import { ruRU as pickersRuRU } from '@mui/x-date-pickers/locales';
import {
  BORDER,
  CONTROL_SIZE,
  DATA,
  DURATION,
  FOCUS_RING,
  FONT_MONO,
  FONT_SANS,
  NEUTRAL,
  OVERLAY_SHADOW,
  RADIUS,
  SPACING,
  TOKENS,
} from './tokens';

/**
 * Оформление АРМ.
 *
 * Принципы: монохромный хром и цвет только у данных; границы вместо теней;
 * иерархия задаётся размером и насыщенностью текста, а не рамками и заливками;
 * цифры набираются моноширинным начертанием, чтобы разряды в таблицах
 * выстраивались по вертикали и суммы можно было сравнивать взглядом.
 */
export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      // Основной цвет — почти чёрный: кнопки и активные состояния не спорят
      // с цветовой маркировкой стадий и статусов
      primary: {
        main: NEUTRAL[900],
        light: NEUTRAL[700],
        dark: '#000000',
        contrastText: NEUTRAL[0],
      },
      // Акцент отмечает интерактивность: ссылки, выбранное, кольцо фокуса
      secondary: { main: TOKENS.accent, dark: TOKENS.accentHover, contrastText: NEUTRAL[0] },
      success: { main: TOKENS.success },
      warning: { main: TOKENS.warning },
      error: { main: TOKENS.danger },
      info: { main: DATA.slate },
      text: {
        primary: NEUTRAL[900],
        secondary: NEUTRAL[500],
        disabled: NEUTRAL[400],
      },
      divider: NEUTRAL[200],
      background: { default: NEUTRAL[50], paper: NEUTRAL[0] },
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
      h4: { fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.15 },
      h5: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 },
      h6: { fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontSize: 14, fontWeight: 600 },
      subtitle2: { fontSize: 13, fontWeight: 600 },
      body1: { fontSize: 14, lineHeight: 1.5 },
      body2: { fontSize: 13, lineHeight: 1.5 },
      caption: { fontSize: 12, color: NEUTRAL[500] },
      // Микрозаголовки разделов: капитель с разрядкой вместо крупного текста
      overline: {
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: NEUTRAL[500],
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
            backgroundColor: NEUTRAL[50],
            WebkitFontSmoothing: 'antialiased',
          },
          // Цифры выравниваются по разрядам во всех таблицах и сводках
          '.tabular': {
            fontFamily: FONT_MONO,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          },
          '::selection': {
            backgroundColor: NEUTRAL[900],
            color: NEUTRAL[0],
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
          contained: {
            backgroundColor: NEUTRAL[900],
            '&:hover': { backgroundColor: NEUTRAL[700] },
          },
          outlined: {
            borderColor: NEUTRAL[300],
            color: NEUTRAL[800],
            '&:hover': {
              borderColor: NEUTRAL[900],
              backgroundColor: 'transparent',
            },
          },
          text: {
            color: NEUTRAL[700],
            '&:hover': { backgroundColor: NEUTRAL[100] },
          },
        },
      },

      MuiIconButton: {
        defaultProps: { disableRipple: true },
        styleOverrides: {
          root: {
            borderRadius: RADIUS.sm,
            color: NEUTRAL[500],
            transition: `background-color ${DURATION.fast}ms, color ${DURATION.fast}ms`,
            '&:hover': { backgroundColor: NEUTRAL[100], color: NEUTRAL[900] },
          },
          // Размер цели нажатия: мелкие иконки трудно попасть мышью
          sizeSmall: { width: 32, height: 32 },
          sizeMedium: { width: CONTROL_SIZE, height: CONTROL_SIZE },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 500 },
          outlined: { borderColor: NEUTRAL[200] },
          sizeSmall: { height: 22 },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: RADIUS.sm,
            backgroundColor: NEUTRAL[0],
            '& fieldset': { borderColor: NEUTRAL[200] },
            '&:hover fieldset': { borderColor: NEUTRAL[300] },
            '&.Mui-focused fieldset': {
              borderColor: NEUTRAL[900],
              borderWidth: 1,
            },
          },
          input: { fontSize: 14 },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontSize: 14 } } },
      MuiFormHelperText: { styleOverrides: { root: { fontSize: 12, marginLeft: 2 } } },

      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 40 },
          indicator: { height: 2, backgroundColor: NEUTRAL[900] },
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
            color: NEUTRAL[500],
            minWidth: 0,
            '&.Mui-selected': { color: NEUTRAL[900] },
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${NEUTRAL[100]}`, fontSize: 13 },
          head: {
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: NEUTRAL[500],
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
          standardError: { backgroundColor: TOKENS.dangerSoft, color: TOKENS.danger },
          standardWarning: { backgroundColor: TOKENS.warningSoft, color: TOKENS.warning },
          standardSuccess: { backgroundColor: TOKENS.successSoft, color: TOKENS.success },
          standardInfo: { backgroundColor: TOKENS.accentSoft, color: TOKENS.accentHover },
        },
      },

      MuiToggleButton: {
        styleOverrides: {
          root: {
            border: BORDER,
            borderRadius: RADIUS.sm,
            color: NEUTRAL[500],
            padding: '5px 10px',
            textTransform: 'none',
            fontSize: 13,
            '&.Mui-selected': {
              backgroundColor: NEUTRAL[900],
              color: NEUTRAL[0],
              '&:hover': { backgroundColor: NEUTRAL[800] },
            },
          },
        },
      },

      MuiDivider: { styleOverrides: { root: { borderColor: NEUTRAL[200] } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: NEUTRAL[900],
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
            textDecorationColor: 'rgba(43, 92, 230, 0.35)',
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
