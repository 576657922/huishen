import { describe, expect, it } from 'vitest'
import { addDays, dayKey, daysBetween, fmtDate, fmtWhen, parseDayKey, startOfWeek } from './date'
import { median } from './math'
import { mulberry32, newId } from './random'
import { TERM_NAMES, termDate, termLabel } from './solar-terms'
import { fmtClock, fmtDuration, fmtMinutes } from './time'

const term = (year: number, name: string) => dayKey(termDate(year, TERM_NAMES.indexOf(name as never)))

describe('solar terms', () => {
  it('matches published dates', () => {
    expect(term(2024, '立春')).toBe('2024-02-04')
    expect(term(2024, '清明')).toBe('2024-04-04')
    expect(term(2024, '夏至')).toBe('2024-06-21')
    expect(term(2024, '冬至')).toBe('2024-12-21')
    expect(term(2025, '立春')).toBe('2025-02-03')
    expect(term(2025, '冬至')).toBe('2025-12-21')
    expect(term(2026, '雨水')).toBe('2026-02-18')
    expect(term(2026, '霜降')).toBe('2026-10-23')
    expect(term(2026, '立冬')).toBe('2026-11-07')
    expect(term(2021, '冬至')).toBe('2021-12-21')
  })

  it('labels the day before a term', () => {
    expect(termLabel(new Date(2026, 9, 22, 20))).toBe('霜降前一日')
    expect(termLabel(new Date(2026, 9, 23, 8))).toBe('霜降')
    expect(termLabel(new Date(2026, 9, 10))).toBeNull()
  })
})

describe('dates', () => {
  it('round-trips day keys', () => {
    expect(dayKey(parseDayKey('2026-03-09'))).toBe('2026-03-09')
  })
  it('starts weeks on Monday', () => {
    expect(dayKey(startOfWeek(new Date(2026, 9, 22)))).toBe('2026-10-19')
    expect(dayKey(startOfWeek(new Date(2026, 9, 25)))).toBe('2026-10-19')
    expect(dayKey(startOfWeek(new Date(2026, 9, 26)))).toBe('2026-10-26')
  })
  it('counts calendar days across DST-free local dates', () => {
    expect(daysBetween(new Date(2026, 0, 1, 23), addDays(new Date(2026, 0, 1), 7))).toBe(7)
  })
  it('formats dates in Chinese', () => {
    expect(fmtDate(new Date(2026, 9, 22))).toBe('10月22日 星期四')
    const now = new Date(2026, 9, 22, 21, 0)
    expect(fmtWhen(new Date(2026, 9, 22, 7, 5).toISOString(), now)).toBe('今天 07:05')
    expect(fmtWhen(new Date(2026, 9, 21, 22, 30).toISOString(), now)).toBe('昨天 22:30')
    expect(fmtWhen(new Date(2026, 9, 2, 6, 0).toISOString(), now)).toBe('10/2 06:00')
  })
})

describe('time formatting', () => {
  it('formats clocks and durations', () => {
    expect(fmtClock(600)).toBe('10:00')
    expect(fmtClock(0.2)).toBe('00:01')
    expect(fmtClock(-3)).toBe('00:00')
    expect(fmtDuration(65.4)).toBe('1:05')
    expect(fmtMinutes(13 * 60)).toBe('13 分钟')
    expect(fmtMinutes(65 * 60)).toBe('1 小时 5 分钟')
  })
})

describe('random', () => {
  it('is reproducible', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('makes unique ids', () => {
    const ids = new Set(Array.from({ length: 500 }, newId))
    expect(ids.size).toBe(500)
  })
})

describe('math', () => {
  it('takes the median of odd and even lengths without reordering the input', () => {
    const xs = [5, 1, 3]
    expect(median(xs)).toBe(3)
    expect(xs).toEqual([5, 1, 3])
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([7])).toBe(7)
  })
  it('has no median for an empty list', () => {
    expect(median([])).toBeNaN()
  })
})
