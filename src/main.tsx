import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@byted-tiktok/tux-web/styles.css";
import App from "./App";
import { ThemeProvider, useTheme } from "./context/theme";
import { useOverlayStyle } from "./hooks/useOverlayStyle";
import { buildDesagentRoutesManifest } from "./routes";
import { syncStandaloneDisplayModeDataAttr } from "./utils/display_mode";

if (typeof window !== "undefined") {
  syncStandaloneDisplayModeDataAttr();
  window.__DESAGENT_ROUTES__ = buildDesagentRoutesManifest();
}

function DesagentRuntimeBridge() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useOverlayStyle({
    statusBar: isDark ? "light" : "dark",
    themeColor: isDark ? "#161823" : "#f7f7f7",
  });

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <DesagentRuntimeBridge />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
