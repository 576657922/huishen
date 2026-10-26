import type { Language } from '@/lib/locale'
import { getLocalStorage, readJSON } from './storage'

export const PREFS_KEY = 'huishen.prefs.v1'
/** Read without loading the preference store, engine or any localized content. */
export function readLanguage(): Language {
  const requested =
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('lang')
  if (requested === 'ja' || requested === 'zh-CN') return requested
  const value = readJSON(getLocalStorage(), PREFS_KEY)
  return value !== null && typeof value === 'object' && 'language' in value && value.language === 'ja'
    ? 'ja'
    : 'zh-CN'
}
