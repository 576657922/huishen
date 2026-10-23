/**
 * 海浪的两层素材（移植自原型）：底噪是粉红加布朗噪声，浪花是高频白噪声。
 * 浪的起伏不烤进素材，而是实时用滤波和增益做出来，这样才能跟着呼吸走。
 */
import { mulberry32 } from '@/lib/random'
import { biquad } from './filters'
import { brownFilter, pinkFilter } from './noise'
import type { Task } from './task'
import { type Channels, due } from './util'

export function* oceanBed(sr: number, n: number, seed: number): Task<Channels> {
  const out: Channels = []
  for (let c = 0; c < 2; c++) {
    const rng = mulberry32(seed + c * 31337)
    const hp = biquad('highpass', 35, 0.7, sr)
    const pink = pinkFilter()
    const brown = brownFilter()
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const w = rng() * 2 - 1
      a[i] = hp(pink(w) * 0.6 + brown(w) * 3.2)
      if (due(i)) yield
    }
    out.push(a)
  }
  return out
}

export function* oceanFoam(sr: number, n: number, seed: number, hpHz: number, lpHz: number): Task<Channels> {
  const out: Channels = []
  for (let c = 0; c < 2; c++) {
    const rng = mulberry32(seed + c * 101)
    const hp = biquad('highpass', hpHz, 0.7, sr)
    const lp = biquad('lowpass', lpHz, 0.7, sr)
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      a[i] = lp(hp(rng() * 2 - 1))
      if (due(i)) yield
    }
    out.push(a)
  }
  return out
}
