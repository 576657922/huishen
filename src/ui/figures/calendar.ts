/**
 * 本周的点与月历点阵的几何（DESIGN.md §8.9，设计稿 charts.mjs）。
 * 练过的日子是一个实心点；没练的日子——过去的也好、还没到的也好——什么都不画（PRODUCT.md §7：留空）。
 * 今天单独标：星期名或日期数字用朱色，下面一道 10 px 的朱色短线。
 */
import { parseDayKey } from '@/lib/date'
import { WEEKDAYS_MON_FIRST } from '../strings'

export type DayState = 'past' | 'today' | 'future'

export interface WeekDay {
  /** YYYY-MM-DD */
  date: string
  minutes: number
  state: DayState
}

export interface WeekDotsGeometry {
  width: number
  height: number
  slots: {
    cx: number
    label: string
    state: DayState
    practised: boolean
  }[]
  dotY: number
  dotR: number
  labelY: number
  /** 今天那道短线的 y */
  ruleY: number
}

/** 周一在前的星期名 */
export function weekdayLabel(date: string): string {
  const day = parseDayKey(date).getDay()
  return WEEKDAYS_MON_FIRST[(day + 6) % 7] ?? ''
}

/** 手机上每格 24、点 8；桌面每格 30、点 10 */
export function weekDotsGeometry(
  days: readonly WeekDay[],
  size: 'phone' | 'desk' = 'phone',
): WeekDotsGeometry {
  const col = size === 'desk' ? 30 : 24
  const dot = size === 'desk' ? 10 : 8
  const dotY = dot / 2 + 1
  const labelY = dotY + dot / 2 + 17
  return {
    width: col * days.length,
    height: labelY + 6,
    dotY,
    dotR: dot / 2,
    labelY,
    ruleY: labelY + 4.25,
    slots: days.map((d, i) => ({
      cx: i * col + col / 2,
      label: weekdayLabel(d.date),
      state: d.state,
      practised: d.minutes > 0,
    })),
  }
}

export interface MonthCell {
  date: string
  day: number
  cx: number
  top: number
  practised: boolean
  today: boolean
}

export interface MonthGeometry {
  width: number
  height: number
  head: number
  cellW: number
  cellH: number
  weekdays: { x: number; label: string }[]
  cells: MonthCell[]
  practisedCount: number
}

const pad2 = (x: number): string => String(x).padStart(2, '0')

/** 月历：七列、周一在前，每格 50 × 44（七格正好是手机上 350 宽的一栏） */
export function monthGeometry(
  year: number,
  month: number,
  practised: ReadonlySet<string>,
  today: string | null,
  cellW = 50,
  cellH = 44,
): MonthGeometry {
  const head = 20
  const first = new Date(year, month - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const daysIn = new Date(year, month, 0).getDate()
  const rows = Math.ceil((offset + daysIn) / 7)
  const cells: MonthCell[] = []
  let practisedCount = 0
  for (let d = 1; d <= daysIn; d++) {
    const k = offset + d - 1
    const date = `${year}-${pad2(month)}-${pad2(d)}`
    const isPractised = practised.has(date)
    if (isPractised) practisedCount++
    cells.push({
      date,
      day: d,
      cx: (k % 7) * cellW + cellW / 2,
      top: head + Math.floor(k / 7) * cellH,
      practised: isPractised,
      today: date === today,
    })
  }
  return {
    width: cellW * 7,
    height: head + rows * cellH,
    head,
    cellW,
    cellH,
    weekdays: WEEKDAYS_MON_FIRST.map((label, i) => ({ x: i * cellW + cellW / 2, label })),
    cells,
    practisedCount,
  }
}
