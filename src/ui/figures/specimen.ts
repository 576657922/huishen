/**
 * 节律示意的几何（DESIGN.md §8.9 BreathSpecimen，设计稿 draw.mjs breathSpecimen）：按默认参数画几轮
 * 稳定的节律（不含开头放慢），秒为横轴——每秒一个刻度、每 5 秒一条网格、每 10 秒一个标签，单位只写在
 * 最后一个标签上（「30 秒」）。2 px 的线，下面不填色：阅读页上曲线下的灰色会读成股票面积图。
 * 第一轮上方用括号标出每一段：「吸 4.5 秒」「呼 6.5 秒」。曲线取自引擎的 buildPattern / patternAt。
 */
import type { PacedParams } from '@/content/types'
import { buildPattern, patternAt } from '@/engine'
import { n, type Point, path } from './svg'

export interface SpecimenInput {
  params: PacedParams
  /** 画几轮：慢呼吸 3，叹息和箱式呼吸 1 */
  cycles: number
  width: number
  height: number
  /** 「4.5 秒」：秒数和单位 */
  seconds: (s: number) => string
}

export interface SpecimenGeometry {
  width: number
  height: number
  /** 一共几秒 */
  span: number
  grid: { key: string; d: string }[]
  ticks: { key: string; d: string; major: boolean }[]
  axis: { key: string; x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end' }[]
  rule: string
  line: string
  brackets: { key: string; d: string; x: number; y: number; text: string }[]
}

/** 引擎按半秒描述各段（DESCRIBE_STEP_SEC） */
const half = (s: number): number => Math.round(s * 2) / 2

export function specimenGeometry({
  params,
  cycles,
  width,
  height,
  seconds,
}: SpecimenInput): SpecimenGeometry {
  const p = buildPattern(params)
  const T = p.T * cycles
  const padTop = 30
  const padBot = 24
  const x = (s: number): number => (s / T) * width
  const y = (level: number): number => height - padBot - level * (height - padTop - padBot)
  const plotBot = y(0)
  const edge = (xx: number): number => Math.min(width - 0.5, Math.max(0.5, xx))

  const grid: SpecimenGeometry['grid'] = []
  const ticks: SpecimenGeometry['ticks'] = []
  for (let s = 0; s <= Math.floor(T + 1e-9); s++) {
    const xx = edge(x(s))
    const major = s % 5 === 0
    if (major) grid.push({ key: `g${s}`, d: `M${n(xx)} ${n(y(1))}V${n(plotBot)}` })
    ticks.push({ key: `t${s}`, d: `M${n(xx)} ${n(plotBot + 1)}v${major ? 5 : 3}`, major })
  }

  const axis: SpecimenGeometry['axis'] = []
  const lastLabel = Math.floor(T / 10 + 1e-9) * 10
  for (let s = 0; s <= lastLabel; s += 10) {
    const xx = edge(x(s))
    const anchor = s === 0 ? 'start' : x(s) + 20 > width ? 'end' : 'middle'
    // 最后一个标签带单位：居中会让数字离开刻度，往右挪 7，让数字仍在刻度上
    axis.push({
      key: `a${s}`,
      x: s === lastLabel && anchor === 'middle' && s > 0 ? xx + 7 : xx,
      y: height - 3,
      text: s === lastLabel && s > 0 ? seconds(s) : String(s),
      anchor,
    })
  }

  const pts: Point[] = []
  const steps = Math.round(T / 0.05)
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * T
    pts.push([x(t), y(patternAt(p, t).y)])
  }

  const by = 12
  const brackets: SpecimenGeometry['brackets'] = p.segs.map((seg, i) => {
    const x0 = x(seg.t0) + (seg.t0 ? 2 : 0.5)
    const x1 = x(seg.t0 + seg.dur) - 2
    return {
      key: `${seg.key}${i}`,
      d: `M${n(x0)} ${by + 5}V${by}H${n(x1)}V${by + 5}`,
      x: (x0 + x1) / 2,
      y: by - 3,
      text: `${seg.label} ${seconds(half(seg.dur))}`,
    }
  })

  return {
    width,
    height,
    span: T,
    grid,
    ticks,
    axis,
    rule: `M0 ${n(plotBot + 0.5)}H${n(width)}`,
    line: path(pts),
    brackets,
  }
}
