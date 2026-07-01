"use client";

/**
 * Global ARIA live region. Components and event handlers can dispatch
 * `komari:announce` CustomEvents on `window` to broadcast a message to
 * assistive technologies. Two regions are rendered:
 *
 *   - `polite`: for non-urgent status updates (e.g. "已应用浅色主题")
 *   - `assertive`: for urgent messages (e.g. "连接服务器失败")
 *
 * The component is mounted once at the app root.
 */
import { useEffect, useRef, useState } from "react";

const POLITE_EVENT = "komari:announce";
const ASSERTIVE_EVENT = "komari:announce:assertive";
const RESET_AFTER_MS = 5000;

export function LiveAnnouncer() {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onPolite(e: Event) {
      const detail = (e as CustomEvent<string>).detail ?? "";
      setPolite(detail);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setPolite(""), RESET_AFTER_MS);
    }
    function onAssert(e: Event) {
      const detail = (e as CustomEvent<string>).detail ?? "";
      setAssertive(detail);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setAssertive(""), RESET_AFTER_MS);
    }
    window.addEventListener(POLITE_EVENT, onPolite);
    window.addEventListener(ASSERTIVE_EVENT, onAssert);
    return () => {
      window.removeEventListener(POLITE_EVENT, onPolite);
      window.removeEventListener(ASSERTIVE_EVENT, onAssert);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {polite}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertive}
      </div>
    </>
  );
}

/** Helper: dispatch a polite announcement from anywhere in the app. */
export function announce(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("komari:announce", { detail: message }));
}

/** Helper: dispatch an assertive (urgent) announcement. */
export function announceAssertive(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("komari:announce:assertive", { detail: message }),
  );
}

export default LiveAnnouncer;