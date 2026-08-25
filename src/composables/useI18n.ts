'use client'

import type { Lang, Translate } from '@/i18n'
import { useMemo } from 'react'
import { translate } from '@/i18n'
import { useAppStore } from '@/stores/app'

export function useI18n(): { lang: Lang, t: Translate } {
  const lang = useAppStore(state => state.lang)
  const t = useMemo<Translate>(() => {
    const bound: Translate = (key, ...args) => translate(lang, key, ...args)
    return bound
  }, [lang])

  return { lang, t }
}
