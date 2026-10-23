/**
 * 颂钵（移植自原型并改良）：5 个非谐波分音，每个分音是两个略微失谐的模态，形成缓慢的拍；
 * 基音 T60 约 11 秒，高分音衰减得快一些。软槌起音（几毫秒升余弦，加一点低通噪声的槌声），不像金属硬击那样刺耳；
 * 最后整体低通在 4 kHz，高处只剩一点光泽。音色只是审美选择，不作任何健康声明。
 */
import { mulberry32 } from '@/lib/random'
import type { Partial4 } from '../params'
import { biquad, filterInPlace } from './filters'
import type { Task } from './task'
import { type Channels, due, sineOsc } from './util'

export interface BowlParams {
  seconds: number
  seed: number
  f0: number
  partials: readonly Partial4[]
  attack: number
  attackHigh: number
  malletCutoff: number
  malletDecay: number
  malletLevel: number
  lowpass: number
  fadeStart: number
}

/** T60（衰减 60 dB 的秒数）换算成指数衰减的时间常数 */
export const t60ToTau = (t60: number): number => t60 / Math.log(1000)

export function* singingBowl(sr: number, p: BowlParams): Task<Channels> {
  const n = Math.floor(p.seconds * sr)
  const out: Channels = []
  for (let c = 0; c < 2; c++) {
    // 两个声道的拍相位不同：余音在左右之间缓慢游移
    const rng = mulberry32(p.seed + c)
    const a = new Float32Array(n)
    for (let k = 0; k < p.partials.length; k++) {
      const [ratio, amp, t60, beat] = p.partials[k]!
      const f = p.f0 * ratio
      const ph = rng() * 2 * Math.PI
      // 敲击瞬间两个模态几乎同相，起音饱满，之后按拍频慢慢错开
      const ph2 = ph + (rng() - 0.5) * 1.2
      const o1 = sineOsc((2 * Math.PI * (f - beat / 2)) / sr, ph)
      const o2 = sineOsc((2 * Math.PI * (f + beat / 2)) / sr, ph2)
      const kd = Math.exp(-1 / (t60ToTau(t60) * sr))
      const na = Math.max(1, Math.floor((k === 0 ? p.attack : p.attackHigh) * sr))
      let env = amp * 0.5
      for (let i = 0; i < n; i++) {
        const g = i < na ? (1 - Math.cos((Math.PI * i) / na)) / 2 : 1
        a[i] = a[i]! + env * g * (o1() + o2())
        env *= kd
        if (due(i)) yield
      }
    }
    const lp = biquad('lowpass', p.malletCutoff, 0.7, sr)
    const m = Math.min(n, Math.floor(0.06 * sr))
    for (let i = 0; i < m; i++) {
      const t = i / sr
      const g = (1 - Math.exp(-t / 0.0015)) * Math.exp(-t / p.malletDecay)
      a[i] = a[i]! + lp(rng() * 2 - 1) * p.malletLevel * g
    }
    yield* filterInPlace(a, biquad('lowpass', p.lowpass, 0.7, sr))
    out.push(a)
  }
  const f0 = Math.floor(p.fadeStart * sr)
  for (const a of out) {
    for (let i = f0; i < n; i++) a[i] = a[i]! * ((1 + Math.cos((Math.PI * (i - f0)) / (n - f0))) / 2)
  }
  return out
}
