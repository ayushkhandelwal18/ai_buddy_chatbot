import { createTheme } from "@mui/material/styles";

/**
 * AI-Buddy design system.
 *
 * A dark, low-contrast palette (like ChatGPT / Gemini) with a cyan accent
 * that matches the existing AI-Buddy branding.
 */
export const colors = {
  background: "#0a0f19",
  sidebar: "#0c111c",
  surface: "#141b28",
  surfaceHover: "#1b2331",
  border: "rgba(255,255,255,0.09)",
  primary: "#22d3ee",
  primarySoft: "rgba(34,211,238,0.12)",
  userBubble: "#1d3b45",
};

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: colors.primary, contrastText: "#041016" },
    secondary: { main: "#818cf8" },
    background: { default: colors.background, paper: colors.surface },
    text: { primary: "#e7ecf3", secondary: "#93a1b8" },
    divider: colors.border,
    error: { main: "#f87171" },
    warning: { main: "#fbbf24" },
    success: { main: "#34d399" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", "Roboto", system-ui, -apple-system, sans-serif',
    h1: { fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontWeight: 700, letterSpacing: "-0.02em" },
    h4: { fontWeight: 700, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: { fontSize: 12, background: "#1f2937", border: `1px solid ${colors.border}` },
        arrow: { color: "#1f2937" },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } },
    },
  },
});

export default theme;
