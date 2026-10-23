/**
 * 提示音的合成。全部是单声道、很短的单次音，生成后按瞬时响度归一，电平在 params.LEVELS 里统一控制。
 */
import type { Partial4 } from '../params'
import { t60ToTau } from './bell'
import type { Task } from './task'
import { due, fadeEdges, sineOsc } from './util'

export interface PingParams {
  attack: number
  partial: number
  partialGain: number
  glideTime: number
  tail: number
}

/**
 * 原型的提示音：8 ms 线性起音，主音按 dur/4 指数衰减，二次泛音（×2.01）按 dur/10 衰减。
 * glide 为音高在 glideTime 秒内指数滑到的比例（回神用，听起来像轻轻落下）。
 */
export function ping(sr: number, freq: number, dur: number, p: PingParams, glide = 1): Float32Array {
  const n = Math.floor((dur + p.tail) * sr)
  const a = new Float32Array(n)
  let ph = 0
  let ph2 = 0
  for (let i = 0; i < n; i++) {
    const t = i / sr
    const f = glide === 1 ? freq : freq * glide ** Math.min(1, t / p.glideTime)
    const env = t < p.attack ? t / p.attack : Math.exp(-(t - p.attack) / (dur / 4))
    const env2 = p.partialGain * Math.exp(-t / (dur / 10))
    a[i] = env * (Math.sin(ph) + env2 * Math.sin(ph2))
    ph += (2 * Math.PI * f) / sr
    ph2 += (2 * Math.PI * f * p.partial) / sr
  }
  return fadeEdges(a, sr, 0, 0.05)
}

/** 很轻的木质短音：1.5 ms 升余弦起音，主音加一个快速消失的 2.76 倍分音 */
export function tick(sr: number, freq: number, decay: number): Float32Array {
  const n = Math.floor((decay * 8 + 0.02) * sr)
  const a = new Float32Array(n)
  const o1 = sineOsc((2 * Math.PI * freq) / sr, 0)
  const o2 = sineOsc((2 * Math.PI * freq * 2.76) / sr, 0)
  for (let i = 0; i < n; i++) {
    const t = i / sr
    const atk = (1 - Math.cos(Math.PI * Math.min(1, t / 0.0015))) / 2
    a[i] = atk * Math.exp(-t / decay) * (o1() + 0.35 * Math.exp((-3 * t) / decay) * o2())
  }
  return fadeEdges(a, sr, 0, 0.01)
}

/** 两个音先后响起（数到第九口）：上行四度，像「完成」 */
export function pair(sr: number, freqs: readonly [number, number], gap: number, dur: number, p: PingParams) {
  const first = ping(sr, freqs[0], dur, p)
  const second = ping(sr, freqs[1], dur, p)
  const off = Math.floor(gap * sr)
  const a = new Float32Array(Math.max(first.length, off + second.length))
  a.set(first)
  for (let i = 0; i < second.length; i++) a[off + i] = a[off + i]! + second[i]!
  return a
}

/** 柔和的小钟（段落切换）：几个分音各自按 T60 衰减，第二分音带一点拍；尾巴留到最长分音衰减约 30 dB */
export function* chime(sr: number, freq: number, partials: readonly Partial4[]): Task<Float32Array> {
  const longest = Math.max(...partials.map(([, , t60]) => t60))
  const n = Math.floor(longest * 0.5 * sr)
  const a = new Float32Array(n)
  const na = Math.floor(0.003 * sr)
  for (const [ratio, amp, t60, beat] of partials) {
    const f = freq * ratio
    const o1 = sineOsc((2 * Math.PI * (f - beat / 2)) / sr, 0)
    const o2 = sineOsc((2 * Math.PI * (f + beat / 2)) / sr, 0)
    const kd = Math.exp(-1 / (t60ToTau(t60) * sr))
    let env = amp / 2
    for (let i = 0; i < n; i++) {
      const g = i < na ? (1 - Math.cos((Math.PI * i) / na)) / 2 : 1
      a[i] = a[i]! + env * g * (o1() + o2())
      env *= kd
      if (due(i)) yield
    }
  }
  return fadeEdges(a, sr, 0, 0.3)
}

/**
 * 软起音的短音（新的一句的轻提示）：升余弦起音 attack 秒，之后各谐波按 decay ÷ 倍数指数衰减，
 * 高的谐波先消失，听起来温暖、不刺；长度到基音衰减约 60 dB 为止，结尾再淡出 50 ms
 */
export function soft(
  sr: number,
  freq: number,
  attack: number,
  decay: number,
  partials: readonly (readonly [number, number])[],
): Float32Array {
  const n = Math.floor((attack + decay * 7) * sr)
  const a = new Float32Array(n)
  const parts = partials.map(([ratio, amp]) => ({
    osc: sineOsc((2 * Math.PI * freq * ratio) / sr, 0),
    amp,
    k: Math.exp(-ratio / (decay * sr)),
  }))
  const env = parts.map(p => p.amp)
  for (let i = 0; i < n; i++) {
    const t = i / sr
    const atk = t < attack ? (1 - Math.cos((Math.PI * t) / attack)) / 2 : 1
    let x = 0
    for (const [j, p] of parts.entries()) {
      x += (env[j] ?? 0) * p.osc()
      if (t >= attack) env[j] = (env[j] ?? 0) * p.k
    }
    a[i] = atk * x
  }
  return fadeEdges(a, sr, 0, 0.05)
}
