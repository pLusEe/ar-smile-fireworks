type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;

  const mediaQueryMatches =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)").matches
      : false;
  const iosStandalone = (window.navigator as NavigatorWithStandalone).standalone === true;

  return mediaQueryMatches || iosStandalone;
}

export function syncStandaloneDisplayModeDataAttr() {
  if (typeof document === "undefined") return false;

  const standalone = isStandaloneDisplayMode();
  document.documentElement.dataset.appDisplayMode = standalone ? "standalone" : "browser";
  return standalone;
}
