/**
 * 段落图的几何（DESIGN.md §8.15.7，设计稿 draw.mjs stepChart）：身体扫描是一级一级往上的台阶（睡前版往下），
 * 其他引导练习所有踏步在同一高度（step 0，即 SectionStrip）。x 是时间；每一段一级踏步，标签放在自己的踏步上，
 * 所以标签不会互相压住。有 now 时：过去的踏步次级墨色，当前这一级到 now 为止是墨色、之后是线色，
 * 将来的踏步细一些、线色，跳过的踏步是虚线，朱色的点标出现在。
 */
import type { Timeline } from '@/engine'
import { n } from './svg'

export interface StepSection {
  id: string
  title: string
  /** 秒 */
  t0: number
  t1: number
}

export type TreadState = 'plain' | 'past' | 'now' | 'future' | 'skipped'

/**
 * 踏步上的标签：两个字以内的标题照写，更长的取第一个词（「胸口、后背和肩膀」→「胸口」），
 * 这样段落图、播放器里的段落标题和今日的那句「从左腿开始……」说的是同一个词
 */
export const stepLabel = (title: string): string =>
  title.length <= 2 ? title : (title.split(/[、和]/)[0] ?? title).slice(0, 2)

/**
 * 引擎时间线 → 铺满整段时长的踏步：开头的引入语算一段（「开始」），段与段之间的空隙算前一段的，
 * 最后一段延到结束（结尾的话和静默收尾也在最后一级上，设计稿 BODY_SCAN_10 就是这样画的）
 */
export function stepSections(
  timeline: Pick<Timeline, 'duration' | 'sections'>,
  opening: string,
): StepSection[] {
  const out: StepSection[] = []
  const first = timeline.sections[0]
  if (first && first.t0 > 0) out.push({ id: 'opening', title: opening, t0: 0, t1: first.t0 })
  timeline.sections.forEach((s, i) => {
    const next = timeline.sections[i + 1]
    out.push({ id: s.id, title: s.title, t0: s.t0, t1: next ? next.t0 : timeline.duration })
  })
  return out
}

export interface StepChartInput {
  sections: readonly StepSection[]
  /** 总秒数 */
  duration: number
  width: number
  /** 每级的高度：播放器 6，今日 5，其他引导练习 0 */
  step: number
  /** up：从脚往上（身体扫描）；down：从头往下（睡前身体扫描） */
  direction?: 'up' | 'down'
  /** 练习中的秒数；没有时整张图是一种墨色（今日、练习详情） */
  now?: number | null
  /** 时间轴：细线、每分钟一个刻度（每 5 分钟长一点）、「0」「5」「10 分钟」 */
  axis?: boolean
  /** 跳过的段（id） */
  skipped?: readonly string[]
  /** 轴的最后一个标签：「10 分钟」 */
  endLabel: (minutes: number) => string
}

export interface StepChartGeometry {
  width: number
  height: number
  treads: { key: string; d: string; state: TreadState }[]
  labels: { key: string; x: number; y: number; text: string; state: TreadState }[]
  now: { cx: number; cy: number } | null
  axis: {
    base: string
    ticks: { key: string; d: string; major: boolean }[]
    labels: { key: string; x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end' }[]
  } | null
}

/** 轴标签之间至少留这么宽，免得「10」和「11 分钟」挤在一起 */
const LABEL_ROOM = 40

/** 0、每 5 分钟、结束：结束那个带单位；离结束太近的整 5 分钟不标 */
export function minuteLabels(
  minutes: number,
  width: number,
  endLabel: (minutes: number) => string,
): { minute: number; x: number; text: string; anchor: 'start' | 'middle' | 'end' }[] {
  const out: { minute: number; x: number; text: string; anchor: 'start' | 'middle' | 'end' }[] = [
    { minute: 0, x: 0, text: '0', anchor: 'start' },
  ]
  for (let m = 5; m < minutes; m += 5) {
    const x = (m / minutes) * width
    if (width - x >= LABEL_ROOM) out.push({ minute: m, x, text: String(m), anchor: 'middle' })
  }
  out.push({ minute: minutes, x: width, text: endLabel(Math.round(minutes)), anchor: 'end' })
  return out
}

export function stepChartGeometry(input: StepChartInput): StepChartGeometry {
  const { sections, duration, width, step, direction = 'up', now = null, axis = true, skipped = [] } = input
  const top = 15 // 最上面那一级的标签要有地方放
  const levels = Math.max(0, sections.length - 1)
  const plotBot = top + levels * step
  const axisY = plotBot + 7 // 轴在图下面：第一级踏步不能和轴线并成一条
  const height = axisY + (axis ? 21 : 2)
  const x = (t: number): number => (t / duration) * width
  const yOf = (i: number): number => (direction === 'up' ? plotBot - i * step : top + i * step)

  const treads: StepChartGeometry['treads'] = []
  const labels: StepChartGeometry['labels'] = []
  sections.forEach((sec, i) => {
    const x0 = x(sec.t0)
    const x1 = x(sec.t1)
    const y = yOf(i)
    const state: TreadState = skipped.includes(sec.id)
      ? 'skipped'
      : now === null
        ? 'plain'
        : sec.t1 <= now
          ? 'past'
          : sec.t0 <= now
            ? 'now'
            : 'future'
    const riser = i > 0 ? `M${n(x0)} ${n(yOf(i - 1))}V${n(y)}` : `M${n(x0)} ${n(y)}`
    if (state === 'now' && now !== null) {
      // 当前这一级在 now 处分开：点后面是实线，前面是浅色
      treads.push({ key: `${sec.id}-now`, d: `${riser}H${n(x(now))}`, state: 'now' })
      treads.push({ key: `${sec.id}-ahead`, d: `M${n(x(now))} ${n(y)}H${n(x1)}`, state: 'future' })
    } else {
      treads.push({ key: sec.id, d: `${riser}H${n(x1)}`, state })
    }
    labels.push({
      key: sec.id,
      x: x0 + (i === 0 ? 0 : 3),
      y: y - 5,
      text: stepLabel(sec.title),
      state: state === 'skipped' ? 'future' : state,
    })
  })

  let dot: StepChartGeometry['now'] = null
  if (now !== null && sections.length > 0) {
    let i = sections.findIndex(s => s.t0 <= now && now < s.t1)
    if (i < 0) i = now < (sections[0]?.t0 ?? 0) ? 0 : sections.length - 1
    dot = { cx: x(Math.min(Math.max(now, 0), duration)), cy: yOf(i) }
  }

  let axisGeometry: StepChartGeometry['axis'] = null
  if (axis) {
    const minutes = duration / 60
    const ticks: { key: string; d: string; major: boolean }[] = []
    for (let m = 0; m <= minutes + 1e-9; m++) {
      const xx = Math.min(width - 0.5, Math.max(0.5, x(m * 60)))
      const major = m % 5 === 0
      ticks.push({ key: `m${m}`, d: `M${n(xx)} ${n(axisY + 1)}v${major ? 5 : 3}`, major })
    }
    const ty = height - 1
    axisGeometry = {
      base: `M0 ${n(axisY + 0.5)}H${n(width)}`,
      ticks,
      labels: minuteLabels(minutes, width, input.endLabel).map(l => ({
        key: `l${l.minute}`,
        x: l.x,
        y: ty,
        text: l.text,
        anchor: l.anchor,
      })),
    }
  }
  return { width, height, treads, labels, now: dot, axis: axisGeometry }
}
