/**
 * 溪流（移植自原型）：水体是 300 Hz–3 kHz 里四个频带的噪声，各自以 0.05–0.3 Hz 缓慢随机涨落；
 * 水泡是 400–1500 Hz、5–20 ms 的上滑正弦，像水下的小气泡破开。
 */
import { mulberry32 } from '@/lib/random'
import type { Band } from '../params'
import { biquad, filterInPlace } from './filters'
import { periodicNoise, type Rng } from './noise'
import type { Task } from './task'
import { CHUNK, type Channels, due, panGains } from './util'

export interface FlowParams {
  seed: number
  bands: readonly Band[]
  /** 包络的起伏深度：0 为恒定，1 为从静到满 */
  depth: number
  hp: number
  lp: number
  /** 包络每隔多少个采样取一个点 */
  controlStep: number
}

/** 一个频带的包络：两层不同速率的值噪声，平方后让安静与涌动的对比更自然 */
function bandEnvelope(rng: Rng, nc: number, crate: number, band: Band, depth: number): Float32Array {
  const [, , amp, rate] = band
  const secs = nc / crate
  const a = periodicNoise(rng, nc, secs * rate)
  const z = periodicNoise(rng, nc, secs * rate * 2.7)
  const e = new Float32Array(nc)
  for (let i = 0; i < nc; i++) {
    const v = 0.65 * a[i]! + 0.35 * z[i]!
    e[i] = amp * (1 - depth + depth * v * v)
  }
  return e
}

/** 水体：n 个采样、双声道，声道之间互不相关 */
export function* flow(sr: number, n: number, p: FlowParams): Task<Channels> {
  const out: Channels = []
  const ctl = p.controlStep
  for (let c = 0; c < 2; c++) {
    const rng = mulberry32(p.seed + c * 7919)
    const nc = Math.ceil(n / ctl)
    const filters = p.bands.map(([f, q]) => biquad('bandpass', f, q, sr))
    const envs = p.bands.map(b => bandEnvelope(rng, nc, sr / ctl, b, p.depth))
    const hp = biquad('highpass', p.hp, 0.7, sr)
    const lp = biquad('lowpass', p.lp, 0.7, sr)
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const w = rng() * 2 - 1
      const ci = i / ctl
      const j = ci | 0
      const f = ci - j
      const j1 = j + 1 < nc ? j + 1 : 0
      let s = 0
      for (let k = 0; k < filters.length; k++) {
        const e = envs[k]!
        s += filters[k]!(w) * (e[j]! + (e[j1]! - e[j]!) * f)
      }
      a[i] = lp(hp(s))
      if (due(i)) yield
    }
    out.push(a)
  }
  return out
}

export interface BubbleParams {
  seed: number
  minRate: number
  maxRate: number
  fLo: number
  fHi: number
  durLo: number
  durHi: number
  riseLo: number
  riseHi: number
  hp: number
  lp: number
}

/** 水泡：疏密随首尾相接的慢速密度变化；事件跨过结尾时绕回开头，循环天然无缝 */
export function* bubbles(sr: number, n: number, p: BubbleParams): Task<Channels> {
  const rng = mulberry32(p.seed)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const secs = n / sr
  const steps = Math.ceil(secs * 20)
  const dens = periodicNoise(rng, steps, secs * 0.3)
  let t = 0
  let work = 0
  for (;;) {
    const d = dens[Math.min(steps - 1, Math.floor((t / secs) * steps))]!
    t += -Math.log(1 - rng()) / (p.minRate + (p.maxRate - p.minRate) * d * d)
    if (t >= secs) break
    const f0 = p.fLo * (p.fHi / p.fLo) ** rng()
    // 小气泡音高高、响得短：时长随音高反比，再加一点随机
    const pitchShare = Math.log(f0 / p.fLo) / Math.log(p.fHi / p.fLo)
    const dur = p.durHi - (p.durHi - p.durLo) * (0.7 * pitchShare + 0.3 * rng())
    const amp = 0.04 + 0.96 * rng() ** 3
    const rise = p.riseLo + (p.riseHi - p.riseLo) * rng()
    const [gl, gr] = panGains(rng() * 1.6 - 0.8)
    const len = Math.floor(dur * sr)
    const tau = dur / 4
    const i0 = Math.floor(t * sr)
    const na = Math.max(2, Math.floor(0.0015 * sr))
    let ph = 0
    for (let k = 0; k < len; k++) {
      ph += (2 * Math.PI * f0 * (1 + (rise * k) / len)) / sr
      // 1.5 ms 升余弦起音、结尾补一个短淡出：水泡从零开始、回到零，不会咔哒
      const atk = k < na ? (1 - Math.cos((Math.PI * k) / na)) / 2 : 1
      const tail = k > len - na ? (len - k) / na : 1
      const v = amp * atk * tail * Math.exp(-k / sr / tau) * Math.sin(ph)
      const idx = (i0 + k) % n
      L[idx] = L[idx]! + v * gl
      R[idx] = R[idx]! + v * gr
    }
    work += len
    if (work >= CHUNK) {
      work = 0
      yield
    }
  }
  for (const a of [L, R]) {
    const hp = biquad('highpass', p.hp, 0.7, sr)
    const lp = biquad('lowpass', p.lp, 0.7, sr)
    yield* filterInPlace(a, x => lp(hp(x)), true)
  }
  return [L, R]
}
