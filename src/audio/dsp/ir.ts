/**
 * 混响的冲激响应。ConvolverNode 要求冲激响应与音频环境的采样率一致，不能复用 32 kHz 的素材。
 * 做法：两个声道各一段独立噪声，指数衰减；一阶低通的系数随时间减小，高频比低频衰减得快；
 * 开头加几次稀疏的早期反射；最后按能量归一，湿声电平只由各层的 wet 参数决定。
 *
 * 这些都按采样来算（噪声逐采样取、低通系数逐采样用），换个采样率生成就是另一个混响：长混响的频响在细处起伏
 * 很大，持续音落在哪个峰谷上湿声就差好几 dB。所以只在 p.rate 上生成一次，其他采样率由它带限重采样，
 * 各种设备上的频响与校准时一样。
 */
import { mulberry32 } from '@/lib/random'
import { resample } from './resample'
import type { Task } from './task'
import { type Channels, due } from './util'

export interface ReverbParams {
  /** 生成的采样率；校准也在这个采样率上做 */
  rate: number
  seconds: number
  rt60: number
  seed: number
  predelay: number
  attack: number
  dampStart: number
  dampEnd: number
  dampTau: number
  early: number
  fadeTail: number
}

/** sr 采样率的冲激响应：在 p.rate 上生成，再换到 sr */
export function* reverbIR(sr: number, p: ReverbParams): Task<Channels> {
  const base = yield* generate(p.rate, p)
  if (sr === p.rate) return base
  // 重采样保持连续时间里的波形；而离散的频响 Σ h[n]·e^(−jωn) 跟着采样率按比例变，乘 p.rate / sr 才与生成时一样
  const g = p.rate / sr
  const out: Channels = []
  for (const ch of base) {
    const y = yield* resample(ch, p.rate, sr)
    for (let i = 0; i < y.length; i++) y[i] = y[i]! * g
    out.push(y)
  }
  return out
}

function* generate(sr: number, p: ReverbParams): Task<Channels> {
  const n = Math.floor(p.seconds * sr)
  const pre = Math.floor(p.predelay * sr)
  const out: Channels = []
  for (let c = 0; c < 2; c++) {
    const rng = mulberry32(p.seed + c * 7)
    const a = new Float32Array(n)
    let lp = 0
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr
      const k = p.dampEnd + (p.dampStart - p.dampEnd) * Math.exp(-t / p.dampTau)
      lp += k * (rng() * 2 - 1 - lp)
      a[i] = lp * Math.exp((-6.9078 * t) / p.rt60) * (1 - Math.exp(-t / p.attack))
      if (due(i)) yield
    }
    for (let e = 0; e < p.early; e++) {
      const t = 0.008 + rng() * 0.07
      const i = pre + Math.floor(t * sr)
      if (i < n) a[i] = a[i]! + (rng() < 0.5 ? -1 : 1) * 0.5 * Math.exp(-t / 0.05)
    }
    const nf = Math.floor(p.fadeTail * n)
    for (let i = 0; i < nf; i++) {
      const j = n - 1 - i
      a[j] = a[j]! * ((1 - Math.cos((Math.PI * i) / nf)) / 2)
    }
    let e = 0
    for (let i = 0; i < n; i++) e += a[i]! * a[i]!
    const g = e > 0 ? 1 / Math.sqrt(e) : 0
    for (let i = 0; i < n; i++) a[i] = a[i]! * g
    out.push(a)
  }
  return out
}
