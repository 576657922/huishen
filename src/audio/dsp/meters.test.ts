import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/lib/random'
import {
  bandEnergyDb,
  blockLoudness,
  integratedLoudness,
  loudnessRange,
  loudnessStats,
  maxRiseWithin,
  maxSwingWithin,
  truePeakDb,
} from './analysis'
import { createDynamics, type DynamicsParams } from './dynamics'
import { biquad } from './filters'
import { CENTER, createPeakDetector, PHASE_COEFS } from './oversample'
import { gainToDb } from './util'

const SR = 48000

/** 正弦，振幅按 dBFS（峰值）给出 */
function tone(f: number, dbfs: number, sec: number, phase = 0, sr = SR): Float32Array {
  const a = 10 ** (dbfs / 20)
  return Float32Array.from(
    { length: Math.round(sec * sr) },
    (_, i) => a * Math.sin((2 * Math.PI * f * i) / sr + phase),
  )
}

/** 依次拼接几段：[dBFS, 秒] */
function steps(f: number, parts: readonly (readonly [number, number])[]): Float32Array {
  const segs = parts.map(([db, sec]) => tone(f, db, sec))
  const out = new Float32Array(segs.reduce((n, s) => n + s.length, 0))
  let at = 0
  for (const s of segs) {
    out.set(s, at)
    at += s.length
  }
  return out
}

describe('BS.1770 loudness (EBU Tech 3341 reference signals)', () => {
  it('a mono 1 kHz sine at −20 dBFS reads −23.0 LUFS', () => {
    expect(integratedLoudness([tone(1000, -20, 10)], SR)).toBeCloseTo(-23, 1)
  })

  it.each([
    [-23, -23],
    [-33, -33],
  ])('stereo 1 kHz at %i dBFS reads %i LUFS', (db, lufs) => {
    const x = tone(1000, db, 20)
    expect(Math.abs(integratedLoudness([x, x], SR) - lufs)).toBeLessThan(0.1)
  })

  it('the 997 Hz stereo reference at −23 dBFS reads −23.0 LUFS at 44.1 and 48 kHz', () => {
    for (const sr of [44100, 48000]) {
      const x = tone(997, -23, 20, 0, sr)
      expect(Math.abs(integratedLoudness([x, x], sr) + 23)).toBeLessThan(0.1)
    }
  })

  it('gates quiet passages (cases 3 and 4)', () => {
    const c3 = steps(1000, [
      [-36, 10],
      [-23, 60],
      [-36, 10],
    ])
    expect(Math.abs(integratedLoudness([c3, c3], SR) + 23)).toBeLessThan(0.1)
    const c4 = steps(1000, [
      [-72, 10],
      [-36, 10],
      [-23, 60],
      [-36, 10],
      [-72, 10],
    ])
    expect(Math.abs(integratedLoudness([c4, c4], SR) + 23)).toBeLessThan(0.1)
  })

  it('reads the integrated level of alternating sections (case 5)', () => {
    const c5 = steps(1000, [
      [-26, 20],
      [-20, 20.1],
      [-26, 20],
    ])
    expect(Math.abs(integratedLoudness([c5, c5], SR) + 23)).toBeLessThan(0.1)
  })

  it('reports momentary and short-term levels of a steady tone', () => {
    const x = tone(1000, -23, 10)
    const s = loudnessStats([x, x], SR)
    expect(s.momentaryMax).toBeCloseTo(-23, 1)
    expect(s.shortTermMax).toBeCloseTo(-23, 1)
    expect(s.maxRise).toBeLessThan(0.05)
    // 3 秒窗，每 0.1 秒一个
    expect(blockLoudness([x], SR, 3, 0.1)).toHaveLength(71)
  })
})

describe('loudness range (EBU Tech 3342 reference signals)', () => {
  it.each([
    [[-20, -30], 10],
    [[-20, -15], 5],
    [[-40, -20], 20],
  ] as const)('%j reads %i LU', (levels, lra) => {
    const x = steps(
      1000,
      levels.map(db => [db, 20] as const),
    )
    expect(Math.abs(loudnessRange([x, x], SR) - lra)).toBeLessThan(1)
  })

  it('reads 15 LU for a rise and fall through −50/−35/−20 dBFS (case 4)', () => {
    const x = steps(1000, [
      [-50, 20],
      [-35, 20],
      [-20, 20],
      [-35, 20],
      [-50, 20],
    ])
    expect(Math.abs(loudnessRange([x, x], SR) - 15)).toBeLessThan(1)
  })

  it('measures the largest rise inside a window', () => {
    const xs = [-30, -29, -28, -27, -26, -25, -40, -32]
    expect(maxRiseWithin(xs, 1, 2)).toBeCloseTo(8, 6)
    expect(maxRiseWithin(xs.slice(0, 6), 1, 2)).toBeCloseTo(2, 6)
    expect(maxRiseWithin(xs.slice(0, 6), 1, 4)).toBeCloseTo(4, 6)
    // 低于 −70 的（静音）不算
    expect(maxRiseWithin([-80, -30], 1, 2)).toBe(0)
  })

  it('measures the largest swing inside a window, falls included', () => {
    const xs = [-30, -29, -28, -27, -26, -25, -40, -32]
    // 从 −25 跌到 −40 也算：升幅只看到 8，变化是 15
    expect(maxSwingWithin(xs, 1, 2)).toBeCloseTo(15, 6)
    expect(maxSwingWithin(xs.slice(0, 6), 1, 2)).toBeCloseTo(2, 6)
    expect(maxSwingWithin(xs.slice(0, 6), 1, 5)).toBeCloseTo(5, 6)
    expect(maxSwingWithin([-80, -30, -90, -31], 1, 3)).toBeCloseTo(1, 6)
    // 稳定的音：短期响度几乎不变
    const x = tone(1000, -23, 40)
    expect(loudnessStats([x, x], SR).maxSwing).toBeLessThan(0.05)
  })
})

describe('true peak (4× oversampling)', () => {
  it('each interpolation phase has unity gain at DC', () => {
    for (const h of PHASE_COEFS) expect(h.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9)
  })

  it.each([
    [997, 0],
    [3000, 0.3],
    [12000, Math.PI / 4],
    [16000, 0],
  ])('finds the peak of a %i Hz sine between samples', (f, phase) => {
    const x = tone(f, -6, 0.5, phase)
    // 避开突然开始、突然结束的两端：那里的插值本来就会过冲
    const tp = truePeakDb([x], 0.1 * SR, 0.4 * SR)
    expect(tp).toBeLessThan(-6 + 0.1)
    expect(tp).toBeGreaterThan(-6 - 0.3)
  })

  it('reads above the sample peak when the peak falls between samples', () => {
    // 12 kHz、相位 π/4：每个采样都只有峰值的 0.707 倍
    const x = tone(12000, 0, 0.2, Math.PI / 4)
    const samplePeak = gainToDb(Math.max(...x.map(Math.abs)))
    expect(samplePeak).toBeCloseTo(-3.01, 1)
    expect(truePeakDb([x], 0.05 * SR, 0.15 * SR)).toBeGreaterThan(-0.3)
  })

  it('the detector lags the input by CENTER samples', () => {
    const det = createPeakDetector()
    const out: number[] = []
    for (let i = 0; i < 40; i++) out.push(det(i === 10 ? 1 : 0))
    // 单位冲激：原采样相位在 10 + CENTER 处读到 1
    expect(out[10 + CENTER]).toBeCloseTo(1, 9)
  })
})

describe('band energy', () => {
  it('compares bands of a two-tone signal', () => {
    const a = tone(400, -10, 2)
    const b = tone(6000, -30, 2)
    const x = a.map((v, i) => v + b[i]!)
    const diff = bandEnergyDb([x], SR, 4000, SR / 2) - bandEnergyDb([x], SR, 200, 800)
    expect(diff).toBeCloseTo(-20, 0)
  })
})

const PARAMS: DynamicsParams = {
  threshold: -16,
  ratio: 2,
  knee: 6,
  attack: 0.03,
  release: 0.5,
  ceiling: -3,
  lookahead: 0.005,
  limitRelease: 0.15,
}

function run(chs: Float32Array[], p = PARAMS, block = 128): { out: Float32Array[]; latency: number } {
  const dyn = createDynamics(SR, 2, p)
  const n = chs[0]!.length
  const out = [new Float32Array(n), new Float32Array(n)]
  for (let s = 0; s < n; s += block) {
    const m = Math.min(block, n - s)
    const input = chs.map(c => c.subarray(s, s + m))
    const output = out.map(c => c.subarray(s, s + m))
    dyn.process(input, output, m)
  }
  return { out, latency: dyn.latency }
}

describe('output dynamics', () => {
  it('is transparent below threshold apart from the look-ahead delay', () => {
    const x = tone(1000, -20, 1)
    const { out, latency } = run([x, x])
    expect(latency).toBeGreaterThan(0.005 * SR)
    expect(latency).toBeLessThan(0.006 * SR)
    let err = 0
    for (let i = latency; i < x.length; i++) err = Math.max(err, Math.abs(out[0]![i]! - x[i - latency]!))
    expect(err).toBeLessThan(1e-7)
  })

  it('keeps the true peak under the ceiling for loud and spiky material', () => {
    const rng = mulberry32(7)
    const lp = biquad('lowpass', 9000, 0.7, SR)
    const noise = Float32Array.from({ length: SR * 2 }, () => 1.4 * lp(rng() * 2 - 1))
    const between = tone(12000, 0, 2, Math.PI / 4)
    const clicks = Float32Array.from({ length: SR * 2 }, (_, i) =>
      i % 4800 < 3 ? 0.95 : 0.01 * Math.sin(i / 9),
    )
    for (const x of [noise, between, clicks]) {
      const { out, latency } = run([x, x])
      expect(truePeakDb(out, latency)).toBeLessThanOrEqual(-3 + 0.05)
    }
  })

  it('compresses gently at 2:1 above the knee', () => {
    // RMS −6 dBFS，比阈值高 10 dB：稳定后衰减约 5 dB；峰值 −3 dBFS 以下，限幅不动作
    const x = tone(1000, -3.5, 3)
    const { out } = run([x, x])
    const tail = (a: Float32Array) => gainToDb(Math.max(...a.subarray(2 * SR).map(Math.abs)))
    const reduction = tail(x) - tail(out[0]!)
    expect(reduction).toBeGreaterThan(4.3)
    expect(reduction).toBeLessThan(5.3)
  })

  it('reports how hard it worked and never produces NaN', () => {
    const dyn = createDynamics(SR, 2, PARAMS)
    const silent = [new Float32Array(128), new Float32Array(128)]
    const out = [new Float32Array(128), new Float32Array(128)]
    for (let i = 0; i < 100; i++) dyn.process([], out, 128)
    expect(out[0]!.every(v => v === 0)).toBe(true)
    dyn.process(silent, out, 128)
    expect(dyn.takeStats()).toEqual({ compDb: 0, limitDb: 0 })
    const loud = [new Float32Array(128).fill(0.99), new Float32Array(128).fill(-0.99)]
    for (let i = 0; i < 20; i++) dyn.process(loud, out, 128)
    const stats = dyn.takeStats()
    expect(stats.limitDb).toBeGreaterThan(2)
    expect(out.every(c => c.every(Number.isFinite))).toBe(true)
  })

  it('copies a mono input to both outputs', () => {
    const x = tone(500, -20, 0.2)
    const dyn = createDynamics(SR, 2, PARAMS)
    const out = [new Float32Array(x.length), new Float32Array(x.length)]
    dyn.process([x], out, x.length)
    expect(out[1]).toEqual(out[0])
  })
})
