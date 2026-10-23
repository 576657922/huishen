/**
 * 练习的呼吸字形（48 × 24，DESIGN.md §8.6）：每个练习画它自己的结构。
 * 跟节拍的三种从引擎的真实节拍取样（buildPattern + patternAt），身体扫描的台阶宽度来自 buildTimeline，
 * 其余是设计稿 draw.mjs → GLYPHS 的几何，原样移植。
 */
import { PRACTICE_BY_ID } from '@/content/practices'
import { getScript } from '@/content/scripts'
import type { PacedParams } from '@/content/types'
import { buildPattern, patternAt } from '@/engine/patterns'
import { buildTimeline } from '@/engine/timeline'
import { easeInOut } from '@/lib/math'
import { n, type Point, path } from './svg'

export const GLYPH_W = 48
export const GLYPH_H = 24
/** 绘制区 y 3.5–20.5 */
const TOP = 3.5
const BOT = 20.5
const gy = (level: number): number => BOT - level * (BOT - TOP)

export type GlyphId =
  | 'focus'
  | 'breath-count'
  | 'body-scan'
  | 'body-scan-sleep'
  | 'breathing-space'
  | 'breathing-space-coping'
  | 'loving-kindness'
  | 'self-compassion'
  | 'open-awareness'
  | 'walking'
  | 'pause'
  | 'grounding'
  | 'timer'
  | 'slow'
  | 'cyclic-sigh'
  | 'box'
  | 'pace-finder'
  | 'listen'
  | 'sleep'

export interface GlyphCircle {
  cx: number
  cy: number
  r: number
}

export interface GlyphShape {
  d: string
  circles?: readonly GlyphCircle[]
}

/** 舒适节律探索的五档（PRODUCT.md §2：6.5 → 4.5 次/分，每档 1 分钟） */
const PACE_FINDER_RATES = [6.5, 6, 5.5, 5, 4.5] as const
/** 一段曲线取样的点数：48 px 宽，240 段已经看不出折线 */
const SAMPLES = 240

/** 从 offset 起 span 秒的节拍画满 48 px */
function wave(params: PacedParams, span: number, offset = 0): string {
  const p = buildPattern(params)
  const pts: Point[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const t = offset + (i / SAMPLES) * span
    pts.push([(i / SAMPLES) * GLYPH_W, gy(patternAt(p, t).y)])
  }
  return path(pts)
}

function pacedOf(id: 'slow' | 'cyclic-sigh' | 'box'): PacedParams {
  const paced = PRACTICE_BY_ID[id].paced
  if (!paced) throw new Error(`${id} 没有节拍参数`)
  return paced
}

/** 五档各画一轮（吸呼等长），宽度按各自一轮的秒数分 */
function paceFinder(): string {
  const total = PACE_FINDER_RATES.reduce((a, r) => a + 60 / r, 0)
  let x0 = 0
  let d = ''
  for (const rate of PACE_FINDER_RATES) {
    const p = buildPattern({ type: 'resonance', rate, ratio: 'equal' })
    const w = (p.T / total) * GLYPH_W
    const pts: Point[] = []
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * p.T
      pts.push([x0 + (t / p.T) * w, gy(patternAt(p, t).y)])
    }
    d += path(pts).replace(/^M/, d ? 'L' : 'M')
    x0 += w
  }
  return d
}

/**
 * 身体扫描：标准引导、10 分钟的真实段落时间，一段一级台阶，九级从左下到右上。
 * 第一段之前的开场（「开始」）也是一级；全身那一级延到结尾（收尾的话和结尾的静默）
 */
function bodyScan(): string {
  const { sections, duration } = buildTimeline(getScript('body-scan'), 10, { level: 'standard' })
  const spans = sections.map(sec => [sec.t0, sec.t1] as const)
  const first = spans[0]?.[0] ?? 0
  if (first > 0) spans.unshift([0, first])
  const rise = 16 / Math.max(1, spans.length - 1)
  const x = (t: number): number => (t / duration) * 47 + 0.5
  let d = ''
  spans.forEach(([t0, t1], i) => {
    const end = i === spans.length - 1 ? duration : t1
    d += `${i ? 'L' : 'M'}${n(x(t0))} ${n(20.5 - i * rise)}H${n(x(end))}`
  })
  return d
}

/** 沙漏：宽 → 窄 → 宽，对应觉察 → 集中 → 扩展 */
function hourglass(): string {
  const top: Point[] = []
  const bot: Point[] = []
  for (let i = 0; i <= 94; i++) {
    const x = 1 + i / 2
    const u = x < 15 ? easeInOut((x - 1) / 14) : x > 33 ? 1 - easeInOut((x - 33) / 14) : 1
    top.push([x, 3.5 + u * 7])
    bot.push([x, 20.5 - u * 7])
  }
  return path(top) + path(bot)
}

function lovingKindness(): string {
  const half = [1.5, 3.5, 5.75, 8.5]
  const xs = [1, 12, 24, 36, 47]
  let t = ''
  let b = ''
  half.forEach((h, i) => {
    t += `${i ? 'L' : 'M'}${n(xs[i] ?? 0)} ${n(12 - h)}H${n(xs[i + 1] ?? 0)}`
    b += `${i ? 'L' : 'M'}${n(xs[i] ?? 0)} ${n(12 + h)}H${n(xs[i + 1] ?? 0)}`
  })
  return t + b
}

/** 听声音：放松是平稳的水声线，最后三分之一淡出；睡前更慢，整段都在淡出 */
function soundLine(
  env: (u: number) => number,
  a: number,
  f1: number,
  b: number,
  f2: number,
  ph: number,
): string {
  const pts: Point[] = []
  for (let i = 0; i <= 184; i++) {
    const u = i / 184
    const e = env(u)
    pts.push([
      1 + u * 46,
      12 - e * (a * Math.sin(2 * Math.PI * u * f1) + b * Math.sin(2 * Math.PI * u * f2 + ph)),
    ])
  }
  return path(pts)
}

function bodyScanSleep(): string {
  const k = 7
  let d = ''
  for (let i = 0; i < k; i++) {
    d += `${i ? 'L' : 'M'}${n(1 + (i * 46) / k)} ${n(4.5 + (i * 16) / (k - 1))}H${n(1 + ((i + 1) * 46) / k)}`
  }
  return d
}

const BUILDERS: Record<GlyphId, () => GlyphShape> = {
  slow: () => ({ d: wave(pacedOf('slow'), 24) }),
  // 一整轮叹息：快吸、78% 处的补吸肩、长长的呼气尾巴；两轮在 48 px 里会被看成慢呼吸的波浪
  'cyclic-sigh': () => {
    const p = pacedOf('cyclic-sigh')
    return { d: wave(p, buildPattern(p).T) }
  },
  box: () => ({ d: wave(pacedOf('box'), 32) }),
  'pace-finder': () => ({ d: paceFinder() }),
  focus: () => ({
    d: `M1 20.5H47${[0.1, 0.19, 0.27, 0.43, 0.56, 0.71, 0.88].map(f => `M${n(2 + f * 44)} 20.5V11.5`).join('')}`,
  }),
  'breath-count': () => {
    let d = 'M1 20.5H47'
    for (let i = 0; i < 9; i++) d += `M${n(4 + i * 5)} 20.5V${i === 8 ? 8.5 : 15.5}`
    return { d }
  },
  'body-scan': () => ({ d: bodyScan() }),
  'body-scan-sleep': () => ({ d: bodyScanSleep() }),
  'breathing-space': () => ({ d: hourglass() }),
  'breathing-space-coping': () => ({ d: hourglass() }),
  'loving-kindness': () => ({ d: lovingKindness() }),
  'self-compassion': () => ({ d: 'M1 18.5H15V13H31V7.5H47' }),
  'open-awareness': () => ({ d: 'M2 12L46 3.5M2 12L46 20.5M2 12H46M2 12L46 7.75M2 12L46 16.25' }),
  walking: () => {
    let d = 'M1 12H47'
    for (let i = 0; i < 6; i++) d += `M${n(5.5 + i * 7.4)} 12V${i % 2 ? 18.5 : 5.5}`
    return { d }
  },
  pause: () => ({ d: 'M1 16.5H11M16 16.5C19.5 16.5 20.5 7.5 24 7.5S28.5 16.5 32 16.5M37 16.5H47' }),
  grounding: () => ({ d: 'M1 18.5H47M8 18.5V12M16 18.5V12M32 18.5V12M40 18.5V12' }),
  timer: () => ({
    d: 'M6.25 16.5H41.75M24 16.5V12.5',
    circles: [
      { cx: 3.75, cy: 16.5, r: 2.5 },
      { cx: 44.25, cy: 16.5, r: 2.5 },
    ],
  }),
  listen: () => ({
    d: soundLine(u => (u < 0.68 ? 1 : 1 - easeInOut((u - 0.68) / 0.32)), 3.1, 3.1, 1.3, 6.7, 0.9),
  }),
  sleep: () => ({ d: soundLine(u => 1 - easeInOut(Math.min(1, u / 0.92)), 4.4, 2.2, 0.9, 5.3, 0.5) }),
}

const cache = new Map<GlyphId, GlyphShape>()

/** 字形的几何；每个只算一次 */
export function glyphShape(id: GlyphId): GlyphShape {
  let shape = cache.get(id)
  if (!shape) {
    shape = BUILDERS[id]()
    cache.set(id, shape)
  }
  return shape
}

export const GLYPH_IDS = Object.keys(BUILDERS) as GlyphId[]

export function isGlyphId(id: string): id is GlyphId {
  return Object.hasOwn(BUILDERS, id)
}

/** 计划：每周一个 4.5 px 的小方块（八周 8 个、四周 4 个），左对齐 */
export function programGlyph(weeks: number): GlyphShape {
  const s = 4.5
  const gap = (46 - weeks * s) / Math.max(1, weeks - 1)
  const pitch = Math.min(s + gap, 6.5)
  let d = ''
  for (let i = 0; i < weeks; i++) d += `M${n(1 + i * pitch)} ${n(14.25)}h${s}v${s}h${-s}Z`
  return { d }
}
