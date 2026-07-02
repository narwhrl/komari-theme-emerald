'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ScrollContext } from '@/components/ScrollContext'
import { BackTop } from '@/components/ui/back-top'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppDerived, useAppStore } from '@/stores/app'

export function Provider({ children }: { children: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false)
  const hydrateFromBrowser = useAppStore(state => state.hydrateFromBrowser)
  const derived = useAppDerived()

  useEffect(() => {
    hydrateFromBrowser()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => useAppStore.setState({ isSystemDark: media.matches })
    updateSystemTheme()
    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [hydrateFromBrowser])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', derived.isDark)
    root.style.colorScheme = derived.isDark ? 'dark' : 'light'
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
      <ScrollContext value={contextValue}>
        {children}
        <BackTop />
      </ScrollContext>
    </TooltipProvider>
  )
}
