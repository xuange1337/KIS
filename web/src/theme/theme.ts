import { createTheme } from '@mui/material/styles';
import { ruRU } from '@mui/material/locale';
import { ruRU as gridRuRU } from '@mui/x-data-grid/locales';
import { ruRU as pickersRuRU } from '@mui/x-date-pickers/locales';

/** Оформление АРМ: спокойная деловая палитра, русская локализация компонентов. */
export const theme = createTheme(
  {
    palette: {
      primary: { main: '#1c4e80' },
      secondary: { main: '#7c5295' },
      success: { main: '#2e7d32' },
      warning: { main: '#ed6c02' },
      error: { main: '#c62828' },
      background: { default: '#f4f6f8', paper: '#ffffff' },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { textTransform: 'none' } },
      },
      MuiPaper: { defaultProps: { elevation: 0 } },
      MuiCard: {
        styleOverrides: {
          root: { border: '1px solid rgba(0, 0, 0, 0.08)' },
        },
      },
    },
  },
  ruRU,
  gridRuRU,
  pickersRuRU,
);
