/**
 * useThemeMode — applies the user's chosen theme mode to <html> and
 * exposes the resolved light/dark flag.
 *
 * Replaces the Vue `useDark` + watcher pattern from Provider.vue.
 */
"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app";

export function useThemeMode() {
  const themeMode = useAppStore((s) => s.themeMode);
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setPrefersDark(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const isDark =
    themeMode === "dark" || (themeMode === "auto" && prefersDark);
  const resolved: "light" | "dark" = isDark ? "dark" : "light";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  return { themeMode, isDark, resolved, prefersDark };
}