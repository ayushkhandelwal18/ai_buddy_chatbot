import Header from "./components/Header";
import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { alpha, useTheme } from "@mui/material/styles";
import { colors } from "./theme";
import Home from "./Pages/Home";
import Chat from "./Pages/Chat";
import Login from "./Pages/Login";
import SignUp from "./Pages/Signup";
import Notfound from "./Pages/Notfound";
import "./public.css";
import "./public-theme.css";



function App() {
  const location = useLocation();
  const theme = useTheme();

  // The chat workspace provides its own top bar and needs the full viewport.
  const isChatRoute = location.pathname.startsWith("/chat");
  const isAuthRoute = ["/login", "/signup"].includes(location.pathname);
  const isThemedPublicRoute = location.pathname === "/" || isAuthRoute;
  // Share the existing chat theme across home and auth without styling chat routes.
  const publicStyle = isThemedPublicRoute ? {
    "--public-ink": theme.palette.text.primary,
    "--public-muted": theme.palette.text.secondary,
    "--public-blue": theme.palette.primary.main,
    "--public-line": theme.palette.divider,
    "--public-background": theme.palette.background.default,
    "--public-mode": theme.palette.mode,
    "--public-surface": theme.palette.background.paper,
    "--public-sidebar": colors.sidebar,
    "--public-surface-hover": colors.surfaceHover,
    "--public-header": alpha(theme.palette.background.default, 0.85),
    "--public-primary-hover": theme.palette.primary.light,
    "--public-primary-contrast": theme.palette.primary.contrastText,
    "--public-primary-soft": colors.primarySoft,
    "--public-primary-border": alpha(theme.palette.primary.main, 0.25),
    "--public-primary-border-hover": alpha(theme.palette.primary.main, 0.4),
    "--public-primary-active": alpha(theme.palette.primary.main, 0.2),
    "--public-secondary": theme.palette.secondary.main,
    "--public-secondary-soft": alpha(theme.palette.secondary.main, 0.18),
    "--public-success": theme.palette.success.main,
    "--public-warning": theme.palette.warning.main,
    "--public-error": theme.palette.error.main,
    "--public-error-soft": alpha(theme.palette.error.main, 0.12),
    "--public-error-border": alpha(theme.palette.error.main, 0.25),
    "--public-disabled": theme.palette.action.disabled,
    "--public-disabled-background": theme.palette.action.disabledBackground,
    "--public-form-padding": theme.spacing(3.5),
    "--public-field-gap": theme.spacing(2.25),
    "--public-radius": `${theme.shape.borderRadius}px`,
    "--public-button-radius": `${theme.components.MuiButton.styleOverrides.root.borderRadius}px`,
    "--public-font": theme.typography.fontFamily,
    "--public-heading-weight": theme.typography.h1.fontWeight,
    "--public-heading-spacing": theme.typography.h1.letterSpacing,
    "--public-button-weight": theme.typography.button.fontWeight,
  } : undefined;
  useEffect(() => {
    if (!isChatRoute && !location.hash) window.scrollTo(0, 0);
  }, [isChatRoute, location.pathname, location.hash]);

  return (
    <div
      className={isChatRoute ? "app-shell app-shell--chat" : `app-shell public-shell${isThemedPublicRoute ? " themed-public-shell" : ""}`}
      style={publicStyle}
    >
      {!isChatRoute && !isAuthRoute && <Header />}
      <main id="main-content" tabIndex={-1} className={isChatRoute ? "chat-route-content" : "public-route-content"}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* The chat page guards itself and redirects to /login when needed. */}
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:conversationId" element={<Chat />} />

        <Route path="*" element={<Notfound />} />
      </Routes>
      </main>
    </div>
  );
}

export default App
