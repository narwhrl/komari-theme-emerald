"use client";
import { useCallback, useEffect, useRef } from "react";

/**
 * Throttle a callback so it is invoked at most once per `interval` ms.
 * The trailing call (latest args) is preserved.
 */
export function useThrottle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  interval = 250,
): (...args: TArgs) => void {
  const lastCallRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<TArgs | null>(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(
    (...args: TArgs) => {
      const now = Date.now();
      const since = now - lastCallRef.current;
      if (since >= interval) {
        lastCallRef.current = now;
        fnRef.current(...args);
      } else {
        lastArgsRef.current = args;
        if (!timerRef.current) {
          timerRef.current = setTimeout(
            () => {
              timerRef.current = null;
              lastCallRef.current = Date.now();
              if (lastArgsRef.current) {
                fnRef.current(...lastArgsRef.current);
                lastArgsRef.current = null;
              }
            },
            interval - since,
          );
        }
      }
    },
    [interval],
  );
}