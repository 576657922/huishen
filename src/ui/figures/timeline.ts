/**
 * 回神时间线的几何（DESIGN.md §8.15.8，设计稿 draw.mjs focusTimeline）：每次回神在这次练习的时间轴上
 * 留一道竖线。播放器里过去的那段基线是实线、后面是点线，朱色的点标出现在；小结里整段都已过去。
 */

import { minuteLabels } from './stepchart'
import { n } from './svg'

export interface FocusTimelineInput {
  width: number
  /** 这次练习的分钟数（播放器：计划时长；小结：练了多久） */
  minutes: number
  /** 每次回神在第几秒 */
  marks: readonly number[]
  /** 播放器里的现在（秒）；没有时整段都已过去 */
  t?: number | null
  /** 竖线高 16 */
  tick?: number
  endLabel: (minutes: number) => string
}

export interface FocusTimelineGeometry {
  width: number
  height: number
  base: number
  past: string
  future: string | null
  ticks: { key: string; d: string }[]
  minor: { key: string; d: string; major: boolean }[]
  labels: { key: string; x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end' }[]
  now: { cx: number; cy: number } | null
}

export function focusTimelineGeometry(input: FocusTimelineInput): FocusTimelineGeometry {
  const { width, minutes, marks, t = null, tick = 16 } = input
  const D = minutes * 60
  const top = 4
  const base = top + tick + 6
  const height = base + 26
  // 竖线和现在的点不贴到边上（线头是圆的，贴边会被切掉一半）
  const x = (s: number): number => Math.min(width - 1, Math.max(1, (s / D) * width))
  const tn = t ?? D
  const minor: FocusTimelineGeometry['minor'] = []
  for (let mm = 0; mm <= minutes + 1e-9; mm++) {
    const xx = Math.min(width - 0.5, Math.max(0.5, ((mm * 60) / D) * width))
    const major = mm % 5 === 0
    minor.push({ key: `m${mm}`, d: `M${n(xx)} ${n(base + 4)}v${major ? 5 : 3}`, major })
  }
  const labels = minuteLabels(minutes, width, input.endLabel).map(l => ({
    key: `l${l.minute}`,
    // 0 和结束的标签对齐到最外面的刻度（距边 0.5），与设计稿一致
    x: l.anchor === 'start' ? 0.5 : l.anchor === 'end' ? width - 0.5 : l.x,
    y: height - 2,
    text: l.text,
    anchor: l.anchor,
  }))
  return {
    width,
    height,
    base,
    past: `M0 ${n(base)}H${n(x(tn))}`,
    future: t === null ? null : `M${n(x(tn) + 4)} ${n(base)}H${n(width)}`,
    ticks: marks.map((m, i) => ({ key: `${m}#${i}`, d: `M${n(x(m))} ${n(base - 1)}V${n(base - 1 - tick)}` })),
    minor,
    labels,
    now: t === null ? null : { cx: x(tn), cy: base },
  }
}
