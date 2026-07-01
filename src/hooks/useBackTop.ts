"use client";
import { useEffect, useState } from "react";

/**
 * Track scroll position and provide `scrollToTop`.
 * Returns the current `scrolled` boolean and a smooth scroll-to-top handler.
 */
export function useBackTop(threshold = 1) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  function scrollToTop() {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return { scrolled, scrollToTop };
}