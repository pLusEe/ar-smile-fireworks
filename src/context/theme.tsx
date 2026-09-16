import React, {
  type CSSProperties,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

/**
 * The DOM attribute update must run BEFORE the browser paints — otherwise the
 * new tab can be painted with the old `data-tux-color-scheme` for one frame
 * (a visible theme flash). `useLayoutEffect` is undefined during SSR; falling
 * back to `useEffect` there keeps the build warning-free without changing
 * client behavior (this app is a Vite SPA so the layout effect runs).
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedTheme: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "tux_empty_demo.themeMode";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredMode(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "system" || value === "light" || value === "dark")
      return value;
    return null;
  } catch {
    return null;
  }
}

function writeStoredMode(mode: ThemeMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

function applyResolvedThemeToDom(resolvedTheme: ResolvedTheme) {
  // TUX styles are keyed off [data-tux-color-scheme="light"|"dark"]
  document.documentElement.setAttribute("data-tux-color-scheme", resolvedTheme);
  // Also hint native form controls
  (document.documentElement.style as any).colorScheme = resolvedTheme;
}

export function ThemeScope({
  mode,
  children,
  className,
  style,
}: {
  mode: ThemeMode;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    getSystemTheme(),
  );

  useEffect(() => {
    if (mode !== "system") return;
    if (typeof window === "undefined") return;

    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mql) return;

    const handleChange = () => setSystemTheme(getSystemTheme());

    // Safari compatibility
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handleChange);
      return () => mql.removeEventListener("change", handleChange);
    }

    // eslint-disable-next-line deprecation/deprecation
    mql.addListener(handleChange);
    // eslint-disable-next-line deprecation/deprecation
    return () => mql.removeListener(handleChange);
  }, [mode]);

  const resolvedTheme = mode === "system" ? systemTheme : mode;

  return (
    <div
      data-tux-color-scheme={resolvedTheme}
      className={className}
      style={{ ...(style ?? {}), colorScheme: resolvedTheme }}
    >
      {children}
    </div>
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(
    () => readStoredMode() ?? "system",
  );
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    getSystemTheme(),
  );

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    writeStoredMode(nextMode);
  }, []);

  const resolvedTheme: ResolvedTheme =
    mode === "system" ? systemTheme : mode;

  useIsomorphicLayoutEffect(() => {
    applyResolvedThemeToDom(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    // Keep systemTheme in sync with system changes.
    if (typeof window === "undefined") return;
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mql) return;

    const handleChange = () => {
      const nextResolved = getSystemTheme();
      setSystemTheme(nextResolved);
    };

    // Safari compatibility
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handleChange);
      return () => mql.removeEventListener("change", handleChange);
    }

    // eslint-disable-next-line deprecation/deprecation
    mql.addListener(handleChange);
    // eslint-disable-next-line deprecation/deprecation
    return () => mql.removeListener(handleChange);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, resolvedTheme }),
    [mode, resolvedTheme, setMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
