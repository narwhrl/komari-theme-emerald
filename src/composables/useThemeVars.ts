'use client'

import type { CSSProperties } from 'react'
import { useAppDerived } from '@/stores/app'

export function useThemeVars() {
  const derived = useAppDerived()

  return {
    '--background-blur': `${derived.backgroundBlur}px`,
    '--background-overlay': String(Math.abs(derived.backgroundOverlay) / 100),
  } as CSSProperties
}
