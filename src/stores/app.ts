'use client'

/* eslint-disable node/prefer-global/process */

import type { PublicSettings } from '@/utils/api'
import type { ByteDecimalsConfig } from '@/utils/helper'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

export type ThemeMode = 'auto' | 'light' | 'dark'
export type Lang = 'zh-CN' | 'en-US'
export type NodeViewMode = 'card' | 'list'
export type RpcTransportMode = 'websocket' | 'http'
export type EarthViewMode = 'earth' | 'earth-stop' | 'maps' | 'cards' | 'hide'

const BYTE_DECIMALS: ByteDecimalsConfig = {
  B: 0,
  KB: 0,
  MB: 1,
  GB: 1,
  TB: 2,
}
const FORCED_RPC_TRANSPORT_MODE = process.env.NEXT_PUBLIC_RPC_TRANSPORT_MODE

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readStorage<T extends string>(key: string, fallback: T): T {
  if (!canUseStorage())
    return fallback
  return (window.localStorage.getItem(key) as T | null) ?? fallback
}

function writeStorage(key: string, value: string): void {
  if (!canUseStorage())
    return
  window.localStorage.setItem(key, value)
}

function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark'
}

function isValidViewMode(value: unknown): value is NodeViewMode {
  return value === 'card' || value === 'list'
}

function isValidEarthViewMode(value: unknown): value is EarthViewMode {
  return value === 'earth' || value === 'earth-stop' || value === 'maps' || value === 'cards' || value === 'hide'
}

function getThemeSettings(publicSettings?: PublicSettings): Record<string, unknown> | null {
  return publicSettings?.theme_settings ?? null
}

function getDefaultViewMode(publicSettings?: PublicSettings): NodeViewMode {
  const settings = getThemeSettings(publicSettings)
  const mode = settings?.defaultViewMode
  return isValidViewMode(mode) ? mode : 'card'
}

function resolveStoredViewMode(publicSettings?: PublicSettings): NodeViewMode {
  const stored = readStorage<NodeViewMode | 'null'>('nodeViewMode', 'null')
  return isValidViewMode(stored) ? stored : getDefaultViewMode(publicSettings)
}

function resolveRpcTransportMode(settings: Record<string, unknown> | null): RpcTransportMode {
  if (FORCED_RPC_TRANSPORT_MODE === 'http' || FORCED_RPC_TRANSPORT_MODE === 'websocket')
    return FORCED_RPC_TRANSPORT_MODE

  return settings?.rpcTransportMode === 'http' ? 'http' : 'websocket'
}

export interface AppStoreState {
  loading: boolean
  themeMode: ThemeMode
  isSystemDark: boolean
  lang: Lang
  publicSettings?: PublicSettings
  nodeSelectedGroup: string
  storedViewMode: NodeViewMode | null
  isLoggedIn: boolean
  connectionError: boolean
  homeScrollPosition: number
  byteDecimals: ByteDecimalsConfig
}

export interface AppStoreActions {
  hydrateFromBrowser: () => void
  setLoading: (loading: boolean) => void
  setPublicSettings: (settings?: PublicSettings) => void
  setNodeSelectedGroup: (group: string) => void
  setNodeViewMode: (mode: NodeViewMode) => void
  setConnectionError: (connectionError: boolean) => void
  setHomeScrollPosition: (position: number) => void
  updateThemeMode: (mode?: ThemeMode) => void
  updateLoginState: (loggedIn: boolean) => void
}

export type AppStore = AppStoreState & AppStoreActions

export const useAppStore = create<AppStore>((set, get) => ({
  loading: true,
  themeMode: 'auto',
  isSystemDark: false,
  lang: 'zh-CN',
  publicSettings: undefined,
  nodeSelectedGroup: 'all',
  storedViewMode: null,
  isLoggedIn: false,
  connectionError: false,
  homeScrollPosition: 0,
  byteDecimals: { ...BYTE_DECIMALS },

  hydrateFromBrowser: () => {
    const themeMode = readStorage<ThemeMode>('themeMode', 'auto')
    const nodeSelectedGroup = readStorage('nodeSelectedGroup', 'all')
    const storedViewMode = readStorage<NodeViewMode | 'null'>('nodeViewMode', 'null')
    const isSystemDark = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false

    set({
      themeMode: isValidThemeMode(themeMode) ? themeMode : 'auto',
      nodeSelectedGroup,
      storedViewMode: isValidViewMode(storedViewMode) ? storedViewMode : null,
      isSystemDark,
    })
  },
  setLoading: loading => set({ loading }),
  setPublicSettings: settings => set((state) => {
    const storedViewMode = state.storedViewMode && isValidViewMode(state.storedViewMode)
      ? state.storedViewMode
      : resolveStoredViewMode(settings)
    writeStorage('nodeViewMode', storedViewMode)
    return { publicSettings: settings, storedViewMode }
  }),
  setNodeSelectedGroup: (group) => {
    writeStorage('nodeSelectedGroup', group)
    set({ nodeSelectedGroup: group })
  },
  setNodeViewMode: (mode) => {
    writeStorage('nodeViewMode', mode)
    set({ storedViewMode: mode })
  },
  setConnectionError: connectionError => set({ connectionError }),
  setHomeScrollPosition: position => set({ homeScrollPosition: position }),
  updateThemeMode: (mode) => {
    const currentMode = isValidThemeMode(get().themeMode) ? get().themeMode : 'auto'
    const nextMode = mode && isValidThemeMode(mode)
      ? mode
      : ({ auto: 'light', light: 'dark', dark: 'auto' } satisfies Record<ThemeMode, ThemeMode>)[currentMode]
    writeStorage('themeMode', nextMode)
    set({ themeMode: nextMode })
  },
  updateLoginState: loggedIn => set({ isLoggedIn: loggedIn }),
}))

export interface AppDerivedState {
  defaultViewMode: NodeViewMode
  nodeViewMode: NodeViewMode
  rpcTransportMode: RpcTransportMode
  alertEnabled: boolean
  alertTitle: string
  alertContent: string
  earthViewMode: EarthViewMode
  visitorInfoCardEnabled: boolean
  hideAdminEntryWhenLoggedOut: boolean
  disablePageAnimation: boolean
  icpEnabled: boolean
  icpNumber: string
  icpUrl: string
  policeEnabled: boolean
  policeNumber: string
  policeUrl: string
  backgroundEnabled: boolean
  backgroundType: 'image' | 'video'
  lightBackgroundUrl: string
  darkBackgroundUrl: string
  backgroundBlur: number
  backgroundOverlay: number
  isDark: boolean
  resolvedThemeMode: 'light' | 'dark'
  currentBackgroundUrl: string
}

export function selectAppDerived(state: AppStoreState): AppDerivedState {
  const settings = getThemeSettings(state.publicSettings)
  const defaultViewMode = getDefaultViewMode(state.publicSettings)
  const nodeViewMode = isValidViewMode(state.storedViewMode) ? state.storedViewMode : defaultViewMode
  const rpcTransportMode = resolveRpcTransportMode(settings)
  const earthViewMode = isValidEarthViewMode(settings?.earthViewMode) ? settings.earthViewMode : 'earth'
  const backgroundEnabled = typeof settings?.backgroundEnabled === 'boolean' ? settings.backgroundEnabled : false
  const backgroundType = settings?.backgroundType === 'video' ? 'video' : 'image'
  const isDark = state.themeMode === 'auto' ? state.isSystemDark : state.themeMode === 'dark'
  const resolvedThemeMode = isDark ? 'dark' : 'light'
  const lightBackgroundUrl = typeof settings?.lightBackgroundUrl === 'string' ? settings.lightBackgroundUrl.trim() : ''
  const darkBackgroundUrl = typeof settings?.darkBackgroundUrl === 'string' ? settings.darkBackgroundUrl.trim() : ''

  return {
    defaultViewMode,
    nodeViewMode,
    rpcTransportMode,
    alertEnabled: typeof settings?.alertEnabled === 'boolean' ? settings.alertEnabled : false,
    alertTitle: typeof settings?.alertTitle === 'string' ? settings.alertTitle : '',
    alertContent: typeof settings?.alertContent === 'string' ? settings.alertContent : '',
    earthViewMode,
    visitorInfoCardEnabled: typeof settings?.visitorInfoCardEnabled === 'boolean' ? settings.visitorInfoCardEnabled : true,
    hideAdminEntryWhenLoggedOut: typeof settings?.hideAdminEntryWhenLoggedOut === 'boolean' ? settings.hideAdminEntryWhenLoggedOut : false,
    disablePageAnimation: typeof settings?.disablePageAnimation === 'boolean' ? settings.disablePageAnimation : false,
    icpEnabled: typeof settings?.icpEnabled === 'boolean' ? settings.icpEnabled : false,
    icpNumber: typeof settings?.icpNumber === 'string' ? settings.icpNumber : '',
    icpUrl: typeof settings?.icpUrl === 'string' && settings.icpUrl.trim() ? settings.icpUrl.trim() : 'https://beian.miit.gov.cn/',
    policeEnabled: typeof settings?.policeEnabled === 'boolean' ? settings.policeEnabled : false,
    policeNumber: typeof settings?.policeNumber === 'string' ? settings.policeNumber : '',
    policeUrl: typeof settings?.policeUrl === 'string' && settings.policeUrl.trim() ? settings.policeUrl.trim() : '',
    backgroundEnabled,
    backgroundType,
    lightBackgroundUrl,
    darkBackgroundUrl,
    backgroundBlur: typeof settings?.backgroundBlur === 'number' && settings.backgroundBlur >= 0 ? settings.backgroundBlur : 0,
    backgroundOverlay: typeof settings?.backgroundOverlay === 'number' && settings.backgroundOverlay >= -100 && settings.backgroundOverlay <= 100 ? settings.backgroundOverlay : 0,
    isDark,
    resolvedThemeMode,
    currentBackgroundUrl: backgroundEnabled ? (resolvedThemeMode === 'dark' ? darkBackgroundUrl : lightBackgroundUrl) : '',
  }
}

export function getAppDerivedState(): AppDerivedState {
  return selectAppDerived(useAppStore.getState())
}

export function useAppDerived(): AppDerivedState {
  return useAppStore(useShallow(selectAppDerived))
}
