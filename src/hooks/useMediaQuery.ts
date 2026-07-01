/**
 * useMediaQuery — reactive media query hook with Tailwind-like syntax.
 * Supports breakpoint queries ("sm", "md", "lg"), pointer type ("pointer:fine"),
 * and arbitrary CSS media queries.
 */
"use client";

import { useEffect, useState } from "react";

const BREAKPOINTS: Record<string, string> = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
  "2xl": "(min-width: 1536px)",
};

function parseQuery(input: string): string {
  if (BREAKPOINTS[input]) return BREAKPOINTS[input];
  if (
    input.startsWith("(") ||
    input.startsWith("not") ||
    input.startsWith("only")
  ) {
    return input;
  }
  if (input.startsWith("pointer:")) {
    const type = input.slice("pointer:".length);
    if (type === "fine") return "(pointer: fine)";
    if (type === "coarse") return "(pointer: coarse)";
  }
  return input;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(parseQuery(query));
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}