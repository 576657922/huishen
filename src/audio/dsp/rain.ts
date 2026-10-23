/**
 * 雨：平稳的雨幕加细密的雨滴，外加偶尔一颗更重的雨滴。
 * 雨幕 = 粉红噪声，滤掉 150 Hz 以下、7 kHz 以上；
 * 细雨滴 = 泊松分布的小颗粒（每秒 80–400 个，1–5 kHz、3–30 ms），多数是带共鸣的噪声，少数是音高略上滑的「滴」；
 * 重雨滴不放进循环（循环一圈就会重复出现，耳朵认得出来），做成几段单次素材，由声景实时随机安排。
 */
import { mulberry32 } from '@/lib/random'
import { biquad, filterInPlace } from './filters'
import { periodicNoise, pinkFilter, type Rng } from './noise'
import type { Task } from './task'
import { CHUNK, type Channels, due, panGains } from './util'

export interface RainBedParams {
  seed: number
  hp: number
  lp: number
}

/** 雨幕：两个声道各自独立的粉红噪声，左右不相关，雨声才宽 */
export function* rainBed(sr: number, n: number, p: RainBedParams): Task<Channels> {
  const out: Channels = []
  for (let c = 0; c < 2; c++) {
    const rng = mulberry32(p.seed + c * 977)
    const pink = pinkFilter()
    const hp = biquad('highpass', p.hp, 0.7, sr)
    // 两级低通（24 dB/倍频程）：雨幕的嘶声留在 7 kHz 以内，不刺耳
    const lp1 = biquad('lowpass', p.lp, 0.54, sr)
    const lp2 = biquad('lowpass', p.lp, 1.31, sr)
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      a[i] = lp2(lp1(hp(pink(rng() * 2 - 1))))
      if (due(i)) yield
    }
    out.push(a)
  }
  return out
}

export interface RainDropParams {
  seed: number
  minRate: number
  maxRate: number
  /** 疏密变化的速率（Hz）；循环里取整数个起伏，接缝处疏密连续 */
  densityRate: number
  fLo: number
  fHi: number
  durLo: number
  durHi: number
  /** 带音高的「滴」所占比例，其余是带共鸣的噪声 */
  tonal: number
  qLo: number
  qHi: number
  hp: number
  lp: number
}

/** 区间内按对数均匀取值：频率、时长都是按倍数感知的 */
const logUniform = (rng: Rng, lo: number, hi: number): number => lo * (hi / lo) ** rng()

/** 颗粒的起音：0.4 ms 升余弦，避免单个采样的突变 */
const ATTACK = 0.0004

interface Grain {
  t: number
  f: number
  dur: number
  amp: number
  pan: [number, number]
}

/** 写入一颗颗粒，跨过结尾时绕回开头（循环天然无缝）；返回写入的采样数 */
function addGrain(
  L: Float32Array,
  R: Float32Array,
  sr: number,
  g: Grain,
  sample: (k: number) => number,
): number {
  const n = L.length
  const len = Math.max(8, Math.floor(g.dur * sr))
  const na = Math.max(2, Math.floor(ATTACK * sr))
  // 时长内衰减约 35 dB，结尾再补一个短淡出，颗粒在自己的时长里收干净
  const tau = g.dur / 4
  const i0 = Math.floor(g.t * sr)
  const [gl, gr] = g.pan
  for (let k = 0; k < len; k++) {
    const atk = k < na ? (1 - Math.cos((Math.PI * k) / na)) / 2 : 1
    const tail = k > len - na ? (len - k) / na : 1
    const v = g.amp * atk * tail * Math.exp(-k / sr / tau) * sample(k)
    const idx = (i0 + k) % n
    L[idx] = L[idx]! + v * gl
    R[idx] = R[idx]! + v * gr
  }
  return len
}

/** 带共鸣的噪声颗粒：白噪声过一个窄带通，像雨点打在叶子上 */
function noiseGrain(rng: Rng, sr: number, f: number, q: number): (k: number) => number {
  const bp = biquad('bandpass', f, q, sr)
  // 窄带通会把电平压低约 √Q 倍，补回来，各颗粒的响度与 Q 无关
  const gain = Math.sqrt(q)
  return () => gain * bp(rng() * 2 - 1)
}

/** 带音高的「滴」：正弦，音高在颗粒内上滑 rise 倍（水面下的小气泡） */
function toneGrain(sr: number, f: number, rise: number, len: number, phase: number): (k: number) => number {
  let ph = phase
  return k => {
    ph += (2 * Math.PI * f * (1 + (rise * k) / len)) / sr
    return Math.sin(ph)
  }
}

export function* rainDrops(sr: number, n: number, p: RainDropParams): Task<Channels> {
  const rng = mulberry32(p.seed)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const secs = n / sr
  // 疏密：首尾相接的慢速起伏，循环一圈里取整数个
  const steps = Math.ceil(secs * 10)
  const dens = periodicNoise(rng, steps, secs * p.densityRate)
  let work = 0
  for (let t = 0; ; ) {
    const d = dens[Math.min(steps - 1, Math.floor((t / secs) * steps))]!
    t += -Math.log(1 - rng()) / (p.minRate + (p.maxRate - p.minRate) * d)
    if (t >= secs) break
    const g: Grain = {
      t,
      f: logUniform(rng, p.fLo, p.fHi),
      dur: logUniform(rng, p.durLo, p.durHi),
      // 多数雨点很轻，少数清楚：振幅偏向小值
      amp: 0.06 + 0.94 * rng() ** 3,
      pan: panGains(rng() * 1.6 - 0.8),
    }
    const len = Math.max(8, Math.floor(g.dur * sr))
    const sample =
      rng() < p.tonal
        ? toneGrain(sr, g.f, 0.08 + 0.3 * rng(), len, rng() * 2 * Math.PI)
        : noiseGrain(rng, sr, g.f, p.qLo + (p.qHi - p.qLo) * rng())
    work += addGrain(L, R, sr, g, sample)
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

export interface HeavyDropParams {
  seed: number
  /** 音高范围（Hz）：比细雨滴低，更「圆」 */
  fLo: number
  fHi: number
  /** 衰减时间常数范围（秒） */
  tauLo: number
  tauHi: number
  /** 溅水声相对主音的幅度 */
  splash: number
  /** 溅水声的高通（Hz）与衰减（秒） */
  splashHp: number
  splashTau: number
}

/** 一颗重雨滴（单声道）：音高上滑的圆润「嘀」，加一小团溅水声；第 index 种 */
export function* heavyDrop(sr: number, index: number, p: HeavyDropParams): Task<Channels> {
  const rng = mulberry32(p.seed + index * 131)
  const f = logUniform(rng, p.fLo, p.fHi)
  const tau = p.tauLo + (p.tauHi - p.tauLo) * rng()
  const rise = 0.2 + 0.3 * rng()
  const n = Math.floor((tau * 7 + 0.01) * sr)
  const a = new Float32Array(n)
  const na = Math.floor(0.0008 * sr)
  const hp = biquad('highpass', p.splashHp, 0.7, sr)
  let ph = 0
  for (let k = 0; k < n; k++) {
    const t = k / sr
    ph += (2 * Math.PI * f * (1 + rise * Math.min(1, t / (tau * 3)))) / sr
    const atk = k < na ? (1 - Math.cos((Math.PI * k) / na)) / 2 : 1
    const splash = p.splash * hp(rng() * 2 - 1) * Math.exp(-t / p.splashTau)
    a[k] = atk * (Math.exp(-t / tau) * Math.sin(ph) + splash)
  }
  // 结尾 5 ms 淡出：截断处不留台阶
  const nf = Math.floor(0.005 * sr)
  for (let i = 0; i < nf; i++) a[n - 1 - i] = a[n - 1 - i]! * (i / nf)
  yield
  return [a]
}
