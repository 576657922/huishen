/**
 * 拨弦（Karplus–Strong），音色接近古琴、古筝：
 * 延迟线 + 两点平均（阻尼）+ 一阶全通（小数延迟，保证音准）+ 按 T60 计算的环路损耗；
 * 激励是低通噪声，再按拨弦位置做梳状滤波；最后过琴身共鸣和高频搁架。
 * 不加「吟」这类快速揉弦：研究建议的揉音只有 0.1–0.3 Hz、5 音分以内，拨弦衰减得比这慢得多的周期还快，加了也只是音高的抖动。
 */
import { mulberry32 } from '@/lib/random'
import { biquad, chain, filterInPlace } from './filters'
import type { Task } from './task'
import { due, fadeEdges } from './util'

export interface PluckParams {
  seconds: number
  seed: number
  /** 基频衰减 60 dB 的秒数 */
  t60: number
  /** 0–1，越小越暗 */
  brightness: number
  /** 拨弦位置（弦长比例） */
  position: number
  body: readonly (readonly [number, number, number])[]
  shelfHz: number
  shelfDb: number
  attack: number
  release: number
}

export function* pluck(sr: number, freq: number, p: PluckParams): Task<Float32Array> {
  const n = Math.floor(p.seconds * sr)
  const rng = mulberry32(p.seed)
  // 环路总延迟 = 整数延迟线 L + 两点平均的 0.5 个采样 + 全通的小数延迟 frac（保持在 0.1–1.1 之间）
  const total = sr / freq
  const L = Math.max(2, Math.floor(total - 0.6))
  const frac = total - 0.5 - L
  const C = (1 - frac) / (1 + frac)
  // 每走一圈的增益让基频在 t60 秒内衰减 60 dB；两点平均在基频处本身有 cos(πf/sr) 的损耗，要扣掉
  const perPeriod = 10 ** (-3 / (p.t60 * freq))
  const rho = Math.min(0.99999, perPeriod / Math.cos((Math.PI * freq) / sr))

  const line = new Float64Array(L)
  const k = 0.12 + 0.8 * p.brightness
  let s = 0
  for (let i = 0; i < L; i++) {
    s += k * (rng() * 2 - 1 - s)
    line[i] = s
  }
  // 拨弦位置的梳状滤波：在 1/position 倍频附近形成缺口，音色更像真的弦
  const P = Math.max(1, Math.round(p.position * L))
  for (let i = L - 1; i >= P; i--) line[i] = line[i]! - line[i - P]!
  let mean = 0
  for (let i = 0; i < L; i++) mean += line[i]!
  mean /= L
  for (let i = 0; i < L; i++) line[i] = line[i]! - mean

  const y = new Float32Array(n)
  let idx = 0
  let prev = 0
  let apx = 0
  let apy = 0
  for (let i = 0; i < n; i++) {
    const x = line[idx]!
    const avg = 0.5 * (x + prev)
    prev = x
    const ap = C * avg + apx - C * apy
    apx = avg
    apy = ap
    line[idx] = rho * ap
    if (++idx === L) idx = 0
    y[i] = x
    if (due(i)) yield
  }

  const body = chain([
    ...p.body.map(([f, q, g]) => biquad('peaking', f, q, sr, g)),
    biquad('highshelf', p.shelfHz, 0.7, sr, p.shelfDb),
    biquad('highpass', 40, 0.7, sr),
  ])
  yield* filterInPlace(y, body)
  return fadeEdges(y, sr, p.attack, p.release)
}
