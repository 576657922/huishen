/**
 * 林间风。素材只有两层平稳的底子：风体（粉红加布朗噪声，左右缓慢漂移）和树叶（高通噪声加快速抖动）；
 * 阵风由 gustAt 按时间直接求值、实时排程到滤波和增益上，所以既不会随循环重复，也能对齐呼气。
 */
import { mulberry32 } from '@/lib/random'
import { biquad } from './filters'
import { brownFilter, pinkFilter, smoothNoise, valueNoise } from './noise'
import type { Task } from './task'
import { type Channels, due } from './util'

export interface WindBedParams {
  seed: number
  hp: number
  lp: number
  driftRate: number
  driftDepth: number
}

export function* windBed(sr: number, n: number, p: WindBedParams): Task<Channels> {
  const ctl = 256
  const nc = Math.ceil(n / ctl) + 2
  const drift = valueNoise(mulberry32(p.seed + 2), nc, sr / ctl, p.driftRate)
  const out: Channels = []
  for (let c = 0; c < 2; c++) {
    const rng = mulberry32(p.seed + c)
    const pink = pinkFilter()
    const brown = brownFilter()
    const hp = biquad('highpass', p.hp, 0.7, sr)
    const lp = biquad('lowpass', p.lp, 0.5, sr)
    // 一侧加强时另一侧减弱，听起来像风从左边慢慢移到右边
    const side = c === 0 ? 1 : -1
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const w = rng() * 2 - 1
      const ci = i / ctl
      const j = ci | 0
      const d = drift[j]! + (drift[j + 1]! - drift[j]!) * (ci - j)
      a[i] = lp(hp(pink(w) * 0.8 + brown(w) * 2.4)) * (1 + side * p.driftDepth * (d - 0.5) * 2)
      if (due(i)) yield
    }
    out.push(a)
  }
  return out
}

export interface LeavesParams {
  seed: number
  hp: number
  lp: number
  flutterRates: readonly number[]
  flutterDepth: number
  swayRate: number
}

export function* leaves(sr: number, n: number, p: LeavesParams): Task<Channels> {
  const ctl = 32
  const nc = Math.ceil(n / ctl) + 2
  const out: Channels = []
  for (let c = 0; c < 2; c++) {
    const rng = mulberry32(p.seed + c * 53)
    // 两个快速值噪声相乘，再叠一个慢摆：大部分时间轻轻沙沙，偶尔一阵密集的抖动
    const flutter = p.flutterRates.map(rate => valueNoise(rng, nc, sr / ctl, rate))
    const sway = valueNoise(rng, nc, sr / ctl, p.swayRate)
    const env = new Float32Array(nc)
    for (let i = 0; i < nc; i++) {
      let m = 3
      for (const f of flutter) m *= f[i]!
      env[i] = (1 - p.flutterDepth + p.flutterDepth * Math.min(1, m) ** 1.5) * (0.7 + 0.6 * sway[i]!)
    }
    const hp1 = biquad('highpass', p.hp, 0.7, sr)
    const hp2 = biquad('highpass', p.hp, 0.7, sr)
    const lp = biquad('lowpass', p.lp, 0.7, sr)
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const ci = i / ctl
      const j = ci | 0
      const e = env[j]! + (env[j + 1]! - env[j]!) * (ci - j)
      a[i] = lp(hp2(hp1(rng() * 2 - 1))) * e
      if (due(i)) yield
    }
    out.push(a)
  }
  return out
}

export interface GustParams {
  seed: number
  rates: readonly number[]
  weights: readonly number[]
  contrast: number
}

/** t 秒处的阵风强度，0–1。几层 0.03–0.15 Hz 的值噪声加权平均，再用 S 形曲线拉开平静与阵风 */
export function gustAt(t: number, p: GustParams): number {
  let s = 0
  let w = 0
  for (let i = 0; i < p.rates.length; i++) {
    const wi = p.weights[i] ?? 0
    s += wi * smoothNoise(p.seed + i * 101, t, p.rates[i]!)
    w += wi
  }
  return 1 / (1 + Math.exp(-p.contrast * (s / (w || 1) - 0.5)))
}
