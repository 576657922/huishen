/**
 * 数据图的几何（DESIGN.md §8.9，设计稿 charts.mjs、draw.mjs）：回神次数点图、数息走势、效应量与置信区间。
 * 一张图只有一组数据，所以没有图例；墨色画数据，朱色只标今天。
 */
import { addDays, dayKey, parseDayKey } from '@/lib/date'
import { axisDate } from '../strings'
import { n, type Point, path } from './svg'

const DAY_MS = 86400000

export interface DotPoint {
  /** YYYY-MM-DD */
  date: string
  value: number
  /** 今天的点用朱色 */
  today?: boolean
}

export interface DotPlotGeometry {
  width: number
  height: number
  padL: number
  grid: { y: number; value: number }[]
  ticks: { x: number; label: string }[]
  dots: { key: string; cx: number; cy: number; today: boolean }[]
  baseY: number
}

/** 纵轴 0–10；最大值超过 10 时延到下一个 5 的倍数 */
export function dotPlotMax(points: readonly DotPoint[]): number {
  const top = Math.max(0, ...points.map(p => p.value))
  return top <= 10 ? 10 : Math.ceil(top / 5) * 5
}

/** x 是日期，y 是每 10 分钟回神次数；横轴在每个周一标日期，一个月第一次出现时带上月份 */
export function dotPlotGeometry(
  points: readonly DotPoint[],
  from: string,
  to: string,
  width = 350,
  height = 160,
): DotPlotGeometry {
  const padL = 28
  const padR = 10
  const padT = 10
  const padB = 28
  const max = dotPlotMax(points)
  const d0 = parseDayKey(from).getTime() - DAY_MS * 0.6
  const d1 = parseDayKey(to).getTime() + DAY_MS * 0.6
  const x = (date: string): number =>
    padL + ((parseDayKey(date).getTime() - d0) / (d1 - d0)) * (width - padL - padR)
  const y = (v: number): number => height - padB - (v / max) * (height - padT - padB)
  const grid: DotPlotGeometry['grid'] = []
  for (let v = 0; v <= max; v += 5) grid.push({ y: y(v), value: v })
  const ticks: DotPlotGeometry['ticks'] = []
  let lastMonth = -1
  for (let d = parseDayKey(from); dayKey(d) <= to; d = addDays(d, 1)) {
    if (d.getDay() !== 1) continue
    const month = d.getMonth() + 1
    ticks.push({ x: x(dayKey(d)), label: axisDate(month, d.getDate(), month !== lastMonth) })
    lastMonth = month
  }
  return {
    width,
    height,
    padL,
    grid,
    ticks,
    baseY: y(0),
    dots: points.map((p, i) => ({
      key: `${p.date}#${i}`,
      cx: x(p.date),
      cy: y(p.value),
      today: Boolean(p.today),
    })),
  }
}

export interface SparkGeometry {
  width: number
  height: number
  d: string
  dots: { key: string; cx: number; cy: number; r: number }[]
}

/** 数息准确率：固定的 50–100% 刻度上一条 2 px 线，每次 4 px 的点，最近一次 8 px */
export function sparkGeometry(
  values: readonly number[],
  domain: readonly [number, number] = [0.5, 1],
  width = 120,
  height = 32,
): SparkGeometry {
  const pad = 5
  const [lo, hi] = domain
  const x = (i: number): number => pad + (i / Math.max(1, values.length - 1)) * (width - 2 * pad)
  const y = (v: number): number =>
    height - pad - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (height - 2 * pad)
  const pts: Point[] = values.map((v, i) => [x(i), y(v)])
  return {
    width,
    height,
    d: path(pts),
    dots: pts.map(([cx, cy], i) => ({ key: `s${i}`, cx, cy, r: i === pts.length - 1 ? 4 : 2 })),
  }
}

export interface Effect {
  /** 效应量 */
  g: number
  /** 95% 置信区间 */
  lo: number
  hi: number
}

/** 一张卡片里的效应量共用一根轴，所以几何按同一个 domain 算 */
export function ciScale(domain: readonly [number, number], width: number): (v: number) => number {
  const pad = 5
  const [min, max] = domain
  return v => pad + ((v - min) / (max - min)) * (width - 2 * pad)
}

export function ciBarGeometry(effect: Effect, domain: readonly [number, number], width = 350, h = 16) {
  const x = ciScale(domain, width)
  return { zeroX: x(0), x0: x(effect.lo), x1: x(effect.hi), cx: x(effect.g), cy: h / 2, h, width }
}

/** 负数用减号 U+2212，不用连字符（DESIGN.md §4.4） */
export const signed = (v: number): string => (v < 0 ? `−${String(-v)}` : String(v))

export function ciAxisGeometry(domain: readonly [number, number], ticks: readonly number[], width = 350) {
  const x = ciScale(domain, width)
  return {
    width,
    height: 20,
    line: `M5 0.5H${n(width - 5)}`,
    ticks: ticks.map(t => ({ x: x(t), label: t === 0 ? '0' : signed(t) })),
  }
}

export interface CheckinInput {
  before: readonly number[]
  after: readonly number[]
  /** 两行的中位数；不给时按 0–10 的等级算（偶数个时取中间两个的平均） */
  medians?: { before: number; after: number }
  width: number
  rowH?: number
  dot?: number
  gap?: number
  cols?: number
}

export interface CheckinGeometry {
  width: number
  height: number
  padL: number
  grid: { key: string; d: string; major: boolean }[]
  axis: { key: string; x: number; y: number; text: string }[]
  rows: {
    key: 'before' | 'after'
    labelY: number
    base: string
    median: string
    medianValue: number
    dots: { key: string; cx: number; cy: number }[]
  }[]
  r: number
}

export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b)
  if (s.length === 0) return 0
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
}

/**
 * 练习前后自评（DESIGN.md §8.9 CheckinStrips，设计稿 charts.mjs checkinStrips）：两行共用一根 0–10 的轴；
 * 相同的回答聚成三个点宽的一小团、往上摞；每行一条 1.5 px 的竖线标中位数。没有箭头、没有差值。
 */
export function checkinGeometry({
  before,
  after,
  medians,
  width,
  rowH = 52,
  dot = 6,
  gap = 1.5,
  cols = 3,
}: CheckinInput): CheckinGeometry {
  const padL = 56
  const padR = 10
  const height = rowH * 2 + 22
  const x = (v: number): number => padL + (v / 10) * (width - padL - padR)
  const pitch = dot + gap
  const grid: CheckinGeometry['grid'] = []
  const axis: CheckinGeometry['axis'] = []
  for (let v = 0; v <= 10; v++) {
    grid.push({ key: `g${v}`, d: `M${n(x(v))} 2V${rowH * 2}`, major: v % 5 === 0 })
    if (v % 5 === 0) axis.push({ key: `a${v}`, x: x(v), y: height - 4, text: String(v) })
  }
  const rows = (['before', 'after'] as const).map((key, row) => {
    const values = key === 'before' ? before : after
    const med = medians ? medians[key] : median(values)
    const base = row * rowH + rowH - 10
    const counts = new Map<number, number>()
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
    const tallest = Math.max(0, ...[...counts.values()].map(c => Math.ceil(c / cols)))
    const dots: { key: string; cx: number; cy: number }[] = []
    for (const [v, c] of counts) {
      for (let k = 0; k < c; k++) {
        const col = k % cols
        const r = Math.floor(k / cols)
        const inRow = Math.min(cols, c - r * cols)
        dots.push({ key: `${v}-${k}`, cx: x(v) + (col - (inRow - 1) / 2) * pitch, cy: base - r * pitch })
      }
    }
    return {
      key,
      labelY: base + 1,
      base: `M${padL} ${n(base + 5.5)}H${n(width - padR)}`,
      median: `M${n(x(med))} ${n(base + 9)}V${n(base - tallest * pitch - 3)}`,
      medianValue: med,
      dots,
    }
  })
  return { width, height, padL, grid, axis, rows, r: dot / 2 }
}

/** 数息准确率在 50–100% 的轨道上的位置（百分比，0–100）；超出刻度的值停在两端 */
export function accuracyPercent(accuracy: number, domain: readonly [number, number] = [0.5, 1]): number {
  const [lo, hi] = domain
  return ((Math.min(hi, Math.max(lo, accuracy)) - lo) / (hi - lo)) * 100
}
