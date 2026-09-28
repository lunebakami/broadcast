import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createTheme, ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { CssBaseline, GlobalStyles } from '@mui/material';
import App from './App';
import './styles.css';

const theme = createTheme({
  palette: { primary: { main: '#146c54' }, background: { default: '#f6f8f7' } },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { padding: '10px 18px' } },
    },
    MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px' } } },
  },
});
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyledEngineProvider enableCssLayer>
      <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </StyledEngineProvider>
  </StrictMode>,
);
