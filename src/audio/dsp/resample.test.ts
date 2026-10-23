import { describe, expect, it } from 'vitest'
import { REVERB } from '../params'
import { reverbIR } from './ir'
import { resample } from './resample'
import { runSync } from './task'

const sine = (f: number, sr: number, n: number): Float32Array =>
  Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * f * i) / sr))

/** 离开两头（核函数还没铺满的地方）后，与理想正弦的最大误差 */
function maxError(y: Float32Array, f: number, sr: number): number {
  let e = 0
  for (let j = 200; j < y.length - 200; j++)
    e = Math.max(e, Math.abs(y[j]! - Math.sin((2 * Math.PI * f * j) / sr)))
  return e
}

function rmsMiddle(y: Float32Array): number {
  let s = 0
  let n = 0
  for (let j = 200; j < y.length - 200; j++, n++) s += y[j]! * y[j]!
  return Math.sqrt(s / n)
}

/** 冲激响应在 f Hz 处的幅度（dB）：离散时间傅里叶变换，用旋转的相量免得每个采样都算三角函数 */
function responseDb(h: Float32Array, sr: number, f: number): number {
  const w = (2 * Math.PI * f) / sr
  const c = Math.cos(w)
  const s = Math.sin(w)
  let pr = 1
  let pi = 0
  let re = 0
  let im = 0
  for (let n = 0; n < h.length; n++) {
    re += h[n]! * pr
    im -= h[n]! * pi
    const t = pr * c - pi * s
    pi = pr * s + pi * c
    pr = t
  }
  return 10 * Math.log10(re * re + im * im)
}

describe('band-limited resampling', () => {
  it('keeps amplitude and phase of tones in the passband, both directions', () => {
    for (const [from, to] of [
      [48000, 44100],
      [48000, 96000],
      [48000, 16000],
    ] as const) {
      const top = 0.42 * Math.min(from, to)
      for (const f of [100, 1000, top / 2, top]) {
        const y = runSync(resample(sine(f, from, from / 4), from, to))
        expect(y.length).toBe(Math.floor(((from / 4) * to) / from))
        expect(maxError(y, f, to)).toBeLessThan(2e-4)
      }
    }
  })

  it('removes what would fold back below the new Nyquist frequency', () => {
    // 48 kHz 里 22.5–24 kHz 的成分换到 44.1 kHz 会折回 20–21.6 kHz
    for (const f of [22500, 23500]) {
      const y = runSync(resample(sine(f, 48000, 12000), 48000, 44100))
      expect(20 * Math.log10(rmsMiddle(y))).toBeLessThan(-75)
    }
  })
})

describe('reverb impulse response', () => {
  it.each([44100, 96000])(
    'has the same frequency response at %i Hz as at the rate the layer trims were calibrated on',
    sr => {
      const a = runSync(reverbIR(REVERB.rate, REVERB))
      const b = runSync(reverbIR(sr, REVERB))
      expect(b[0]!.length).toBe(Math.floor((a[0]!.length * sr) / REVERB.rate))
      // 持续音的音高（长音的和弦、五声、电钢琴的 D3–B5）和它们之间：长混响的频响在细处起伏很大，
      // 各处都要对上，不只是平均响度
      let worst = 0
      for (let f = 120; f < 4000; f *= 1.0473) {
        for (let c = 0; c < 2; c++) {
          const d = responseDb(b[c]!, sr, f) - responseDb(a[c]!, REVERB.rate, f)
          worst = Math.max(worst, Math.abs(d))
        }
      }
      expect(worst).toBeLessThan(0.05)
    },
  )
})
