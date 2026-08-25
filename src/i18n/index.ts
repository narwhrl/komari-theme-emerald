import type { MessageArgs, MessageKey } from './messages'
import { enUS, zhCN } from './messages'

export type { MessageArgs, MessageKey, Translate } from './messages'
export type Lang = 'zh-CN' | 'en-US'

export const DEFAULT_LANG: Lang = 'zh-CN'
export const SUPPORTED_LANGS: readonly Lang[] = ['zh-CN', 'en-US']

function catalogFor(lang: Lang) {
  return lang === 'en-US' ? enUS : zhCN
}

export function isLang(value: unknown): value is Lang {
  return value === 'zh-CN' || value === 'en-US'
}

function parseStoredLang(value: unknown): Lang | undefined {
  if (typeof value !== 'string')
    return undefined

  const normalized = value.trim().toLowerCase()
  if (normalized === 'zh-cn')
    return 'zh-CN'
  if (normalized === 'en-us')
    return 'en-US'
  return undefined
}

function langFromPreference(value: string): Lang | undefined {
  const normalized = value.trim().toLowerCase()
  if (normalized.startsWith('zh'))
    return 'zh-CN'
  if (normalized.startsWith('en'))
    return 'en-US'
  return undefined
}

export function resolvePreferredLang(stored: unknown, preferences: readonly string[]): Lang {
  const storedLang = parseStoredLang(stored)
  if (storedLang)
    return storedLang

  for (const preference of preferences) {
    if (typeof preference !== 'string')
      continue
    const language = langFromPreference(preference)
    if (language)
      return language
  }

  return 'en-US'
}

export function getAlternateLang(lang: Lang): Lang {
  return lang === 'zh-CN' ? 'en-US' : 'zh-CN'
}

export function toRegionLanguage(lang: Lang): 'zh' | 'en' {
  return lang === 'en-US' ? 'en' : 'zh'
}

export function translate<K extends MessageKey>(
  lang: Lang,
  key: K,
  ...args: MessageArgs<K>
): string {
  const catalog = catalogFor(isLang(lang) ? lang : DEFAULT_LANG) as Record<string, unknown>
  const message = catalog[key] ?? (zhCN as Record<string, unknown>)[key]

  if (typeof message === 'function')
    return (message as (...fnArgs: MessageArgs<K>) => string)(...args)

  if (typeof message === 'string')
    return message

  return String(key)
}
