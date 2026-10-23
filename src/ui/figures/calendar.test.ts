import { describe, expect, it } from 'vitest'
import { monthGeometry, type WeekDay, weekDotsGeometry, weekdayLabel } from './calendar'

const WEEK: WeekDay[] = [
  { date: '2026-10-19', minutes: 15, state: 'past' },
  { date: '2026-10-20', minutes: 0, state: 'past' },
  { date: '2026-10-21', minutes: 21, state: 'past' },
  { date: '2026-10-22', minutes: 10, state: 'today' },
  { date: '2026-10-23', minutes: 0, state: 'future' },
  { date: '2026-10-24', minutes: 0, state: 'future' },
  { date: '2026-10-25', minutes: 0, state: 'future' },
]

describe('本周的点（设计稿 charts.mjs weekDots）', () => {
  it('手机：每格 24、点 8，点心 y 5，标签基线 26，今天的短线在 30.25', () => {
    const g = weekDotsGeometry(WEEK)
    expect(g.width).toBe(168)
    expect(g.height).toBe(32)
    expect(g.dotY).toBe(5)
    expect(g.dotR).toBe(4)
    expect(g.labelY).toBe(26)
    expect(g.ruleY).toBe(30.25)
    expect(g.slots.map(s => s.cx)).toEqual([12, 36, 60, 84, 108, 132, 156])
  })

  it('桌面：每格 30、点 10', () => {
    const g = weekDotsGeometry(WEEK, 'desk')
    expect(g.width).toBe(210)
    expect(g.dotR).toBe(5)
    expect(g.slots[3]?.cx).toBe(105)
  })

  it('只有练过的日子画点；没练的日子不论过去还是未来都不画（PRODUCT.md §7）', () => {
    const g = weekDotsGeometry(WEEK)
    expect(g.slots.map(s => s.practised)).toEqual([true, false, true, true, false, false, false])
    expect(g.slots.map(s => s.label).join('')).toBe('一二三四五六日')
    expect(weekdayLabel('2026-10-25')).toBe('日')
  })
})

describe('月历点阵', () => {
  it('2026年10月：1 日是周四，七列 50 × 44，一共五行', () => {
    const g = monthGeometry(2026, 10, new Set(['2026-10-01', '2026-10-22']), '2026-10-22')
    expect(g.width).toBe(350)
    expect(g.height).toBe(20 + 5 * 44)
    const first = g.cells[0]
    expect(first).toMatchObject({ day: 1, cx: 175, top: 20, practised: true, today: false })
    const today = g.cells[21]
    expect(today).toMatchObject({ day: 22, cx: 175, top: 20 + 3 * 44, practised: true, today: true })
    expect(g.practisedCount).toBe(2)
    expect(g.weekdays.map(w => w.label).join('')).toBe('一二三四五六日')
  })

  it('今天不在这个月时不标', () => {
    const g = monthGeometry(2026, 9, new Set(), '2026-10-22')
    expect(g.cells.some(c => c.today)).toBe(false)
  })
})
