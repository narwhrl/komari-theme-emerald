/**
 * Application store — Zustand port of the original Pinia store.
 * Public settings, theme mode, layout flags, formatting preferences, persisted UI state.
 */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicSettings } from "@/utils/api";
import type { ByteDecimalsConfig } from "@/utils/helper";

export type ThemeMode = "auto" | "light" | "dark";
type Lang = "zh-CN" | "en-US";
export type NodeViewMode = "card" | "list";
type RpcTransportMode = "websocket" | "http";
export type EarthViewMode = "earth" | "earth-stop" | "maps" | "cards" | "hide";

const BYTE_DECIMALS: ByteDecimalsConfig = {
  B: 0,
  KB: 0,
  MB: 1,
  GB: 1,
  TB: 2,
};

function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}
function isValidEarthViewMode(value: unknown): value is EarthViewMode {
  return (
    value === "earth" ||
    value === "earth-stop" ||
    value === "maps" ||
    value === "cards" ||
    value === "hide"
  );
}

interface ThemeSettingHelpers {
  bool: (key: string, def: boolean) => boolean;
  str: (key: string, def: string) => string;
  num: (key: string, def: number, min?: number, max?: number) => number;
}

const makeHelpers = (
  themeSettings: Record<string, unknown> | null | undefined,
): ThemeSettingHelpers => ({
  bool: (key, def) => {
    const v = themeSettings?.[key];
    return typeof v === "boolean" ? v : def;
  },
  str: (key, def) => {
    const v = themeSettings?.[key];
    return typeof v === "string" ? v : def;
  },
  num: (key, def, min, max) => {
    const v = themeSettings?.[key];
    if (typeof v !== "number") return def;
    if (min !== undefined && v < min) return def;
    if (max !== undefined && v > max) return def;
    return v;
  },
});

export interface AppStore {
  loading: boolean;
  themeMode: ThemeMode;
  lang: Lang;
  publicSettings: PublicSettings | undefined;
  nodeSelectedGroup: string;
  storedViewMode: NodeViewMode | null;
  isLoggedIn: boolean;
  connectionError: boolean;
  homeScrollPosition: number;

  // Setters
  setLoading: (v: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  cycleThemeMode: () => void;
  setNodeSelectedGroup: (g: string) => void;
  setNodeViewMode: (m: NodeViewMode) => void;
  setPublicSettings: (s: PublicSettings) => void;
  setLoggedIn: (v: boolean) => void;
  setConnectionError: (v: boolean) => void;
  setHomeScrollPosition: (n: number) => void;

  // Derived helpers (computed)
  getDefaultViewMode: () => NodeViewMode;
  getRpcTransportMode: () => RpcTransportMode;
  getAlertEnabled: () => boolean;
  getAlertTitle: () => string;
  getAlertContent: () => string;
  getEarthViewMode: () => EarthViewMode;
  getVisitorInfoCardEnabled: () => boolean;
  getHideAdminEntryWhenLoggedOut: () => boolean;
  getDisablePageAnimation: () => boolean;
  getIcpEnabled: () => boolean;
  getIcpNumber: () => string;
  getIcpUrl: () => string;
  getPoliceEnabled: () => boolean;
  getPoliceNumber: () => string;
  getPoliceUrl: () => string;
  getBackgroundEnabled: () => boolean;
  getBackgroundType: () => "image" | "video";
  getLightBackgroundUrl: () => string;
  getDarkBackgroundUrl: () => string;
  getBackgroundBlur: () => number;
  getBackgroundOverlay: () => number;
  getCurrentBackgroundUrl: (resolved: "light" | "dark") => string;

  byteDecimals: ByteDecimalsConfig;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => {
      const getThemeSettings = () =>
        get().publicSettings?.theme_settings as
          | Record<string, unknown>
          | null
          | undefined;
      const H = () => makeHelpers(getThemeSettings());

      return {
        loading: true,
        themeMode: "auto",
        lang: "zh-CN",
        publicSettings: undefined,
        nodeSelectedGroup: "all",
        storedViewMode: null,
        isLoggedIn: false,
        connectionError: false,
        homeScrollPosition: 0,

        setLoading: (v) => set({ loading: v }),
        setThemeMode: (mode) => set({ themeMode: mode }),
        cycleThemeMode: () => {
          const order: Record<ThemeMode, ThemeMode> = {
            auto: "light",
            light: "dark",
            dark: "auto",
          };
          set({ themeMode: order[get().themeMode] });
        },
        setNodeSelectedGroup: (g) => set({ nodeSelectedGroup: g }),
        setNodeViewMode: (m) => set({ storedViewMode: m }),
        setPublicSettings: (s) => set({ publicSettings: s }),
        setLoggedIn: (v) => set({ isLoggedIn: v }),
        setConnectionError: (v) => set({ connectionError: v }),
        setHomeScrollPosition: (n) => set({ homeScrollPosition: n }),

        getDefaultViewMode: () => {
          const v = H().str("defaultViewMode", "card");
          return v === "card" || v === "list" ? v : "card";
        },
        getRpcTransportMode: () => {
          const v = H().str("rpcTransportMode", "websocket");
          return v === "websocket" || v === "http" ? v : "websocket";
        },
        getAlertEnabled: () => H().bool("alertEnabled", false),
        getAlertTitle: () => H().str("alertTitle", ""),
        getAlertContent: () => H().str("alertContent", ""),
        getEarthViewMode: () => {
          const v = H().str("earthViewMode", "earth");
          return isValidEarthViewMode(v) ? v : "earth";
        },
        getVisitorInfoCardEnabled: () => H().bool("visitorInfoCardEnabled", true),
        getHideAdminEntryWhenLoggedOut: () =>
          H().bool("hideAdminEntryWhenLoggedOut", false),
        getDisablePageAnimation: () => H().bool("disablePageAnimation", false),
        getIcpEnabled: () => H().bool("icpEnabled", false),
        getIcpNumber: () => H().str("icpNumber", ""),
        getIcpUrl: () => {
          const v = H().str("icpUrl", "").trim();
          return v || "https://beian.miit.gov.cn/";
        },
        getPoliceEnabled: () => H().bool("policeEnabled", false),
        getPoliceNumber: () => H().str("policeNumber", ""),
        getPoliceUrl: () => H().str("policeUrl", "").trim(),
        getBackgroundEnabled: () => H().bool("backgroundEnabled", false),
        getBackgroundType: () => {
          const v = H().str("backgroundType", "image");
          return v === "image" || v === "video" ? v : "image";
        },
        getLightBackgroundUrl: () => H().str("lightBackgroundUrl", "").trim(),
        getDarkBackgroundUrl: () => H().str("darkBackgroundUrl", "").trim(),
        getBackgroundBlur: () => H().num("backgroundBlur", 0, 0),
        getBackgroundOverlay: () => H().num("backgroundOverlay", 0, -100, 100),
        getCurrentBackgroundUrl: (resolved) => {
          if (!H().bool("backgroundEnabled", false)) return "";
          return resolved === "dark"
            ? H().str("darkBackgroundUrl", "").trim()
            : H().str("lightBackgroundUrl", "").trim();
        },

        byteDecimals: { ...BYTE_DECIMALS },
      };
    },
    {
      name: "komari-emerald-app",
      partialize: (s) => ({
        themeMode: s.themeMode,
        nodeSelectedGroup: s.nodeSelectedGroup,
        storedViewMode: s.storedViewMode,
      }),
    },
  ),
);

/**
 * Convenience selector hook that resolves the effective view mode,
 * falling back to the server-configured default if no user preference
 * is stored.
 */
export function useEffectiveViewMode(): NodeViewMode {
  const stored = useAppStore((s) => s.storedViewMode);
  const publicSettings = useAppStore((s) => s.publicSettings);

  if (stored === "card" || stored === "list") return stored;
  const v = publicSettings?.theme_settings?.defaultViewMode;
  return v === "list" ? "list" : "card";
}