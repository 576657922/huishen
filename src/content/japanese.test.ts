import { afterEach, describe, expect, it, vi } from 'vitest'
import { interpolate, setLanguage } from '@/lib/locale'
import { createTranslator } from './translate'

const catalogues = import.meta.glob<Record<string, string>>('./locales/ja/*.json', {
  eager: true,
  import: 'default',
})
const placeholders = (text: string): string[] => (text.match(/\{\w+\}/g) ?? []).sort()

afterEach(() => {
  setLanguage('zh-CN')
  vi.resetModules()
})

describe('bundled Japanese content', () => {
  it('preserves every template argument, with no empty or unfinished translations', () => {
    expect(Object.keys(catalogues).length).toBeGreaterThan(15)
    for (const [file, messages] of Object.entries(catalogues)) {
      for (const [source, target] of Object.entries(messages)) {
        if (source !== '在') expect(target.trim().length, `${file}: ${source}`).toBeGreaterThan(0)
        expect(target, `${file}: ${source}`).not.toMatch(/TODO|TRANSLATE|\[object Object\]|undefined/)
        expect(placeholders(target), `${file}: ${source}`).toEqual(placeholders(source))
      }
    }
  })

  it('keeps substitutions literal and permits Japanese word order', () => {
    const tr = createTranslator({ '{0} 和 {1}': '{1}と{0}' })
    setLanguage('ja')
    expect(tr('{0} 和 {1}', '$& {1}', 'B')).toBe('Bと$& {1}')
    expect(interpolate('{phase} {0}', [5])).toBe('{phase} 5')
    setLanguage('zh-CN')
    expect(tr('{0} 和 {1}', 'A', 'B')).toBe('A 和 B')
  })

  it('localizes static content before evaluation without changing IDs or help destinations', async () => {
    vi.resetModules()
    const locale = await import('@/lib/locale')
    locale.setLanguage('zh-CN')
    const zh = await import('./safety')
    const baseline = zh.CRISIS_RESOURCES.map(region => ({
      id: region.id,
      phones: region.lines.map(line => ({ display: line.display, href: line.href })),
    }))
    vi.resetModules()
    const japaneseLocale = await import('@/lib/locale')
    japaneseLocale.setLanguage('ja')
    const [{ TODAY, PLAYER, SETTINGS }, safety, practices] = await Promise.all([
      import('./copy'),
      import('./safety'),
      import('./practices'),
    ])
    expect(TODAY.title).toBe('今日')
    expect(PLAYER.pause).toBe('一時停止')
    expect(SETTINGS.title).toBe('設定')
    expect(practices.PRACTICE_BY_ID.focus.name).toBe('呼吸に注意を向ける')
    expect(
      safety.CRISIS_RESOURCES.map(region => ({
        id: region.id,
        phones: region.lines.map(line => ({ display: line.display, href: line.href })),
      })),
    ).toEqual(baseline)
    expect(safety.CRISIS_RESOURCES[0]?.name).toBe('中国本土')
    japaneseLocale.setLanguage('zh-CN')
  })

  it('builds each offered guide at every duration and level with Japanese safety and closing text', async () => {
    vi.resetModules()
    const locale = await import('@/lib/locale')
    locale.setLanguage('ja')
    const [{ SCRIPTS }, { buildTimeline }, { PRACTICES, isOffered }] = await Promise.all([
      import('./scripts'),
      import('@/engine/timeline'),
      import('./practices'),
    ])
    const offered = new Set(
      PRACTICES.filter(p => isOffered(p.id)).flatMap(p => (p.scriptId ? [p.scriptId] : [])),
    )
    for (const id of offered) {
      const script = SCRIPTS[id]
      expect(script.title).not.toMatch(/专注|练习|呼吸空间|数息|关怀|觉察/)
      for (let minutes = script.minMinutes; minutes <= script.maxMinutes; minutes++) {
        for (const level of ['quiet', 'standard', 'detailed'] as const) {
          const timeline = buildTimeline(script, minutes, { level })
          expect(timeline.duration).toBeCloseTo(minutes * 60, 4)
          expect(timeline.cues.filter(c => c.text).some(c => /[ぁ-んァ-ン]/u.test(c.text ?? ''))).toBe(true)
          for (const cue of timeline.cues) {
            expect(cue.t).toBeGreaterThanOrEqual(0)
            expect(cue.t).toBeLessThanOrEqual(minutes * 60)
            expect(cue.text ?? '').not.toMatch(/\{\d+\}|undefined/)
          }
        }
      }
    }
    locale.setLanguage('zh-CN')
  })
})
