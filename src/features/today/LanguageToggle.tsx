import { useSessionState } from '@/app/hooks'
import { LANGUAGE } from '@/content/copy'
import { usePrefs } from '@/data'
import { getLanguage } from '@/lib/locale'
import { Button } from '@/ui'

export function LanguageToggle() {
  const set = usePrefs(state => state.set)
  const active = useSessionState(state => ['lead', 'running', 'paused'].includes(state.status))
  const japanese = getLanguage() === 'ja'
  return (
    <Button
      variant="quiet"
      aria-label={japanese ? LANGUAGE.toChinese : LANGUAGE.toJapanese}
      aria-pressed={japanese}
      aria-disabled={active}
      onClick={() => {
        const language = japanese ? 'zh-CN' : 'ja'
        set({ language })
        const url = new URL(window.location.href)
        url.searchParams.set('lang', language)
        window.history.replaceState(window.history.state, '', url)
        window.location.reload()
      }}
    >
      <span lang={japanese ? 'zh-CN' : 'ja'}>{japanese ? LANGUAGE.chinese : LANGUAGE.japanese}</span>
    </Button>
  )
}
