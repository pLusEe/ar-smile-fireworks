import { useEffect } from "react";

export type OverlayStyle = "auto" | "light" | "dark";

type OverlayStyleOptions = {
  statusBar: OverlayStyle;
  homeIndicator?: OverlayStyle;
  themeColor?: string;
  /**
   * For Desagent phone previews:
   * send overlay-style hints so the host simulator can render status bar
   * and home indicator glyphs against the real page background.
   *
   * Outside Desagent this hook remains harmless: it only updates meta tags
   * and skips host messaging when there is no parent frame to talk to.
   */
  enabled?: boolean;
};

function ensureMetaTag(name: string): HTMLMetaElement | null {
  if (typeof document === "undefined") return null;
  let meta = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (meta) return meta;

  meta = document.createElement("meta");
  meta.name = name;
  document.head.append(meta);
  return meta;
}

function statusBarStyleToAppleMeta(style: OverlayStyle): string {
  if (style === "dark") return "default";
  if (style === "light") return "black-translucent";
  return "default";
}

type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

function parseColorChannel(value: string, maxValue: number): number {
  if (value.endsWith("%")) {
    return (Number(value.slice(0, -1)) / 100) * maxValue;
  }
  return Number(value);
}

function parseCssColor(color: string): RgbaColor | null {
  const normalized = color.trim().toLowerCase();
  if (!normalized || normalized === "transparent") return null;

  if (normalized.startsWith("rgb")) {
    const channels = normalized.match(/[\d.]+%?/g);
    if (!channels || channels.length < 3) return null;

    const alpha = channels[3]
      ? parseColorChannel(channels[3], 1)
      : 1;

    return {
      r: parseColorChannel(channels[0], 255),
      g: parseColorChannel(channels[1], 255),
      b: parseColorChannel(channels[2], 255),
      a: alpha,
    };
  }

  if (normalized.startsWith("color(srgb")) {
    const channels = normalized.match(/[\d.]+/g);
    if (!channels || channels.length < 3) return null;

    return {
      r: Number(channels[0]) * 255,
      g: Number(channels[1]) * 255,
      b: Number(channels[2]) * 255,
      a: channels[3] ? Number(channels[3]) : 1,
    };
  }

  return null;
}

function isVisibleColor(color: string): boolean {
  const parsed = parseCssColor(color);
  return parsed !== null && parsed.a > 0.01;
}

function getNearestVisibleBackground(element: Element | null): string | null {
  if (typeof window === "undefined") return null;

  let current: Element | null = element;
  while (current) {
    const backgroundColor = window.getComputedStyle(current).backgroundColor;
    if (isVisibleColor(backgroundColor)) return backgroundColor;
    current = current.parentElement;
  }

  for (const fallback of [document.body, document.documentElement]) {
    if (!fallback) continue;
    const backgroundColor = window.getComputedStyle(fallback).backgroundColor;
    if (isVisibleColor(backgroundColor)) return backgroundColor;
  }

  return null;
}

function getRelativeLuminance({ r, g, b }: RgbaColor): number {
  const toLinear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function overlayStyleForBackground(backgroundColor: string): OverlayStyle | null {
  const parsed = parseCssColor(backgroundColor);
  if (!parsed || parsed.a <= 0.01) return null;

  return getRelativeLuminance(parsed) > 0.5 ? "dark" : "light";
}

function inferHomeIndicatorStyle(): OverlayStyle {
  if (typeof document === "undefined" || typeof window === "undefined") return "auto";

  const sampleX = Math.max(0, Math.floor(window.innerWidth / 2));
  const sampleY = Math.max(0, window.innerHeight - 1);
  const sampleElement = document.elementFromPoint(sampleX, sampleY);
  const backgroundColor = getNearestVisibleBackground(sampleElement);

  return backgroundColor ? overlayStyleForBackground(backgroundColor) ?? "auto" : "auto";
}

function postOverlayStyle(statusBar: OverlayStyle, homeIndicator?: OverlayStyle): void {
  if (typeof window === "undefined") return;
  if (window.parent === window) return;

  window.parent.postMessage(
    {
      type: "sim:overlay-style",
      statusBar,
      homeIndicator: homeIndicator ?? inferHomeIndicatorStyle(),
    },
    "*",
  );
}

export function useOverlayStyle({
  statusBar,
  homeIndicator,
  themeColor,
  enabled = true,
}: OverlayStyleOptions): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!enabled) return;

    const appleMeta = ensureMetaTag("apple-mobile-web-app-status-bar-style");
    const themeColorMeta = themeColor ? ensureMetaTag("theme-color") : null;

    if (appleMeta) {
      appleMeta.content = statusBarStyleToAppleMeta(statusBar);
    }
    if (themeColorMeta && themeColor) {
      themeColorMeta.content = themeColor;
    }

    postOverlayStyle(statusBar, homeIndicator);
    const frameId = window.requestAnimationFrame(() => {
      postOverlayStyle(statusBar, homeIndicator);
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "sim:get-overlay-style") return;
      postOverlayStyle(statusBar, homeIndicator);
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("message", handleMessage);
    };
  }, [enabled, homeIndicator, statusBar, themeColor]);
}
