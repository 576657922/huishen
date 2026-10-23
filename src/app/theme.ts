/**
 * 外观（DESIGN.md §3.6）：跟随系统 / 浅色 / 深色 → <html> 上没有 data-theme / data-theme="light" / "dark"。
 * 颜色本身全在 tokens.css 里；这里只放属性，并让浏览器顶栏的 theme-color 跟着变：
 * 强制了主题时用那个主题的纸色，播放器开着时一律用深色，跟随系统时随系统切换。
 */
import { useEffect } from 'react'
import { type ThemePref, usePrefs } from '@/data'

/** 两种纸色，与 tokens.css 的 --paper、vite.config.ts 里清单的 theme_color 一致 */
export const THEME_COLORS = { light: '#F4F1EA', dark: '#121110' } as const

type Scheme = keyof typeof THEME_COLORS

const DARK_QUERY = '(prefers-color-scheme: dark)'

let playerOpen = false

const systemScheme = (): Scheme =>
  typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches ? 'dark' : 'light'

/** 页面上实际的配色：播放器开着时总是深色 */
function effectiveScheme(doc: Document): Scheme {
  if (playerOpen) return 'dark'
  const forced = doc.documentElement.getAttribute('data-theme')
  return forced === 'dark' || forced === 'light' ? forced : systemScheme()
}

/** 两个 theme-color：按系统配色各一个（不认 media 的浏览器也能拿到对的那个，因为两个的值一起改） */
function themeMetas(doc: Document): HTMLMetaElement[] {
  const metas = [...doc.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
  if (metas.length >= 2) return metas
  for (const scheme of ['light', 'dark'] as const) {
    if (metas.some(m => m.media.includes(scheme))) continue
    const meta = doc.createElement('meta')
    meta.name = 'theme-color'
    meta.media = `(prefers-color-scheme: ${scheme})`
    doc.head.append(meta)
    metas.push(meta)
  }
  return metas
}

export function syncThemeColor(doc: Document = document): void {
  const color = THEME_COLORS[effectiveScheme(doc)]
  for (const meta of themeMetas(doc)) meta.content = color
}

/** 把外观偏好写到 <html> 上。启动时在第一次渲染之前调用一次，免得先闪一下浅色 */
export function applyTheme(theme: ThemePref, doc: Document = document): void {
  const root = doc.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  syncThemeColor(doc)
}

/** 播放器打开和离开时调用：播放器总是深色，浏览器顶栏也跟着暗下来 */
export function setPlayerOpen(open: boolean, doc: Document = document): void {
  playerOpen = open
  syncThemeColor(doc)
}

/** 跟着外观偏好和系统配色走（根布局里用一次） */
export function useThemeSync(): void {
  const theme = usePrefs(s => s.theme)
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(DARK_QUERY)
    const onChange = (): void => syncThemeColor()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
}
