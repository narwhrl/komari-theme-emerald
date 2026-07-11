import type { ThemeMode } from '@/stores/app'
import { createContext, use } from 'react'

export type ThemeModeTransition = (mode?: ThemeMode) => void

export const ThemeTransitionContext = createContext<ThemeModeTransition | null>(null)

export function useThemeModeTransition(): ThemeModeTransition {
  const updateThemeMode = use(ThemeTransitionContext)
  if (!updateThemeMode)
    throw new Error('useThemeModeTransition must be used within Provider')
  return updateThemeMode
}
