/**
 * 参数自动化。
 *
 * cancelScheduledValues 会把正在进行的渐变整段删掉，参数当场跳回上一个点的值，发出咔哒声；
 * cancelAndHoldAtTime 又不是所有浏览器都有。所以这里在 JS 里记下自己排过的每一个点（只用 setValueAtTime
 * 和线性渐变，算出的值与浏览器逐采样一致），撤销时先在撤销时刻补一个落在原曲线上的点、再删掉后面的，曲线始终连续。
 */
import { ease } from '@/engine/patterns'
import type { Easing, PhaseKey, Segment } from '@/engine/types'
import { clamp, easeInOut } from '@/lib/math'

interface Point {
  t: number
  v: number
  /** true：从上一个点线性渐变到这里；false：在这一刻跳到 v */
  ramp: boolean
}

/** 补点与撤销之间的间隔：远小于一个采样，又不会被浮点误差吞掉 */
const EPS = 1e-6

export interface Track {
  readonly param: AudioParam
  /** t 时刻按已排的变化应有的值 */
  valueAt(t: number): number
  /** t 时刻直接跳到 v；只在听不出来的时候用（比如增益为 0、节点刚创建） */
  set(v: number, t: number): void
  /** 从上一个点线性渐变到 t 时刻的 v；早于最后一个点的忽略，保证时间只往前走 */
  rampTo(v: number, t: number): void
  /** 撤销 t 以后排过的变化，t 时刻保持原曲线上的值 */
  cancelFrom(t: number): void
  /** 先撤销 t0 以后的变化，再沿 shape 曲线（0→1）从 t0 时的值走到 t1 时的 v，分 steps 段线性逼近 */
  glide(v: number, t0: number, t1: number, shape?: (q: number) => number, steps?: number): void
  /** 丢掉 t 以前不再需要的点 */
  forget(t: number): void
  /** 最后一个点的时间 */
  end(): number
}

export function createTrack(param: AudioParam, initial: number, t0: number): Track {
  const pts: Point[] = [{ t: t0, v: initial, ramp: false }]
  param.setValueAtTime(initial, t0)

  /** 最后一个时间不晚于 t 的点；同一时刻有多个点时取最后排的 */
  function lastAtOrBefore(t: number): number {
    let lo = 0
    let hi = pts.length - 1
    if (pts[0]!.t > t) return -1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (pts[mid]!.t <= t) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  function valueAt(t: number): number {
    const i = lastAtOrBefore(t)
    if (i < 0) return initial
    const a = pts[i]!
    const b = pts[i + 1]
    if (!b?.ramp || b.t <= a.t) return a.v
    return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t)
  }

  function cancelFrom(at: number): void {
    const t = Math.max(at, pts[0]!.t)
    const v = valueAt(t)
    // 先补点再撤销：两步之间音频线程读到的曲线也是连续的
    param.linearRampToValueAtTime(v, t)
    param.cancelScheduledValues(t + EPS)
    let k = pts.length
    while (k > 0 && pts[k - 1]!.t >= t + EPS) k--
    pts.length = k
    pts.push({ t, v, ramp: true })
  }

  return {
    param,
    valueAt,
    set(v, t) {
      cancelFrom(t)
      param.setValueAtTime(v, t)
      pts.push({ t, v, ramp: false })
    },
    rampTo(v, t) {
      if (t < pts[pts.length - 1]!.t) return
      param.linearRampToValueAtTime(v, t)
      pts.push({ t, v, ramp: true })
    },
    cancelFrom,
    glide(v, t0, t1, shape = easeInOut, steps = 16) {
      const from = valueAt(t0)
      cancelFrom(t0)
      const n = Math.max(1, Math.round(steps))
      const d = Math.max(0, t1 - t0)
      for (let k = 1; k <= n; k++) {
        const q = k / n
        const t = t0 + d * q
        const x = from + (v - from) * shape(q)
        param.linearRampToValueAtTime(x, t)
        pts.push({ t, v: x, ramp: true })
      }
    },
    forget(t) {
      const i = lastAtOrBefore(t)
      if (i > 0) pts.splice(0, i)
    },
    end: () => pts[pts.length - 1]!.t,
  }
}

/* ---------- 曲线 ---------- */

/** 等功率交叉淡变：两层不相关的声音一进一出，总能量不变 */
export const powerIn = (q: number): number => Math.sin((clamp(q, 0, 1) * Math.PI) / 2)
export const powerOut = (q: number): number => 1 - Math.cos((clamp(q, 0, 1) * Math.PI) / 2)

/**
 * 淡出到静默用的曲线（作为 glide 的 shape，增益按 (1 − q)² 下降）：比余弦更早开始变轻、收尾更缓，
 * 30 秒、120 秒的长淡出听起来是均匀地远去，而不是先停着、最后几秒突然没了
 */
export const fadeOutCurve = (q: number): number => 1 - (1 - clamp(q, 0, 1)) ** 2

/**
 * 一段呼吸里 t 时刻的肺容量示意值。缓动直接用引擎的 ease：背景声、滑音和画面上的曲线是同一个函数，
 * 不会因为两边各写一份而悄悄走样（AudioPort.breath、glide 的契约要求位置与引擎的算法相同）
 */
export function breathY(seg: Segment, at: number, t: number): number {
  const q = seg.dur > 0 ? clamp((t - at) / seg.dur, 0, 1) : 1
  return seg.y0 + (seg.y1 - seg.y0) * ease(seg.ease, q)
}

/**
 * 按呼吸的一段排参数：每隔 step 秒取一个点，值为 map(y)。早于 from 的点不排（已经过去，或由 level 接管）。
 * 多个参数一起排，保证它们的点在同一批时刻上。
 */
export function followBreath(
  seg: Segment,
  at: number,
  from: number,
  step: number,
  targets: readonly (readonly [Track, (y: number) => number])[],
): void {
  const n = Math.max(2, Math.ceil(seg.dur / step))
  for (let k = 1; k <= n; k++) {
    const t = at + (seg.dur * k) / n
    if (t <= from) continue
    const y = breathY(seg, at, t)
    for (const [track, map] of targets) track.rampTo(map(y), t)
  }
}

/** 层内部自己生成的一段起伏（不跟节拍时的海浪等），形状与节拍里的段相同 */
export function segment(key: PhaseKey, y0: number, y1: number, dur: number, ease: Easing = 'inout'): Segment {
  return { key, dur, y0, y1, ease, label: '', hint: '', t0: 0 }
}

/** 指数映射：y 从 0 到 1 时，值从 lo 按相同倍率走到 hi（滤波截止频率用） */
export const expMap = (lo: number, hi: number, y: number): number => lo * (hi / lo) ** clamp(y, 0, 1)
