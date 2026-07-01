/**
 * useThemeVars — read CSS custom properties from the root <html> element.
 * Used by ECharts and other JS-driven visuals that need to react to the
 * light/dark mode without re-rendering the React tree.
 */
"use client";

import { useEffect, useState } from "react";

const FALLBACKS: Record<string, string> = {
  "--success": "oklch(0.696 0.17 162.48)",
  "--info": "oklch(0.6 0.118 230)",
  "--warning": "oklch(0.768 0.155 70)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--primary": "oklch(0.21 0.006 285.885)",
  "--foreground": "oklch(0.141 0.005 285.823)",
  "--muted-foreground": "oklch(0.552 0.016 285.938)",
  "--border": "oklch(0.92 0.004 286.32)",
  "--background": "oklch(1 0 0)",
  "--card": "oklch(1 0 0)",
  "--muted": "oklch(0.967 0.001 286.375)",
};

export interface ThemeVars {
  successColor: string;
  infoColor: string;
  warningColor: string;
  errorColor: string;
  primaryColor: string;
  textColor1: string;
  textColor2: string;
  textColor3: string;
  borderColor: string;
  bodyColor: string;
  cardColor: string;
  progressRailColor: string;
}

function read(): ThemeVars {
  if (typeof document === "undefined") {
    return Object.fromEntries(
      Object.entries(FALLBACKS).map(([k, v]) => [
        k.replace(/^--/, "").replace(/-./g, (c) => c[1].toUpperCase()),
        v,
      ]),
    ) as unknown as ThemeVars;
  }
  const cs = getComputedStyle(document.documentElement);
  const get = (name: keyof typeof FALLBACKS) =>
    cs.getPropertyValue(name).trim() || FALLBACKS[name];
  return {
    successColor: get("--success"),
    infoColor: get("--info"),
    warningColor: get("--warning"),
    errorColor: get("--destructive"),
    primaryColor: get("--primary"),
    textColor1: get("--foreground"),
    textColor2: get("--foreground"),
    textColor3: get("--muted-foreground"),
    borderColor: get("--border"),
    bodyColor: get("--background"),
    cardColor: get("--card"),
    progressRailColor: get("--muted"),
  };
}

export function useThemeVars(): ThemeVars {
  const [vars, setVars] = useState<ThemeVars>(() => read());
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() => setVars(read()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => obs.disconnect();
  }, []);
  return vars;
}