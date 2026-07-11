'use client'

import type { ReactNode } from 'react'
import type { ThemeMode } from '@/stores/app'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollContext } from '@/components/ScrollContext'
import { ThemeTransitionContext } from '@/components/ThemeTransitionContext'
import { BackTop } from '@/components/ui/back-top'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getNextThemeMode, resolveThemeIsDark, useAppDerived, useAppStore } from '@/stores/app'
import { applyDocumentTheme, runThemeTransition } from '@/utils/themeTransition'

export function Provider({ children }: { children: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false)
  const hydrateFromBrowser = useAppStore(state => state.hydrateFromBrowser)
  const themeMode = useAppStore(state => state.themeMode)
  const isSystemDark = useAppStore(state => state.isSystemDark)
  const setThemeMode = useAppStore(state => state.updateThemeMode)
  const derived = useAppDerived()
  const pendingThemeModeRef = useRef<ThemeMode | null>(null)

  const updateThemeMode = useCallback((mode?: ThemeMode) => {
    const currentMode = pendingThemeModeRef.current ?? themeMode
    const nextMode = getNextThemeMode(currentMode, mode)
    const fromIsDark = resolveThemeIsDark(currentMode, isSystemDark)
    const toIsDark = resolveThemeIsDark(nextMode, isSystemDark)
    pendingThemeModeRef.current = nextMode

    runThemeTransition({
      fromIsDark,
      toIsDark,
      update: () => {
        applyDocumentTheme(toIsDark)
        setThemeMode(nextMode)
        if (pendingThemeModeRef.current === nextMode)
          pendingThemeModeRef.current = null
      },
    })
  }, [isSystemDark, setThemeMode, themeMode])

  useEffect(() => {
    hydrateFromBrowser()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => useAppStore.setState({ isSystemDark: media.matches })
    updateSystemTheme()
    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [hydrateFromBrowser])

  useEffect(() => {
    applyDocumentTheme(derived.isDark)
  }, [derived.isDark])

  useEffect(() => {
    if (derived.backgroundEnabled)
      document.body.style.setProperty('background-color', 'transparent', 'important')
    else
      document.body.style.removeProperty('background-color')
  }, [derived.backgroundEnabled])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 1)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const contextValue = useMemo(() => isScrolled, [isScrolled])

  return (
    <TooltipProvider>
      <ThemeTransitionContext value={updateThemeMode}>
        <ScrollContext value={contextValue}>
          {children}
          <BackTop />
        </ScrollContext>
      </ThemeTransitionContext>
    </TooltipProvider>
  )
}
