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

async function retireLegacyServiceWorker() {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  const controllerWasActive = navigator.serviceWorker.controller !== null;
  const registrations = await navigator.serviceWorker.getRegistrations();
  const removalResults = await Promise.all(
    registrations.map((registration) => registration.unregister()),
  );

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  if (
    controllerWasActive &&
    removalResults.some(Boolean) &&
    window.sessionStorage.getItem("legacy-sw-retired") !== "1"
  ) {
    window.sessionStorage.setItem("legacy-sw-retired", "1");
    window.location.reload();
  }
}

void retireLegacyServiceWorker();

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
