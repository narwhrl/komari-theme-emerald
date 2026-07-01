"use client";

/**
 * Providers — wraps the entire app with all client-side context.
 * Replaces `main.ts` (Pinia + Router install) and `App.vue` + `Provider.vue`.
 *
 * Composition:
 *   - TanStack Query (data layer, replaces ad-hoc fetch in stores)
 *   - Toaster (sonner) — replacement for vue-sonner
 *   - Global aria-live region for app-level announcements
 *   - AppInit — drives `initApp()` + `destroyInitManager()` on mount/unmount
 *   - Background + Header + Footer are placed here so they persist across
 *     route transitions inside the App Router.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";
import { Toaster } from "sonner";

import { Background } from "@/components/background/Background";
import { Footer } from "@/components/footer/Footer";
import { Header } from "@/components/header/Header";
import { BackTop } from "@/components/ui/BackTop";
import { LoadingCover } from "@/components/loading/LoadingCover";
import { LiveAnnouncer } from "@/components/a11y/LiveAnnouncer";
import { initApp, destroyInitManager } from "@/utils/init";
import { message } from "@/utils/message";
import { useAppStore } from "@/stores/app";
import { useThemeMode } from "@/hooks/useThemeMode";
import "@/utils/echarts"; // register echarts modules once

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const loading = useAppStore((s) => s.loading);
  const [mounted, setMounted] = useState(false);

  // Expose the toast helper globally (mirrors `window.$message`).
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.$message = message;
    }
  }, []);

  // Drive app initialization on the client.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initApp();
      } catch (e) {
        console.error("[App] Initialization failed:", e);
        // Surface the failure to assistive tech via the live region.
        window.dispatchEvent(
          new CustomEvent("komari:announce", {
            detail: "应用初始化失败，请刷新页面重试。",
          }),
        );
      } finally {
        if (!cancelled) setMounted(true);
      }
    })();
    return () => {
      cancelled = true;
      destroyInitManager();
    };
  }, []);

  return (
    <QueryClientProvider client={client}>
      <ThemeModeEffect />
      <Background />
      <LoadingCover visible={loading} />
      <Header />
      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto">{children}</div>
      </main>
      <Footer />
      <BackTop />
      <LiveAnnouncer />
      <Toaster richColors closeButton position="top-center" />
    </QueryClientProvider>
  );
}

/**
 * Keeps `<html class="dark">` in sync with the user's chosen theme mode.
 * Mounted as a sibling of Providers so its hooks run inside the same tree
 * but are isolated from children that may render server-side.
 */
function ThemeModeEffect() {
  useThemeMode();
  return null;
}