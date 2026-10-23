/**
 * 练习统计。全部是纯函数，「现在」由调用方传入：便于测试，也让同一屏上的数字基于同一时刻
 * （monthCalendar 不传时取当前时间，只用来标出今天）。
 * 按记录里的 date（练习时所在时区的本地日期）分天，换了时区也不会把历史重新洗牌。
 *
 * 不做「连续天数」：中断一天并不会让习惯养成前功尽弃（Lally 2010），
 * 全有或全无的连胜计数反而在断掉后打击积极性。这里只统计「练了几天」。
 */
import type { PracticeId, PracticeKind } from '@/content/types'
import { addDays, DAY_MS, dayKey, startOfDay, startOfWeek } from '@/lib/date'
import { mean, median } from '@/lib/math'
import { pad2 } from '@/lib/time'
import { dayKeyToUTC, isDayKey } from './guards'
import { byStartedAt } from './record'
import type { SessionRecord } from './types'

type Records = readonly SessionRecord[]
type Count = NonNullable<SessionRecord['count']>

export interface Summary {
  seconds: number
  /** 练习时长大于 0 的天数 */
  days: number
  sessions: number
}

/** 每天 13 分钟：Basso 等（2019）中 8 周后出现效果的每日剂量，热力图以此为满格 */
export const DAILY_DOSE_SEC = 13 * 60

/** 热力图分级的秒数下限：大于 0 为一级，满 5 分钟为二级，满 13 分钟为三级 */
export const HEAT_THRESHOLDS = [0, 5 * 60, DAILY_DOSE_SEC] as const

export type HeatLevel = 0 | 1 | 2 | 3

/** 一致性统计和热力图看最近几周 */
export const CONSISTENCY_WEEKS = 8

/** 专注不足 3 分钟时，「每十分钟回神次数」被少数几次按键左右，不放进趋势 */
export const FOCUS_TREND_MIN_SEC = 180

/** 趋势线的滚动平均取最近几次 */
export const TREND_WINDOW = 5

/** 按周平均的趋势默认看最近几周 */
export const TREND_WEEKS = 6

/** 自评前后相差不超过 1 分算作没变：0–10 的自评本身就有这么大的误差 */
export const CHECKIN_TOLERANCE = 1

/** 前后都自评满这么多次才汇总、画点图（PRODUCT.md §7）：次数太少时中位数被一两次左右 */
export const CHECKIN_MIN_SESSIONS = 5

/** 数息满这么多次才显示趋势（PRODUCT.md §7） */
export const COUNT_TREND_MIN_SESSIONS = 3

/** 距上次练习满这么多天，今日页改说「欢迎回来」 */
export const WELCOME_BACK_DAYS = 3

/** 最近 GENTLER_WINDOW 次「练完感觉」里有 GENTLER_THRESHOLD 次不适，就建议换更温和的练习（Britton 2021） */
export const GENTLER_WINDOW = 3
export const GENTLER_THRESHOLD = 2

export function heatLevel(seconds: number): HeatLevel {
  if (!(seconds > HEAT_THRESHOLDS[0])) return 0
  if (seconds < HEAT_THRESHOLDS[1]) return 1
  if (seconds < HEAT_THRESHOLDS[2]) return 2
  return 3
}

/* ---------- 时长与天数 ---------- */

/** 每个本地日期的练习秒数 */
export function secondsByDay(records: Records): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of records) out.set(r.date, (out.get(r.date) ?? 0) + r.actualSec)
  return out
}

export function totals(records: Records): Summary {
  let seconds = 0
  const days = new Set<string>()
  for (const r of records) {
    seconds += r.actualSec
    if (r.actualSec > 0) days.add(r.date)
  }
  return { seconds, days: days.size, sessions: records.length }
}

/** from 到 to 之间（含两端）的记录，用于按时间范围看各练习的占比等；参数可以是日期或 YYYY-MM-DD，顺序颠倒时自动对调 */
export function recordsBetween(records: Records, from: Date | string, to: Date | string): SessionRecord[] {
  const a = toKey(from)
  const b = toKey(to)
  const [lo, hi] = a <= b ? [a, b] : [b, a]
  return records.filter(r => r.date >= lo && r.date <= hi)
}

/** from 到 to 之间（含两端）的汇总 */
export function rangeSummary(records: Records, from: Date | string, to: Date | string): Summary {
  return totals(recordsBetween(records, from, to))
}

/** 本周（周一到周日）的汇总 */
export function weekSummary(records: Records, now: Date): Summary {
  const monday = startOfWeek(now)
  return rangeSummary(records, monday, addDays(monday, 6))
}

/* ---------- 热力图与一致性 ---------- */

export interface HeatCell {
  /** YYYY-MM-DD */
  key: string
  /** 本地零点 */
  date: Date
  seconds: number
  level: HeatLevel
  future: boolean
  today: boolean
  /** 第几列，0 为最早的一周 */
  week: number
  /** 第几行，0 为周一 */
  weekday: number
}

/**
 * 最近 weeks 周的日历热力图，最后一列是本周；weeks 为 1 时就是今日页「周一到周日七个点」。
 * 按列排列：先是最早一周的周一到周日，依次往后，网格用 grid-auto-flow: column、7 行即可直接排布。
 */
export function heatmap(records: Records, now: Date, weeks = CONSISTENCY_WEEKS): HeatCell[] {
  const n = weekCount(weeks, CONSISTENCY_WEEKS)
  const byDay = secondsByDay(records)
  const today = dayKey(now)
  const first = addDays(startOfWeek(now), -7 * (n - 1))
  const cells: HeatCell[] = []
  for (let i = 0; i < n * 7; i++) {
    // 每格各自取零点：起点那天的零点若被夏令时跳过，加出来的日子会一直停在 1 点
    const date = startOfDay(addDays(first, i))
    const key = dayKey(date)
    const seconds = byDay.get(key) ?? 0
    cells.push({
      key,
      date,
      seconds,
      level: heatLevel(seconds),
      future: key > today,
      today: key === today,
      week: Math.floor(i / 7),
      weekday: i % 7,
    })
  }
  return cells
}

export interface Consistency {
  /** 最近 7 天（含今天）里练过的天数 */
  daysLast7: number
  /** 最近 30 天（含今天）里练过的天数 */
  daysLast30: number
  /** 最近 8 周（含本周）里至少练过一天的周数 */
  weeksWithPractice: number
}

export function consistency(records: Records, now: Date): Consistency {
  const today = dayKey(now)
  // 系统时间被调过时可能有「未来」的记录，还没到的日子不算
  const practiced = [...secondsByDay(records)].filter(([key, s]) => s > 0 && key <= today).map(([key]) => key)
  const daysFrom = (from: Date, to: Date = now): number => {
    const lo = dayKey(from)
    const hi = dayKey(to)
    return practiced.filter(k => k >= lo && k <= hi).length
  }

  const monday = startOfWeek(now)
  let weeksWithPractice = 0
  for (let w = 0; w < CONSISTENCY_WEEKS; w++) {
    const start = addDays(monday, -7 * w)
    if (daysFrom(start, addDays(start, 6)) > 0) weeksWithPractice++
  }
  return {
    daysLast7: daysFrom(addDays(now, -6)),
    daysLast30: daysFrom(addDays(now, -29)),
    weeksWithPractice,
  }
}

/**
 * 距最近一次练习过了几个日历天：今天练过为 0，从没练过为 null；按记录里的本地日期算，「未来」的记录不算。
 * 只用来决定要不要说「欢迎回来」（见 welcomeBack）。界面上绝不显示这个数字，
 * 不说「已经 X 天没练习」（PRODUCT.md §4，Buyalskaya 2023）
 */
export function daysSinceLast(records: Records, now: Date): number | null {
  const today = dayKey(now)
  let last: string | null = null
  for (const r of records) {
    if (r.actualSec > 0 && r.date <= today && (last === null || r.date > last)) last = r.date
  }
  return last === null ? null : keyDiffDays(last, today)
}

/** 今日页是否改说「欢迎回来。先做 1 分钟？」：距上次练习已满 WELCOME_BACK_DAYS 天。从没练过时为 false */
export function welcomeBack(records: Records, now: Date): boolean {
  const days = daysSinceLast(records, now)
  return days !== null && days >= WELCOME_BACK_DAYS
}

/* ---------- 本周七个点与月历 ---------- */

export interface WeekDot {
  /** YYYY-MM-DD */
  key: string
  /** 练过（时长大于 0）的日子填实，其余留空 */
  practiced: boolean
  seconds: number
  today: boolean
  /** 今天之后的日子，还谈不上练没练 */
  future: boolean
}

/** 今日页本周的七个点，周一到周日。只有练过和没练两种，不标红，也不提漏了几天 */
export function weekDots(records: Records, now: Date): WeekDot[] {
  const byDay = secondsByDay(records)
  const today = dayKey(now)
  const monday = startOfWeek(now)
  return Array.from({ length: 7 }, (_, i) => {
    const key = dayKey(addDays(monday, i))
    const seconds = byDay.get(key) ?? 0
    return { key, practiced: seconds > 0, seconds, today: key === today, future: key > today }
  })
}

export interface CalendarDay {
  /** YYYY-MM-DD */
  key: string
  /** 本地零点 */
  date: Date
  seconds: number
  /** 练过的日子填实，没练的留空；没有「漏练」这种状态（PRODUCT.md §7） */
  practiced: boolean
  today: boolean
  /** 是这个月的日子；为补齐首尾两周而带上的前后月份的日子为 false */
  inMonth: boolean
}

/**
 * 记录页的月历点阵：每行一周，周一在前，首尾补齐成整周（4–6 行）。
 * monthIndex 与 Date#getMonth() 相同，0 为一月；超出 0–11 时顺延到相邻的年份（-1 为上一年十二月），
 * 翻月时直接加减即可。now 只用来标出今天
 */
export function monthCalendar(
  records: Records,
  year: number,
  monthIndex: number,
  now: Date = new Date(),
): CalendarDay[][] {
  const first = firstOfMonth(year, monthIndex)
  // 行数按天数算，不拿日期比大小：零点被夏令时跳过的地方，推算出的周一会停在 1 点，比月末零点晚，会漏掉最后一行
  const lead = (first.getDay() + 6) % 7
  const rows = Math.ceil((lead + daysInMonth(first)) / 7)
  const byDay = secondsByDay(records)
  const today = dayKey(now)
  return Array.from({ length: rows }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const date = dayOfMonth(first, week * 7 + weekday + 1 - lead)
      const key = dayKey(date)
      const seconds = byDay.get(key) ?? 0
      const inMonth = date.getMonth() === first.getMonth()
      return { key, date, seconds, practiced: seconds > 0, today: key === today, inMonth }
    }),
  )
}

/** 某月 1 日的本地零点。用 setFullYear 而不是 new Date(year, …)：后者会把 0–99 年当成 1900 年代 */
function firstOfMonth(year: number, monthIndex: number): Date {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) {
    throw new RangeError(`年份和月份应为整数：${year}、${monthIndex}`)
  }
  const first = new Date(2000, 0, 1)
  first.setFullYear(year, monthIndex, 1)
  if (Number.isNaN(first.getTime())) throw new RangeError(`超出日期范围：${year} 年 ${monthIndex + 1} 月`)
  return first
}

/** 按 UTC 推算日历，与本机时区和夏令时无关 */
function daysInMonth(first: Date): number {
  const last = new Date(0)
  last.setUTCFullYear(first.getFullYear(), first.getMonth() + 1, 0)
  return last.getUTCDate()
}

/** 这个月第 day 天的本地零点；day 可以小于 1 或超过月末，落到相邻的月份 */
function dayOfMonth(first: Date, day: number): Date {
  const date = new Date(first)
  date.setDate(day)
  // 每天各自取零点：1 日零点被跳过时 first 停在 1 点，不能让后面的日子跟着停在 1 点
  date.setHours(0, 0, 0, 0)
  return date
}

/* ---------- 各练习 ---------- */

export interface PracticeShare {
  practiceId: PracticeId
  kind: PracticeKind
  seconds: number
  sessions: number
  /** 占总时长的比例 0–1 */
  share: number
}

/** 各练习的时长和次数，按时长从多到少；只看某段时间时先用 recordsBetween 筛选 */
export function practiceBreakdown(records: Records): PracticeShare[] {
  const rows = new Map<PracticeId, PracticeShare>()
  let total = 0
  for (const r of records) {
    total += r.actualSec
    const row = rows.get(r.practiceId)
    if (row) {
      row.seconds += r.actualSec
      row.sessions++
    } else {
      rows.set(r.practiceId, {
        practiceId: r.practiceId,
        kind: r.kind,
        seconds: r.actualSec,
        sessions: 1,
        share: 0,
      })
    }
  }
  const list = [...rows.values()]
  for (const row of list) row.share = total > 0 ? row.seconds / total : 0
  return list.sort(
    (a, b) => b.seconds - a.seconds || b.sessions - a.sessions || (a.practiceId < b.practiceId ? -1 : 1),
  )
}

/** 最近一次留有回神记录的专注，可限定计划时长；开始前用来画出上一次的回神分布 */
export function lastFocus(records: Records, plannedSec?: number): SessionRecord | null {
  let best: SessionRecord | null = null
  for (const r of records) {
    if (r.kind !== 'focus' || !r.marks) continue
    if (plannedSec !== undefined && r.plannedSec !== plannedSec) continue
    if (!best || r.startedAt > best.startedAt) best = r
  }
  return best
}

/* ---------- 趋势 ---------- */

/** 趋势里的一次练习 */
export interface TrendPoint {
  id: string
  /** 练习时的本地日期 YYYY-MM-DD */
  date: string
  startedAt: string
}

export interface FocusPoint extends TrendPoint {
  /** 每十分钟回神几次。次数多少没有好坏：更常发现走神，也可能是觉察更敏锐 */
  perTenMin: number
  /** 含本次在内最近 TREND_WINDOW 次的平均；前几次按已有的次数平均 */
  mean: number
}

/** 专注（≥ 3 分钟）的回神频率，按时间先后 */
export function focusTrend(records: Records): FocusPoint[] {
  const out: FocusPoint[] = []
  const recent: number[] = []
  for (const r of chronological(records)) {
    if (r.kind !== 'focus' || !r.marks || r.actualSec < FOCUS_TREND_MIN_SEC) continue
    const perTenMin = (r.marks.length * 600) / r.actualSec
    pushRecent(recent, perTenMin)
    out.push({ ...pointOf(r), perTenMin, mean: mean(recent) })
  }
  return out
}

/**
 * 数息准确率（Levinson 2014；PRODUCT.md §7 与引擎契约的定义）：
 * 1 −（错的第九口 + 数乱了）÷（对的第九口 + 错的第九口 + 数乱了），即 correct ÷（correct + errors + resets）。
 * 数乱了也算一次没数对：只除以点了第九口的轮数，常常重来的人反而显得准。
 * 点得太快的轮（invalid）不是真实的呼吸，分子分母都不算。一次有效的尝试都没有时为 null
 */
export function countAccuracy(count: Count | undefined): number | null {
  return count ? accuracyOf(count) : null
}

function accuracyOf({
  correct,
  errors,
  resets,
}: Pick<Count, 'correct' | 'errors' | 'resets'>): number | null {
  const attempts = correct + errors + resets
  return attempts > 0 ? correct / attempts : null
}

export interface CountPoint extends TrendPoint, Count {
  /** 点得太快的轮数；旧记录没有这一项，按 0 计 */
  invalid: number
  /** countAccuracy，0–1 */
  accuracy: number
  /** 含本次在内最近 TREND_WINDOW 次的平均 */
  mean: number
}

/**
 * 数息的各次数据，按时间先后；没有一次有效尝试（对、错、数乱了都没有）的不算。
 * 不足 COUNT_TREND_MIN_SESSIONS 次时不要画成趋势，用 countSummary 的 trend
 */
export function countTrend(records: Records): CountPoint[] {
  const out: CountPoint[] = []
  const recent: number[] = []
  for (const r of chronological(records)) {
    const accuracy = countAccuracy(r.count)
    if (!r.count || accuracy === null) continue
    pushRecent(recent, accuracy)
    const { cycles, correct, errors, resets, invalid = 0 } = r.count
    out.push({ ...pointOf(r), cycles, correct, errors, resets, invalid, accuracy, mean: mean(recent) })
  }
  return out
}

/** 记录页的「数息练习数据」。不叫「正念分数」：它只说明数息数得准不准 */
export interface CountSummary {
  /** 有过有效尝试的数息练习次数 */
  sessions: number
  /** 满 COUNT_TREND_MIN_SESSIONS 次才显示趋势 */
  ready: boolean
  /** 全部合计：对的第九口、错的第九口 */
  correct: number
  errors: number
  /** 数乱了重来的次数，单独显示 */
  resets: number
  /** 点得太快（不到 1.5 秒一口）而不计入的轮数 */
  invalid: number
  /** 各次的有效尝试合在一起算的准确率；没有时为 null */
  accuracy: number | null
  /** 最近一次 */
  latest: CountPoint | null
  /** 画趋势用的各次，按时间先后；不足 COUNT_TREND_MIN_SESSIONS 次时为空 */
  trend: CountPoint[]
}

export function countSummary(records: Records): CountSummary {
  return summarizeCounts(countTrend(records))
}

function summarizeCounts(points: readonly CountPoint[]): CountSummary {
  const total = (pick: (p: CountPoint) => number): number => points.reduce((sum, p) => sum + pick(p), 0)
  const tally = { correct: total(p => p.correct), errors: total(p => p.errors), resets: total(p => p.resets) }
  const ready = points.length >= COUNT_TREND_MIN_SESSIONS
  return {
    sessions: points.length,
    ready,
    ...tally,
    invalid: total(p => p.invalid),
    accuracy: accuracyOf(tally),
    latest: points.at(-1) ?? null,
    trend: ready ? [...points] : [],
  }
}

export interface CheckinPoint extends TrendPoint {
  pre: number
  post: number
  /** 练习后减练习前，负数表示更放松 */
  delta: number
}

/** 练习前后都自评了的练习，按时间先后，用于画前后对比的点图 */
export function checkinTrend(records: Records): CheckinPoint[] {
  const out: CheckinPoint[] = []
  for (const r of chronological(records)) {
    const pre = r.checkin?.pre
    const post = r.checkin?.post
    if (pre === undefined || post === undefined) continue
    out.push({ ...pointOf(r), pre, post, delta: post - pre })
  }
  return out
}

/** 练习后的中位数比练习前低、在误差之内、还是高 */
export type CheckinChange = 'lower' | 'within-error' | 'higher'

/**
 * 练习前后自评的汇总（PRODUCT.md §7）：满 CHECKIN_MIN_SESSIONS 次才汇总，之前除 n 以外全是 null 或 0，
 * 界面只说还要再自评几次。显示时标注「自评」，并说明变化也包含休息本身、期待和测量误差（Goldberg 2022）
 */
export interface CheckinSummary {
  /** 前后都自评了的次数 */
  n: number
  /** n 满 CHECKIN_MIN_SESSIONS */
  ready: boolean
  meanPre: number | null
  meanPost: number | null
  /** 练习后减练习前，负数表示更放松 */
  meanDelta: number | null
  /** 自评是 0–10 的有序等级，界面上优先显示中位数，不受个别极端值影响 */
  medianPre: number | null
  medianPost: number | null
  /** 每次「后 − 前」的中位数 */
  medianDelta: number | null
  /** 练习后的中位数减练习前的中位数，负数表示更放松 */
  change: number | null
  /** change 在 ±CHECKIN_TOLERANCE 以内为 within-error：0–10 的自评本身就有这么大的误差 */
  verdict: CheckinChange | null
  /** 练习后低了 CHECKIN_TOLERANCE 分以上的次数 */
  lower: number
  /** 变化在 ±CHECKIN_TOLERANCE 以内、算作没变的次数 */
  same: number
  /** 练习后高了 CHECKIN_TOLERANCE 分以上的次数 */
  higher: number
}

export function checkinSummary(records: Records): CheckinSummary {
  return summarizeCheckins(checkinTrend(records))
}

function summarizeCheckins(points: readonly CheckinPoint[]): CheckinSummary {
  const n = points.length
  if (n < CHECKIN_MIN_SESSIONS) return { ...NO_CHECKIN_SUMMARY, n }
  const pre = points.map(p => p.pre)
  const post = points.map(p => p.post)
  const delta = points.map(p => p.delta)
  // 至少 CHECKIN_MIN_SESSIONS 次，三列都不空，中位数总有值
  const medianPre = median(pre)
  const medianPost = median(post)
  const change = medianPost - medianPre
  return {
    n,
    ready: true,
    meanPre: mean(pre),
    meanPost: mean(post),
    meanDelta: mean(delta),
    medianPre,
    medianPost,
    medianDelta: median(delta),
    change,
    verdict: verdictOf(change),
    lower: delta.filter(d => d < -CHECKIN_TOLERANCE).length,
    same: delta.filter(d => Math.abs(d) <= CHECKIN_TOLERANCE).length,
    higher: delta.filter(d => d > CHECKIN_TOLERANCE).length,
  }
}

const NO_CHECKIN_SUMMARY: CheckinSummary = {
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
}

function verdictOf(change: number): CheckinChange {
  if (change < -CHECKIN_TOLERANCE) return 'lower'
  return change > CHECKIN_TOLERANCE ? 'higher' : 'within-error'
}

export interface WeekMean {
  /** 这一周的周一 YYYY-MM-DD */
  week: string
  /** 这一周各次的平均；这一周没有数据时为 null，画线时应断开而不是当成 0 */
  mean: number | null
  n: number
}

/**
 * 最近 weeks 周（含本周）按周平均，最早的一周在前。用于「近 6 周，按周平均」的趋势，
 * 如 weeklyMeans(focusTrend(records), p => p.perTenMin, now)。按每个点的本地日期分周
 */
export function weeklyMeans<T extends { date: string }>(
  points: readonly T[],
  value: (point: T) => number,
  now: Date,
  weeks = TREND_WEEKS,
): WeekMean[] {
  const n = weekCount(weeks, TREND_WEEKS)
  const first = addDays(startOfWeek(now), -7 * (n - 1))
  const buckets = new Map<string, number[]>()
  for (let i = 0; i < n; i++) buckets.set(dayKey(addDays(first, 7 * i)), [])
  for (const point of points) {
    const monday = mondayOf(point.date)
    const v = value(point)
    if (monday !== null && Number.isFinite(v)) buckets.get(monday)?.push(v)
  }
  return [...buckets].map(([week, xs]) => ({ week, mean: xs.length ? mean(xs) : null, n: xs.length }))
}

/* ---------- 安全 ---------- */

/**
 * 最近 GENTLER_WINDOW 次填了「练完感觉」的练习里，至少 GENTLER_THRESHOLD 次「更紧张」或「很不舒服」
 * （PRODUCT.md §6，Britton 2021）：应建议改为更短、睁眼、以声音为锚的练习，并给出专业帮助的入口。
 * 没填感觉的练习不计入
 */
export function recentDistress(records: Records): boolean {
  const rated = records
    .filter(r => r.feeling !== undefined)
    .sort((a, b) => byStartedAt(b, a))
    .slice(0, GENTLER_WINDOW)
  return rated.filter(r => r.feeling === 'tenser' || r.feeling === 'unwell').length >= GENTLER_THRESHOLD
}

/** @deprecated 改名为 recentDistress，与产品规格的说法一致 */
export const suggestGentler = recentDistress

/* ---------- 汇总 ---------- */

/**
 * 记录页和今日页要用的全部统计。数息趋势和自评的汇总、点图、按周平均都按产品规格设了最少次数，
 * 不够时为空，界面照着显示就不会把一两次的数字说成趋势
 */
export interface RecordStats {
  totals: Summary
  today: Summary
  /** 本周（周一到周日） */
  week: Summary
  /** 今日页的「周一到周日七个点」 */
  weekDots: WeekDot[]
  /** 最近 7 天（含今天） */
  last7: Summary
  /** 本月 1 日到今天 */
  month: Summary
  /** 本月的月历点阵；看别的月份用 monthCalendar */
  calendar: CalendarDay[][]
  consistency: Consistency
  heatmap: HeatCell[]
  breakdown: PracticeShare[]
  focus: FocusPoint[]
  /** 数息的各次数据，不论次数多少；趋势用 countSummary.trend */
  count: CountPoint[]
  countSummary: CountSummary
  checkin: CheckinSummary
  /** 前后自评的点图；不足 CHECKIN_MIN_SESSIONS 次时为空 */
  checkinPoints: CheckinPoint[]
  /** 最近 TREND_WEEKS 周的按周平均：每十分钟回神次数、数息准确率、自评变化；后两项次数不够时每周都是 null */
  weekly: { focus: WeekMean[]; count: WeekMean[]; checkin: WeekMean[] }
  welcomeBack: boolean
  recentDistress: boolean
  /** @deprecated 同 recentDistress */
  suggestGentler: boolean
}

/** 记录页和今日页要用的全部统计 */
export function computeStats(records: Records, now: Date): RecordStats {
  const focus = focusTrend(records)
  const count = countTrend(records)
  const countStats = summarizeCounts(count)
  const rated = checkinTrend(records)
  const checkin = summarizeCheckins(rated)
  const checkinPoints = checkin.ready ? rated : []
  const distress = recentDistress(records)
  return {
    totals: totals(records),
    today: rangeSummary(records, now, now),
    week: weekSummary(records, now),
    weekDots: weekDots(records, now),
    last7: rangeSummary(records, addDays(now, -6), now),
    month: rangeSummary(records, new Date(now.getFullYear(), now.getMonth(), 1), now),
    calendar: monthCalendar(records, now.getFullYear(), now.getMonth(), now),
    consistency: consistency(records, now),
    heatmap: heatmap(records, now),
    breakdown: practiceBreakdown(records),
    focus,
    count,
    countSummary: countStats,
    checkin,
    checkinPoints,
    weekly: {
      focus: weeklyMeans(focus, p => p.perTenMin, now),
      count: weeklyMeans(countStats.trend, p => p.accuracy, now),
      checkin: weeklyMeans(checkinPoints, p => p.delta, now),
    },
    welcomeBack: welcomeBack(records, now),
    recentDistress: distress,
    suggestGentler: distress,
  }
}

/* ---------- 工具 ---------- */

function toKey(x: Date | string): string {
  if (typeof x === 'string') {
    if (!isDayKey(x)) throw new RangeError(`日期格式应为 YYYY-MM-DD：${x}`)
    return x
  }
  if (Number.isNaN(x.getTime())) throw new RangeError('无效的日期')
  return dayKey(x)
}

/** 周数取整并限制在 1–520；不是有限数时用默认值 */
function weekCount(weeks: number, fallback: number): number {
  return Number.isFinite(weeks) ? Math.min(Math.max(Math.floor(weeks), 1), 520) : fallback
}

/** 两个日期键相差的天数。按日历算（UTC 没有夏令时），与本机时区无关 */
function keyDiffDays(from: string, to: string): number {
  const a = dayKeyToUTC(from)
  const b = dayKeyToUTC(to)
  return a === null || b === null ? 0 : Math.round((b - a) / DAY_MS)
}

/** 某个日期键所在那一周的周一 */
function mondayOf(key: string): string | null {
  const t = dayKeyToUTC(key)
  if (t === null) return null
  const monday = new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS)
  return `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}-${pad2(monday.getUTCDate())}`
}

function chronological(records: Records): SessionRecord[] {
  return [...records].sort(byStartedAt)
}

const pointOf = (r: SessionRecord): TrendPoint => ({ id: r.id, date: r.date, startedAt: r.startedAt })

function pushRecent(recent: number[], value: number): void {
  recent.push(value)
  if (recent.length > TREND_WINDOW) recent.shift()
}
