import { describe, expect, it, vi } from 'vitest'
import { addDays, dayKey } from '@/lib/date'
import { makeRecord, minutesOn } from './fixtures'
import {
  CHECKIN_MIN_SESSIONS,
  CHECKIN_TOLERANCE,
  CONSISTENCY_WEEKS,
  COUNT_TREND_MIN_SESSIONS,
  checkinSummary,
  checkinTrend,
  computeStats,
  consistency,
  countAccuracy,
  countSummary,
  countTrend,
  DAILY_DOSE_SEC,
  daysSinceLast,
  FOCUS_TREND_MIN_SEC,
  focusTrend,
  GENTLER_THRESHOLD,
  GENTLER_WINDOW,
  HEAT_THRESHOLDS,
  heatLevel,
  heatmap,
  lastFocus,
  monthCalendar,
  practiceBreakdown,
  rangeSummary,
  recentDistress,
  recordsBetween,
  secondsByDay,
  suggestGentler,
  TREND_WEEKS,
  TREND_WINDOW,
  totals,
  WELCOME_BACK_DAYS,
  weekDots,
  weeklyMeans,
  weekSummary,
  welcomeBack,
} from './stats'
import type { Feeling, SessionRecord } from './types'

// 2026-10-22 是星期四，本周一是 10-19。全部用本地时间构造，结果与运行机器的时区无关
const NOW = new Date(2026, 9, 22, 21, 0)
const day = (offset: number): Date => addDays(new Date(2026, 9, 22), offset)

describe('daily totals', () => {
  it('sums seconds per local date', () => {
    const records = [minutesOn(day(0), 10), minutesOn(day(0), 3), minutesOn(day(-1), 5)]
    expect(secondsByDay(records)).toEqual(
      new Map([
        ['2026-10-22', 780],
        ['2026-10-21', 300],
      ]),
    )
  })

  it('counts only days with practice time', () => {
    const records = [minutesOn(day(0), 10), minutesOn(day(0), 5), minutesOn(day(-2), 0)]
    expect(totals(records)).toEqual({ seconds: 900, days: 1, sessions: 3 })
    expect(totals([])).toEqual({ seconds: 0, days: 0, sessions: 0 })
  })

  it('buckets by the recorded date, not by re-reading the start time in the current zone', () => {
    // 在别的时区练的：记录里的本地日期优先
    const r = makeRecord({ startedAt: '2026-10-21T23:30:00.000Z', date: '2026-10-22', actualSec: 600 })
    expect(secondsByDay([r]).get('2026-10-22')).toBe(600)
  })
})

describe('rangeSummary and weekSummary', () => {
  const records = [
    minutesOn(day(-4), 20), // 上周日 10-18
    minutesOn(day(-3), 5), // 周一 10-19
    minutesOn(day(-3), 5),
    minutesOn(day(0), 13), // 今天
  ]

  it('includes both ends and accepts dates or day keys in any order', () => {
    expect(rangeSummary(records, day(-3), day(0))).toEqual({ seconds: 23 * 60, days: 2, sessions: 3 })
    expect(rangeSummary(records, '2026-10-22', '2026-10-18')).toEqual({
      seconds: 43 * 60,
      days: 3,
      sessions: 4,
    })
    expect(rangeSummary(records, NOW, NOW)).toEqual({ seconds: 13 * 60, days: 1, sessions: 1 })
  })

  it('rejects invalid bounds', () => {
    expect(() => rangeSummary(records, '2026-02-30', NOW)).toThrow(RangeError)
    expect(() => rangeSummary(records, new Date(Number.NaN), NOW)).toThrow(RangeError)
    expect(() => recordsBetween(records, NOW, '22/10/2026')).toThrow(RangeError)
  })

  it('selects the records of a period for per-period breakdowns', () => {
    const picked = recordsBetween(records, day(-3), NOW)
    expect(picked.map(r => r.date)).toEqual(['2026-10-19', '2026-10-19', '2026-10-22'])
    expect(recordsBetween(records, '2026-10-22', '2026-10-19')).toEqual(picked)
    expect(recordsBetween(records, '2026-01-01', '2026-01-31')).toEqual([])
  })

  it('uses Monday-based weeks', () => {
    expect(weekSummary(records, NOW)).toEqual({ seconds: 23 * 60, days: 2, sessions: 3 })
    // 周日晚上仍属于这一周；下周一零点过后重新开始
    expect(weekSummary(records, new Date(2026, 9, 25, 23, 59))).toEqual({
      seconds: 23 * 60,
      days: 2,
      sessions: 3,
    })
    expect(weekSummary(records, new Date(2026, 9, 26, 0, 5))).toEqual({ seconds: 0, days: 0, sessions: 0 })
    expect(weekSummary(records, new Date(2026, 9, 18, 12))).toEqual({
      seconds: 20 * 60,
      days: 1,
      sessions: 1,
    })
  })

  it('handles weeks that contain a daylight-saving change', () => {
    // 美国 2026-11-01、欧洲 2026-10-25 调回标准时间；按日历计算的周不受影响
    const dst = [minutesOn(new Date(2026, 9, 26), 10), minutesOn(new Date(2026, 10, 1), 10)]
    expect(weekSummary(dst, new Date(2026, 10, 1, 22))).toEqual({ seconds: 1200, days: 2, sessions: 2 })
    const spring = [minutesOn(new Date(2026, 2, 8), 7), minutesOn(new Date(2026, 2, 29), 7)]
    expect(weekSummary(spring, new Date(2026, 2, 29, 9))).toEqual({ seconds: 420, days: 1, sessions: 1 })
    expect(weekSummary(spring, new Date(2026, 2, 8, 9))).toEqual({ seconds: 420, days: 1, sessions: 1 })
  })
})

describe('heatmap', () => {
  it('exports the dose thresholds', () => {
    expect(DAILY_DOSE_SEC).toBe(13 * 60)
    expect(HEAT_THRESHOLDS).toEqual([0, 300, 780])
  })

  it('grades days: none, under 5 minutes, under 13 minutes, 13 minutes or more', () => {
    expect([0, -5, Number.NaN, 1, 299, 300, 779, 780, 7200].map(heatLevel)).toEqual([
      0, 0, 0, 1, 1, 2, 2, 3, 3,
    ])
  })

  it('lays out 8 Monday-first weeks ending with the current week', () => {
    const cells = heatmap([], NOW)
    expect(cells).toHaveLength(CONSISTENCY_WEEKS * 7)
    expect(cells[0]).toMatchObject({ key: '2026-08-31', week: 0, weekday: 0 })
    expect(cells[6]).toMatchObject({ key: '2026-09-06', week: 0, weekday: 6 })
    expect(cells[49]).toMatchObject({ key: '2026-10-19', week: 7, weekday: 0 })
    expect(cells.at(-1)).toMatchObject({ key: '2026-10-25', week: 7, weekday: 6 })
    for (const cell of cells) expect(dayKey(cell.date)).toBe(cell.key)
  })

  it('marks today and the days still to come', () => {
    const cells = heatmap([], NOW)
    expect(cells.filter(c => c.today).map(c => c.key)).toEqual(['2026-10-22'])
    expect(cells.filter(c => c.future).map(c => c.key)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25'])
  })

  it('fills seconds and levels from the records', () => {
    const records = [
      minutesOn(day(0), 13),
      minutesOn(day(-1), 4),
      minutesOn(day(-1), 2),
      minutesOn(day(-2), 3),
      minutesOn(day(-60), 30),
    ]
    const byKey = new Map(heatmap(records, NOW).map(c => [c.key, c]))
    expect(byKey.get('2026-10-22')).toMatchObject({ seconds: 780, level: 3 })
    expect(byKey.get('2026-10-21')).toMatchObject({ seconds: 360, level: 2 })
    expect(byKey.get('2026-10-20')).toMatchObject({ seconds: 180, level: 1 })
    expect(byKey.get('2026-10-19')).toMatchObject({ seconds: 0, level: 0 })
    expect(byKey.has(dayKey(day(-60)))).toBe(false)
  })

  it('supports other lengths and survives nonsense', () => {
    expect(heatmap([], NOW, 1).map(c => c.key)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(heatmap([], NOW, 0)).toHaveLength(7)
    expect(heatmap([], NOW, Number.NaN)).toHaveLength(56)
    expect(heatmap([], NOW, 53)).toHaveLength(371)
  })

  it('keeps one cell per calendar day across daylight-saving changes', () => {
    const cells = heatmap([], new Date(2026, 10, 4, 12), 2)
    const keys = cells.map(c => c.key)
    expect(new Set(keys).size).toBe(14)
    expect(keys[0]).toBe('2026-10-26')
    expect(keys.at(-1)).toBe('2026-11-08')
  })

  it('puts every cell at local midnight even where daylight saving skips it', () => {
    // 古巴 2012 年 4 月 1 日（周日）没有零点：只有这一天停在 1 点，前面的日子不跟着错开
    inTimeZone('America/Havana', () => {
      const cells = heatmap([], new Date(2012, 3, 1, 12), 1)
      expect(cells.map(c => c.key)).toEqual([
        '2012-03-26',
        '2012-03-27',
        '2012-03-28',
        '2012-03-29',
        '2012-03-30',
        '2012-03-31',
        '2012-04-01',
      ])
      expect(cells.filter(c => c.date.getHours() !== 0).map(c => c.key)).toEqual(['2012-04-01'])
    })
  })
})

describe('consistency', () => {
  it('counts practice days in the last 7 and 30 days without punishing a missed day', () => {
    const records = [-6, -5, -3, -2, -1, 0, 0, -20, -29, -30].map(offset => minutesOn(day(offset), 10))
    // 10-18 没练：只是少一天，不会像「连续天数」那样清零
    expect(consistency(records, NOW)).toMatchObject({ daysLast7: 6, daysLast30: 8 })
  })

  it('counts weeks with practice among the last 8', () => {
    const records = [0, -14, -50, -60].map(offset => minutesOn(day(offset), 5))
    // 本周、两周前、第 8 周（10-22 往前 50 天是 9-2，在 8-31 开始的那一周）；60 天前超出范围
    expect(consistency(records, NOW).weeksWithPractice).toBe(3)
  })

  it('ignores records from the future and empty sessions', () => {
    const records = [minutesOn(day(2), 10), minutesOn(day(-1), 0)]
    expect(consistency(records, NOW)).toEqual({ daysLast7: 0, daysLast30: 0, weeksWithPractice: 0 })
  })
})

describe('practiceBreakdown', () => {
  it('sorts practices by time and computes shares', () => {
    const records = [
      makeRecord({ practiceId: 'focus', kind: 'focus', actualSec: 600 }),
      makeRecord({ practiceId: 'slow', kind: 'paced', actualSec: 900 }),
      makeRecord({ practiceId: 'focus', kind: 'focus', actualSec: 600 }),
      makeRecord({ practiceId: 'box', kind: 'paced', actualSec: 300 }),
      makeRecord({ practiceId: 'body-scan', kind: 'guided', actualSec: 300 }),
      makeRecord({ practiceId: 'body-scan', kind: 'guided', actualSec: 0 }),
    ]
    const rows = practiceBreakdown(records)
    expect(rows.map(r => [r.practiceId, r.seconds, r.sessions])).toEqual([
      ['focus', 1200, 2],
      ['slow', 900, 1],
      ['body-scan', 300, 2],
      ['box', 300, 1],
    ])
    expect(rows[0]?.share).toBeCloseTo(1200 / 2700)
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1)
    expect(rows[1]?.kind).toBe('paced')
  })

  it('handles no records and zero time', () => {
    expect(practiceBreakdown([])).toEqual([])
    expect(practiceBreakdown([makeRecord({ actualSec: 0 })])[0]?.share).toBe(0)
  })
})

describe('focusTrend', () => {
  it('uses focus sessions of at least 3 minutes, in chronological order', () => {
    const records = [
      makeRecord({ at: new Date(2026, 9, 22, 7), actualSec: 600, marks: [1, 2, 3, 4, 5, 6] }),
      makeRecord({ at: new Date(2026, 9, 20, 7), actualSec: 300, marks: [1] }),
      makeRecord({ at: new Date(2026, 9, 21, 7), actualSec: FOCUS_TREND_MIN_SEC - 1, marks: [1, 2] }),
      makeRecord({ at: new Date(2026, 9, 21, 8), actualSec: 600 }),
      makeRecord({ at: new Date(2026, 9, 21, 9), kind: 'guided', practiceId: 'body-scan', marks: [1] }),
      makeRecord({ at: new Date(2026, 9, 21, 10), actualSec: 600, marks: [] }),
    ]
    const trend = focusTrend(records)
    expect(trend.map(p => [p.date, p.perTenMin])).toEqual([
      ['2026-10-20', 2],
      ['2026-10-21', 0],
      ['2026-10-22', 6],
    ])
    expect(trend.map(p => p.mean)).toEqual([2, 1, 8 / 3])
  })

  it('smooths with a rolling mean over the last 5 sessions', () => {
    const records = [1, 2, 3, 4, 5, 6, 7].map((n, i) =>
      makeRecord({
        at: new Date(2026, 9, 10 + i, 7),
        actualSec: 600,
        marks: Array.from({ length: n }, (_, k) => k),
      }),
    )
    const trend = focusTrend(records)
    expect(TREND_WINDOW).toBe(5)
    expect(trend.at(-1)?.mean).toBe(5)
    expect(trend[4]?.mean).toBe(3)
  })
})

const tally = (cycles: number, correct: number, resets = 0) => ({
  cycles,
  correct,
  errors: cycles - correct,
  resets,
})

describe('count accuracy (Levinson 2014)', () => {
  it('counts a lost count as a miss, so frequent restarts cannot look accurate', () => {
    expect(countAccuracy(tally(4, 3))).toBe(0.75)
    // 4 次第九口里 3 次对，另有 2 次数乱了重来：3 ÷ (4 + 2)
    expect(countAccuracy(tally(4, 3, 2))).toBe(0.5)
    // 与产品文档的写法相同：1 −（错的第九口 + 数乱了）÷（全部第九口 + 数乱了）
    const t = tally(10, 7, 3)
    expect(countAccuracy(t)).toBeCloseTo(1 - (t.errors + t.resets) / (t.cycles + t.resets))
    expect(countAccuracy(tally(0, 0, 3))).toBe(0)
  })

  it('has no accuracy without any attempt', () => {
    expect(countAccuracy(tally(0, 0))).toBeNull()
    expect(countAccuracy(undefined)).toBeNull()
  })

  it('leaves too-fast rounds out of both sides, as the engine defines it', () => {
    // 10 轮：6 对、2 错、2 轮点得太快，另有 1 次数乱了：6 ÷ (6 + 2 + 1)
    const count = { cycles: 10, correct: 6, errors: 2, resets: 1, invalid: 2 }
    expect(countAccuracy(count)).toBeCloseTo(6 / 9)
    expect(countAccuracy(count)).toBeCloseTo(
      1 - (count.errors + count.resets) / (count.correct + count.errors + count.resets),
    )
    // 全是点得太快的轮：没有一次有效尝试
    expect(countAccuracy({ cycles: 3, correct: 0, errors: 0, resets: 0, invalid: 3 })).toBeNull()
  })
})

describe('countTrend', () => {
  const counted = (at: Date, count?: SessionRecord['count']) =>
    makeRecord({ at, kind: 'count', practiceId: 'breath-count', count })

  it('reports accuracy and tallies per counting session, in chronological order', () => {
    const records = [
      counted(new Date(2026, 9, 21, 7), tally(4, 3, 2)),
      counted(new Date(2026, 9, 20, 7), tally(5, 5)),
      counted(new Date(2026, 9, 22, 7), tally(0, 0)),
      counted(new Date(2026, 9, 22, 8)),
      counted(new Date(2026, 9, 22, 9), tally(0, 0, 2)),
    ]
    const trend = countTrend(records)
    // 既没点过第九口也没重来过的不算；只重来过的算 0，不能丢掉
    expect(trend.map(p => [p.date, p.accuracy, p.cycles, p.resets])).toEqual([
      ['2026-10-20', 1, 5, 0],
      ['2026-10-21', 0.5, 4, 2],
      ['2026-10-22', 0, 0, 2],
    ])
    expect(trend[1]).toMatchObject({ correct: 3, errors: 1, invalid: 0 })
    expect(trend.map(p => p.mean)).toEqual([1, 0.75, 0.5])
  })

  it('reports too-fast rounds and skips sessions that had nothing else', () => {
    const records = [
      counted(new Date(2026, 9, 21, 7), { ...tally(5, 3), errors: 1, invalid: 1 }),
      counted(new Date(2026, 9, 22, 7), { ...tally(2, 0), errors: 0, invalid: 2 }),
    ]
    const trend = countTrend(records)
    expect(trend.map(p => [p.date, p.accuracy, p.invalid])).toEqual([['2026-10-21', 0.75, 1]])
  })
})

describe('countSummary', () => {
  const counted = (day: number, count: SessionRecord['count']) =>
    makeRecord({ at: new Date(2026, 9, day, 7), kind: 'count', practiceId: 'breath-count', count })

  it(`shows no trend until there are ${COUNT_TREND_MIN_SESSIONS} counting sessions`, () => {
    const two = [counted(20, tally(8, 6, 1)), counted(21, tally(9, 9))]
    const s = countSummary(two)
    expect(s).toMatchObject({ sessions: 2, ready: false, trend: [] })
    // 次数不够也照样给出这两次的数字，只是不连成趋势
    expect(s.latest).toMatchObject({ date: '2026-10-21', accuracy: 1 })
    const three = countSummary([...two, counted(22, tally(6, 3))])
    expect(three.ready).toBe(true)
    expect(three.trend.map(p => p.date)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22'])
  })

  it('totals the tallies, reports restarts separately and pools the accuracy', () => {
    const records = [
      counted(20, { cycles: 10, correct: 6, errors: 2, resets: 1, invalid: 2 }),
      counted(21, tally(4, 3, 2)),
      counted(22, tally(0, 0)),
    ]
    expect(countSummary(records)).toMatchObject({
      sessions: 2,
      correct: 9,
      errors: 3,
      resets: 3,
      invalid: 2,
      // 合在一起算：9 ÷ (9 + 3 + 3)，不是两次准确率的平均
      accuracy: 9 / 15,
    })
  })

  it('is empty without counting sessions', () => {
    expect(countSummary([makeRecord()])).toEqual({
      sessions: 0,
      ready: false,
      correct: 0,
      errors: 0,
      resets: 0,
      invalid: 0,
      accuracy: null,
      latest: null,
      trend: [],
    })
  })
})

describe('check-ins', () => {
  const rated = ([pre, post]: [number, number]) => makeRecord({ checkin: { pre, post } })
  const ratings = (pairs: [number, number][]) => pairs.map(rated)

  it(`reports nothing but the count before ${CHECKIN_MIN_SESSIONS} sessions with both ratings`, () => {
    const records = [
      rated([7, 3]),
      rated([5, 4]),
      makeRecord({ checkin: { pre: 9 } }),
      makeRecord({ checkin: { post: 1 } }),
      makeRecord(),
    ]
    expect(checkinSummary(records)).toEqual({
      n: 2,
      ready: false,
      meanPre: null,
      meanPost: null,
      meanDelta: null,
      medianPre: null,
      medianPost: null,
      medianDelta: null,
      change: null,
      verdict: null,
      lower: 0,
      same: 0,
      higher: 0,
    })
  })

  it(`summarizes with medians once there are ${CHECKIN_MIN_SESSIONS} sessions with both ratings`, () => {
    const records = ratings([
      [7, 3],
      [5, 4],
      [6, 5],
      [8, 4],
      [4, 4],
    ])
    expect(checkinSummary(records)).toEqual({
      n: 5,
      ready: true,
      meanPre: 6,
      meanPost: 4,
      meanDelta: -2,
      medianPre: 6,
      medianPost: 4,
      medianDelta: -1,
      change: -2,
      verdict: 'lower',
      lower: 2,
      same: 3,
      higher: 0,
    })
  })

  it(`labels a change of the medians within ±${CHECKIN_TOLERANCE} as measurement error`, () => {
    const verdict = (pairs: [number, number][]) => checkinSummary(ratings(pairs)).verdict
    const five = (pre: number, post: number): [number, number][] =>
      Array.from({ length: 5 }, () => [pre, post])
    expect(verdict(five(5, 4))).toBe('within-error')
    expect(verdict(five(5, 6))).toBe('within-error')
    expect(verdict(five(5, 5))).toBe('within-error')
    expect(verdict(five(5, 3))).toBe('lower')
    expect(verdict(five(3, 5))).toBe('higher')
    // 中位数可以是半分：相差 1.5 分已超出误差
    const half = checkinSummary(
      ratings([
        [6, 4],
        [5, 4],
        [6, 5],
        [5, 3],
        [7, 4],
        [5, 5],
      ]),
    )
    expect(half).toMatchObject({ medianPre: 5.5, medianPost: 4, change: -1.5, verdict: 'lower' })
  })

  it('reports medians, which one extreme rating cannot drag around', () => {
    const records = (
      [
        [6, 5],
        [6, 4],
        [5, 5],
        [7, 6],
        [8, 0],
      ] as [number, number][]
    ).map(rated)
    const s = checkinSummary(records)
    expect(s).toMatchObject({ medianPre: 6, medianPost: 5, medianDelta: -1 })
    expect(s.meanDelta).toBeCloseTo(-2.4)
  })

  it(`treats a change within ±${CHECKIN_TOLERANCE} as no change`, () => {
    const records = (
      [
        [5, 4],
        [5, 6],
        [5, 5],
        [5, 3],
        [2, 7],
      ] as [number, number][]
    ).map(rated)
    expect(checkinSummary(records)).toMatchObject({ lower: 1, same: 3, higher: 1 })
  })

  it('returns nulls instead of NaN when there is nothing to summarize', () => {
    expect(checkinSummary([makeRecord()])).toEqual({
      n: 0,
      ready: false,
      meanPre: null,
      meanPost: null,
      meanDelta: null,
      medianPre: null,
      medianPost: null,
      medianDelta: null,
      change: null,
      verdict: null,
      lower: 0,
      same: 0,
      higher: 0,
    })
  })

  it('lists rated sessions chronologically for the before-and-after plot', () => {
    const records = [
      makeRecord({ at: new Date(2026, 9, 22, 8), checkin: { pre: 6, post: 4 } }),
      makeRecord({ at: new Date(2026, 9, 21, 8), checkin: { pre: 3, post: 3 } }),
      makeRecord({ at: new Date(2026, 9, 20, 8), checkin: { pre: 5 } }),
    ]
    expect(checkinTrend(records).map(p => [p.date, p.pre, p.post, p.delta])).toEqual([
      ['2026-10-21', 3, 3, 0],
      ['2026-10-22', 6, 4, -2],
    ])
  })
})

describe('weeklyMeans', () => {
  const point = (date: string, v: number) => ({ date, v })
  const value = (p: { v: number }) => p.v

  it('averages points per Monday-based week, oldest first, ending with this week', () => {
    const points = [
      point('2026-10-22', 4),
      point('2026-10-19', 2),
      point('2026-10-25', 6), // 本周日
      point('2026-10-18', 10), // 上周日
      point('2026-10-12', Number.NaN),
      point('2026-09-13', 99), // 六周之前
    ]
    expect(TREND_WEEKS).toBe(6)
    expect(weeklyMeans(points, value, NOW)).toEqual([
      { week: '2026-09-14', mean: null, n: 0 },
      { week: '2026-09-21', mean: null, n: 0 },
      { week: '2026-09-28', mean: null, n: 0 },
      { week: '2026-10-05', mean: null, n: 0 },
      { week: '2026-10-12', mean: 10, n: 1 },
      { week: '2026-10-19', mean: 4, n: 3 },
    ])
  })

  it('ignores malformed dates and supports other lengths', () => {
    expect(weeklyMeans([point('bad', 1), point('2026-02-30', 1)], value, NOW, 1)).toEqual([
      { week: '2026-10-19', mean: null, n: 0 },
    ])
    expect(weeklyMeans([], value, NOW, 0)).toHaveLength(1)
    expect(weeklyMeans([], value, NOW, Number.NaN)).toHaveLength(TREND_WEEKS)
  })

  it('keeps weeks aligned across daylight-saving changes and the new year', () => {
    expect(weeklyMeans([], value, new Date(2026, 10, 4, 12), 3).map(w => w.week)).toEqual([
      '2026-10-19',
      '2026-10-26',
      '2026-11-02',
    ])
    const points = [point('2026-12-31', 1), point('2027-01-03', 3)]
    expect(weeklyMeans(points, value, new Date(2027, 0, 3, 9), 1)).toEqual([
      { week: '2026-12-28', mean: 2, n: 2 },
    ])
  })

  it('works directly on a trend', () => {
    const records = [
      minutesOn(day(0), 10, { marks: [1, 2, 3, 4] }),
      minutesOn(day(-1), 10, { marks: [1, 2] }),
      minutesOn(day(-7), 10, { marks: [] }),
    ]
    expect(weeklyMeans(focusTrend(records), p => p.perTenMin, NOW, 2)).toEqual([
      { week: '2026-10-12', mean: 0, n: 1 },
      { week: '2026-10-19', mean: 3, n: 2 },
    ])
  })
})

describe('daysSinceLast', () => {
  it('counts calendar days since the last practice day, 0 for today and null for never', () => {
    expect(daysSinceLast([], NOW)).toBeNull()
    expect(daysSinceLast([minutesOn(day(0), 5)], NOW)).toBe(0)
    expect(daysSinceLast([minutesOn(day(-30), 10), minutesOn(day(-4), 5)], NOW)).toBe(4)
    // 按日历天算，不管几点：昨晚 23:59 到今早 00:01 也是 1 天
    const lateLastNight = makeRecord({ at: new Date(2026, 9, 21, 23, 59) })
    expect(daysSinceLast([lateLastNight], new Date(2026, 9, 22, 0, 1))).toBe(1)
  })

  it('ignores empty and future sessions', () => {
    expect(daysSinceLast([minutesOn(day(-2), 0)], NOW)).toBeNull()
    expect(daysSinceLast([minutesOn(day(-5), 10), minutesOn(day(3), 10)], NOW)).toBe(5)
  })

  it('agrees with welcomeBack', () => {
    for (const offset of [0, -1, -2, -3, -4, -40]) {
      const records = [minutesOn(day(offset), 10)]
      expect(welcomeBack(records, NOW)).toBe((daysSinceLast(records, NOW) ?? 0) >= WELCOME_BACK_DAYS)
    }
  })
})

describe('welcomeBack', () => {
  it(`greets a returning user after ${WELCOME_BACK_DAYS} or more days away`, () => {
    expect(welcomeBack([minutesOn(day(-2), 10)], NOW)).toBe(false)
    expect(welcomeBack([minutesOn(day(-3), 10)], NOW)).toBe(true)
    expect(welcomeBack([minutesOn(day(-30), 10), minutesOn(day(-1), 5)], NOW)).toBe(false)
  })

  it('counts calendar days, whatever the time of day, across the new year', () => {
    const last = [minutesOn(new Date(2026, 9, 19), 10)]
    expect(welcomeBack(last, new Date(2026, 9, 22, 0, 1))).toBe(true)
    expect(welcomeBack(last, new Date(2026, 9, 21, 23, 59))).toBe(false)
    expect(welcomeBack([minutesOn(new Date(2026, 11, 30), 10)], new Date(2027, 0, 2, 8))).toBe(true)
  })

  it('stays quiet for a new user and ignores empty or future sessions', () => {
    expect(welcomeBack([], NOW)).toBe(false)
    expect(welcomeBack([minutesOn(day(-10), 10), minutesOn(day(-1), 0)], NOW)).toBe(true)
    expect(welcomeBack([minutesOn(day(-10), 10), minutesOn(day(2), 10)], NOW)).toBe(true)
  })
})

describe('recentDistress (Britton 2021)', () => {
  const felt = (feeling: Feeling | undefined, hour: number) =>
    makeRecord({ at: new Date(2026, 9, 22, hour), feeling })

  it('is true when 2 of the 3 latest rated sessions felt tenser or unwell', () => {
    expect(recentDistress([felt('tenser', 7), felt('unwell', 8), felt('calmer', 9)])).toBe(true)
    expect(recentDistress([felt('unwell', 7), felt('unwell', 8)])).toBe(true)
    expect(recentDistress([felt('same', 7), felt('tenser', 8), felt('calmer', 9)])).toBe(false)
    // 更早的不适已经滑出最近 3 次
    expect(
      recentDistress([
        felt('unwell', 5),
        felt('unwell', 6),
        felt('calmer', 7),
        felt('same', 8),
        felt('calmer', 9),
      ]),
    ).toBe(false)
  })

  it('is what the deprecated suggestGentler name still returns', () => {
    expect(suggestGentler).toBe(recentDistress)
  })
})

describe('suggestGentler (Britton 2021)', () => {
  const felt = (feeling: Feeling | undefined, hour: number) =>
    makeRecord({ at: new Date(2026, 9, 22, hour), feeling })

  it(`suggests a gentler practice when ${GENTLER_THRESHOLD} of the last ${GENTLER_WINDOW} ratings were uncomfortable`, () => {
    expect(suggestGentler([felt('tenser', 7), felt('calmer', 8), felt('unwell', 9)])).toBe(true)
    expect(suggestGentler([felt('tenser', 7), felt('tenser', 8), felt('same', 9)])).toBe(true)
    expect(suggestGentler([felt('unwell', 6), felt('tenser', 7), felt('calmer', 8), felt('same', 9)])).toBe(
      false,
    )
  })

  it('looks at the latest ratings by start time and skips unrated sessions', () => {
    const records = [
      felt('unwell', 9),
      felt(undefined, 8),
      felt('calmer', 7),
      felt('tenser', 6),
      felt('calmer', 5),
    ]
    expect(suggestGentler(records)).toBe(true)
    expect(suggestGentler([...records].reverse())).toBe(true)
  })

  it('stays quiet without enough uncomfortable ratings', () => {
    expect(suggestGentler([])).toBe(false)
    expect(suggestGentler([felt(undefined, 7), felt(undefined, 8)])).toBe(false)
    expect(suggestGentler([felt('unwell', 7)])).toBe(false)
  })
})

describe('weekDots', () => {
  it('gives seven dots, Monday to Sunday, filled only on days with practice', () => {
    const records = [
      minutesOn(day(-3), 10),
      minutesOn(day(-1), 0),
      minutesOn(day(0), 3),
      minutesOn(day(0), 2),
    ]
    const dots = weekDots(records, NOW)
    expect(dots.map(d => d.key)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(dots.map(d => d.practiced)).toEqual([true, false, false, true, false, false, false])
    expect(dots[3]).toEqual({ key: '2026-10-22', practiced: true, seconds: 300, today: true, future: false })
    expect(dots.filter(d => d.future).map(d => d.key)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25'])
  })

  it('has only filled and empty dots, never a missed state', () => {
    for (const dot of weekDots([], NOW)) {
      expect(Object.keys(dot).sort()).toEqual(['future', 'key', 'practiced', 'seconds', 'today'])
    }
  })

  it('treats Sunday night as the end of the week', () => {
    const sunday = new Date(2026, 9, 25, 23, 30)
    const dots = weekDots([minutesOn(day(-3), 10)], sunday)
    expect(dots[0]?.key).toBe('2026-10-19')
    expect(dots.at(-1)).toMatchObject({ key: '2026-10-25', today: true, future: false })
    expect(dots.some(d => d.future)).toBe(false)
  })

  it('keeps one dot per calendar day across a daylight-saving change', () => {
    const keys = weekDots([], new Date(2026, 10, 1, 12)).map(d => d.key)
    expect(keys).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ])
  })
})

describe('monthCalendar', () => {
  const keysOf = (weeks: { key: string }[][]) => weeks.map(w => [w[0]?.key, w.at(-1)?.key])

  it('lays out Monday-first weeks that cover the whole month', () => {
    // 2026 年 10 月：1 日周四，31 日周六
    const weeks = monthCalendar([], 2026, 9, NOW)
    expect(keysOf(weeks)).toEqual([
      ['2026-09-28', '2026-10-04'],
      ['2026-10-05', '2026-10-11'],
      ['2026-10-12', '2026-10-18'],
      ['2026-10-19', '2026-10-25'],
      ['2026-10-26', '2026-11-01'],
    ])
    for (const week of weeks) expect(week).toHaveLength(7)
    const days = weeks.flat()
    expect(days.filter(d => d.inMonth)).toHaveLength(31)
    expect(days.filter(d => !d.inMonth).map(d => d.key)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-11-01',
    ])
    for (const d of days) expect(dayKey(d.date)).toBe(d.key)
  })

  it('has four to six rows depending on the month', () => {
    // 2027 年 2 月从周一开始、28 天，正好四行；2026 年 8 月从周六开始、31 日是周一，要六行
    expect(monthCalendar([], 2027, 1, NOW)).toHaveLength(4)
    expect(keysOf(monthCalendar([], 2026, 7, NOW)).at(-1)).toEqual(['2026-08-31', '2026-09-06'])
    expect(monthCalendar([], 2026, 7, NOW)).toHaveLength(6)
  })

  it('fills practiced days and marks today, with no missed state', () => {
    const records = [minutesOn(day(0), 10), minutesOn(day(-2), 0), minutesOn(new Date(2026, 8, 29), 5)]
    const days = monthCalendar(records, 2026, 9, NOW).flat()
    const byKey = new Map(days.map(d => [d.key, d]))
    expect(byKey.get('2026-10-22')).toMatchObject({
      seconds: 600,
      practiced: true,
      today: true,
      inMonth: true,
    })
    expect(byKey.get('2026-10-20')).toMatchObject({ seconds: 0, practiced: false, today: false })
    // 补齐的上个月的日子也照实显示练没练
    expect(byKey.get('2026-09-29')).toMatchObject({ seconds: 300, practiced: true, inMonth: false })
    expect(days.filter(d => d.today)).toHaveLength(1)
    for (const d of days) {
      expect(Object.keys(d).sort()).toEqual(['date', 'inMonth', 'key', 'practiced', 'seconds', 'today'])
    }
  })

  it('uses the month index of Date and rolls over into neighbouring years', () => {
    const firstInMonth = (year: number, monthIndex: number) =>
      monthCalendar([], year, monthIndex, NOW)
        .flat()
        .find(d => d.inMonth)?.key
    expect(firstInMonth(2026, 0)).toBe('2026-01-01')
    expect(firstInMonth(2026, -1)).toBe('2025-12-01')
    expect(firstInMonth(2026, 12)).toBe('2027-01-01')
    // 跨年的那一周：2026 年 1 月 1 日是周四
    expect(monthCalendar([], 2026, 0, NOW)[0]?.[0]?.key).toBe('2025-12-29')
  })

  it('does not mark today in another month, and defaults to the current time', () => {
    expect(
      monthCalendar([], 2026, 8, NOW)
        .flat()
        .some(d => d.today),
    ).toBe(false)
    expect(
      monthCalendar([], 2026, 9)
        .flat()
        .filter(d => d.today).length,
    ).toBeLessThanOrEqual(1)
  })

  it('rejects nonsense and handles years before 100 literally', () => {
    expect(() => monthCalendar([], 2026, 9.5, NOW)).toThrow(RangeError)
    expect(() => monthCalendar([], Number.NaN, 9, NOW)).toThrow(RangeError)
    expect(() => monthCalendar([], 300_000, 0, NOW)).toThrow(RangeError)
    // 公元 99 年 1 月：不能被当成 1999 年，也不能一路排到 1999 年
    const weeks = monthCalendar([], 99, 0, NOW)
    expect(weeks.length).toBeGreaterThanOrEqual(4)
    expect(weeks.length).toBeLessThanOrEqual(6)
    const inMonth = weeks.flat().filter(d => d.inMonth)
    expect(inMonth).toHaveLength(31)
    expect(inMonth.every(d => d.date.getFullYear() === 99)).toBe(true)
  })

  it('covers every day of every month, with rows of seven consecutive days from Monday', () => {
    for (let year = 2024; year <= 2030; year++) {
      for (let month = 0; month < 12; month++) {
        const days = monthCalendar([], year, month, NOW).flat()
        expect(days.filter(d => d.inMonth)).toHaveLength(new Date(year, month + 1, 0).getDate())
        expect(days.length % 7).toBe(0)
        expect(days[0]?.date.getDay()).toBe(1)
        for (const [i, d] of days.entries()) {
          if (i > 0) expect(d.key).toBe(dayKey(addDays(days[i - 1]?.date ?? d.date, 1)))
        }
      }
    }
  })

  it('keeps the last row where daylight saving skips midnight', () => {
    // 古巴 2012 年 4 月 1 日（周日）零点直接跳到 1 点；那个月的 30 日是周一，曾因此漏掉最后一行
    inTimeZone('America/Havana', () => {
      const weeks = monthCalendar([], 2012, 3, NOW)
      expect(weeks.flat().filter(d => d.inMonth)).toHaveLength(30)
      expect(weeks.at(-1)?.[0]?.key).toBe('2012-04-30')
      for (const d of weeks.flat()) expect(dayKey(d.date)).toBe(d.key)
      expect(
        weeks
          .flat()
          .filter(d => d.date.getHours() !== 0)
          .map(d => d.key),
      ).toEqual(['2012-04-01'])
    })
  })
})

/** 在指定时区里运行（Node 改 TZ 立即生效），跑完恢复，测试结果不依赖运行机器所在的时区 */
function inTimeZone(zone: string, run: () => void): void {
  vi.stubEnv('TZ', zone)
  try {
    run()
  } finally {
    vi.unstubAllEnvs()
  }
}

describe('lastFocus', () => {
  it('finds the most recent focus session with marks, optionally by planned length', () => {
    const a = makeRecord({ at: new Date(2026, 9, 20, 7), plannedSec: 780, marks: [10] })
    const b = makeRecord({ at: new Date(2026, 9, 22, 7), plannedSec: 600, marks: [20] })
    const c = makeRecord({ at: new Date(2026, 9, 22, 9), plannedSec: 780 })
    const d = makeRecord({ at: new Date(2026, 9, 22, 10), kind: 'paced', practiceId: 'box', marks: [1] })
    expect(lastFocus([a, b, c, d])).toBe(b)
    expect(lastFocus([a, b, c, d], 780)).toBe(a)
    expect(lastFocus([a, b], 1200)).toBeNull()
  })
})

describe('computeStats', () => {
  it('bundles every statistic for the same moment', () => {
    const records = [
      minutesOn(day(0), 13, { marks: [1, 2], checkin: { pre: 6, post: 3 } }),
      minutesOn(day(-1), 5),
      minutesOn(day(-8), 7),
      minutesOn(day(-25), 9),
    ]
    const stats = computeStats(records, NOW)
    expect(stats.totals).toEqual({ seconds: 34 * 60, days: 4, sessions: 4 })
    expect(stats.today).toEqual({ seconds: 13 * 60, days: 1, sessions: 1 })
    expect(stats.week).toEqual(weekSummary(records, NOW))
    expect(stats.last7).toEqual({ seconds: 18 * 60, days: 2, sessions: 2 })
    expect(stats.month).toEqual({ seconds: 25 * 60, days: 3, sessions: 3 })
    expect(stats.consistency).toEqual(consistency(records, NOW))
    expect(stats.heatmap).toHaveLength(56)
    expect(stats.breakdown).toEqual(practiceBreakdown(records))
    expect(stats.focus).toHaveLength(1)
    expect(stats.count).toEqual([])
    expect(stats.countSummary).toEqual(countSummary(records))
    expect(stats.checkin.n).toBe(1)
    expect(stats.weekly.focus.at(-1)).toEqual({ week: '2026-10-19', mean: (2 * 600) / 780, n: 1 })
    expect(stats.weekly.count).toHaveLength(TREND_WEEKS)
    expect(stats.weekDots).toEqual(weekDots(records, NOW))
    expect(stats.calendar).toEqual(monthCalendar(records, 2026, 9, NOW))
    expect(stats.welcomeBack).toBe(false)
    expect(stats.recentDistress).toBe(false)
    expect(stats.suggestGentler).toBe(false)
  })

  it('holds back check-in plots and trends until there is enough data', () => {
    const rated = (offset: number) => minutesOn(day(offset), 10, { checkin: { pre: 6, post: 3 } })
    const counted = (offset: number) =>
      minutesOn(day(offset), 10, {
        kind: 'count',
        practiceId: 'breath-count',
        count: { cycles: 8, correct: 6, errors: 2, resets: 0 },
      })
    const few = computeStats([rated(0), rated(-1), counted(0), counted(-1)], NOW)
    expect(few.checkin).toMatchObject({ n: 2, ready: false, medianPre: null })
    expect(few.checkinPoints).toEqual([])
    expect(few.weekly.checkin.every(w => w.mean === null)).toBe(true)
    // 数息不够 3 次：各次的数字照给，趋势和按周平均不给
    expect(few.count).toHaveLength(2)
    expect(few.countSummary.trend).toEqual([])
    expect(few.weekly.count.every(w => w.mean === null)).toBe(true)

    const enough = computeStats(
      [0, -1, -2, -3, -4].flatMap(o => [rated(o), counted(o)]),
      NOW,
    )
    expect(enough.checkin).toMatchObject({ n: 5, ready: true, change: -3, verdict: 'lower' })
    expect(enough.checkinPoints).toHaveLength(5)
    expect(enough.weekly.checkin.at(-1)).toEqual({ week: '2026-10-19', mean: -3, n: 4 })
    expect(enough.countSummary.trend).toHaveLength(5)
    expect(enough.weekly.count.at(-1)).toEqual({ week: '2026-10-19', mean: 0.75, n: 4 })
  })

  it('flags recent distress for the safety prompt', () => {
    const records = [
      minutesOn(day(0), 10, { feeling: 'unwell' }),
      minutesOn(day(-1), 10, { feeling: 'tenser' }),
    ]
    expect(computeStats(records, NOW)).toMatchObject({ recentDistress: true, suggestGentler: true })
  })

  it('starts the month at local midnight on the 1st', () => {
    const records = [minutesOn(new Date(2026, 9, 31), 10), minutesOn(new Date(2026, 10, 1), 5)]
    expect(computeStats(records, new Date(2026, 10, 1, 0, 30)).month).toEqual({
      seconds: 300,
      days: 1,
      sessions: 1,
    })
  })
})
