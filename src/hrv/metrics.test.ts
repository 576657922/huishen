import { describe, expect, it } from 'vitest'
import { buildPattern, warmupSec, withWarmup } from '@/engine/patterns'
import {
  artifactMask,
  cleanBeats,
  cleanRR,
  cycleAmplitudes,
  hrSeries,
  lfPower,
  meanHr,
  peakToTrough,
  rmssd,
  rmssdOfBeats,
  sdnn,
  summarizeHrv,
  typicalAmplitudes,
} from './metrics'
import type { Beat } from './types'

/** 由间期依次排出心搏时刻 */
function beatsOf(rr: readonly number[], t0 = 0): Beat[] {
  let t = t0
  return rr.map(x => {
    t += x / 1000
    return { t, rr: x }
  })
}

/** 间期按 rrAt(t) 连续变化：每一搏的间期取上一搏时刻的值 */
function beatsFromRr(rrAt: (t: number) => number, duration: number): Beat[] {
  const out: Beat[] = []
  for (let t = 0; t < duration; ) {
    const rr = rrAt(t)
    t += rr / 1000
    out.push({ t, rr })
  }
  return out
}

const sine = (mean: number, amp: number, hz: number) => (t: number) =>
  mean + amp * Math.sin(2 * Math.PI * hz * t)

describe('artifact rejection', () => {
  it('drops intervals outside 300–2000 ms', () => {
    expect(cleanRR([1000, 1000, 250, 1000, 2600, 1000])).toEqual({
      clean: [1000, 1000, 1000, 1000],
      rejected: 2,
    })
  })

  it('drops a beat more than 20% away from the median of its five neighbours', () => {
    expect(cleanRR([1000, 1010, 990, 1500, 1000, 1005, 995])).toEqual({
      clean: [1000, 1010, 990, 1000, 1005, 995],
      rejected: 1,
    })
  })

  it('drops both halves of an ectopic short–long pair and a missed beat', () => {
    const rr = [1000, 1000, 1000, 650, 1350, 1000, 1000, 1000, 2000, 1000, 1000]
    expect(artifactMask(rr)).toEqual([true, true, true, false, false, true, true, true, false, true, true])
  })

  it('drops both halves of a beat split by a false detection, even near the ends', () => {
    expect(cleanRR([900, 900, 900, 400, 500, 900, 900])).toEqual({
      clean: [900, 900, 900, 900, 900],
      rejected: 2,
    })
    expect(cleanRR([900, 400, 500, 900, 900, 900]).rejected).toBe(2)
  })

  it('copes with artifacts that come in clusters', () => {
    // 连着两次误检（322+359、441+267 各是被拆开的一搏）：第一遍里五搏有三个是伪迹，中位数被带偏，
    // 会留下 359、剔掉正常的 704；只拿正常心搏作参照再判一遍才对
    const rr = [672.9, 667.0, 322.3, 359.4, 704.1, 441.4, 266.6, 737.3, 765.6]
    expect(artifactMask(rr)).toEqual([true, true, false, false, true, false, false, true, true])
  })

  it('keeps the large smooth swings of resonance breathing', () => {
    // 心率在 52–92 次/分之间起伏，每轮 10 搏
    const rr = Array.from({ length: 60 }, (_, i) => 900 + 250 * Math.sin((2 * Math.PI * i) / 10))
    expect(cleanRR(rr).rejected).toBe(0)
  })

  it('only range-checks very short series', () => {
    expect(artifactMask([700, 1300])).toEqual([true, true])
    expect(artifactMask([])).toEqual([])
  })

  it('keeps beat times when cleaning beats', () => {
    const beats = beatsOf([1000, 1000, 1000, 2000, 1000, 1000])
    const { clean, rejected } = cleanBeats(beats)
    expect(rejected).toBe(1)
    expect(clean.map(b => b.t)).toEqual([1, 2, 3, 6, 7])
  })
})

describe('time-domain metrics', () => {
  it('computes RMSSD', () => {
    expect(rmssd([1000, 1010, 990, 1000])).toBeCloseTo(Math.sqrt(200), 10)
    expect(rmssd([1000])).toBeNaN()
  })

  it('computes SDNN as a sample standard deviation', () => {
    expect(sdnn([800, 900, 1000])).toBeCloseTo(100, 10)
    expect(sdnn([])).toBeNaN()
  })

  it('computes mean heart rate from total time, not by averaging beat rates', () => {
    expect(meanHr([1000, 1000])).toBe(60)
    expect(meanHr([500, 1000])).toBe(80)
    expect(meanHr([])).toBeNaN()
  })

  it('leaves the gap out of RMSSD after artifacts are removed', () => {
    const { clean } = cleanBeats(beatsOf([1000, 1010, 1000, 400, 600, 1000, 990, 1000]))
    expect(clean.map(b => b.rr)).toEqual([1000, 1010, 1000, 1000, 990, 1000])
    // 跨过空缺的那一对（1000 → 1000）不算，只算两侧各自相邻的差值
    expect(rmssdOfBeats(clean)).toBeCloseTo(Math.sqrt((100 + 100 + 100 + 100) / 4), 10)
    expect(rmssdOfBeats(clean.slice(0, 1))).toBeNaN()
  })
})

describe('heart rate oscillation', () => {
  it('turns intervals into instantaneous heart rate at the closing beat', () => {
    expect(
      hrSeries([
        { t: 1, rr: 1000 },
        { t: 1.75, rr: 750 },
      ]),
    ).toEqual([
      { t: 1, hr: 60 },
      { t: 1.75, hr: 80 },
    ])
  })

  it('measures peak-to-trough per breathing cycle', () => {
    const series = Array.from({ length: 241 }, (_, i) => {
      const t = i * 0.25
      return { t, hr: 70 + 5 * Math.sin((2 * Math.PI * t) / 10) }
    })
    const bounds = [0, 10, 20, 30, 40, 50, 60]
    expect(cycleAmplitudes(series, bounds).map(x => Math.round(x * 1e9) / 1e9)).toEqual([
      10, 10, 10, 10, 10, 10,
    ])
    expect(peakToTrough(series, bounds)).toBeCloseTo(10, 9)
  })

  it('leaves out a cycle whose swing is implausibly large', () => {
    expect(typicalAmplitudes([6, 5.5, 31, 6.5, 6, Number.NaN])).toEqual([6, 5.5, 6.5, 6])
    // 起伏本来就大时，高出一截不算离群；起伏很小时，翻倍但只高几次/分也不算
    expect(typicalAmplitudes([20, 22, 31, 21])).toEqual([20, 22, 31, 21])
    expect(typicalAmplitudes([3, 2.5, 8, 3.5])).toEqual([3, 2.5, 8, 3.5])
    // 不到三轮时看不出哪一轮离群
    expect(typicalAmplitudes([5, 40])).toEqual([5, 40])

    // 第四轮里有一个没剔掉的伪迹，心率冲到 150
    const series = Array.from({ length: 241 }, (_, i) => {
      const t = i * 0.25
      return { t, hr: t === 35 ? 150 : 70 + 5 * Math.sin((2 * Math.PI * t) / 10) }
    })
    const bounds = [0, 10, 20, 30, 40, 50, 60]
    expect(cycleAmplitudes(series, bounds)[3]).toBeGreaterThan(80)
    expect(peakToTrough(series, bounds)).toBeCloseTo(10, 9)
  })

  it('skips cycles with too few points or a large gap', () => {
    const series = [
      ...[0.5, 3, 5.5, 8, 9.5].map(t => ({ t, hr: 60 + t })),
      // 第二轮只有两个点
      { t: 12, hr: 70 },
      { t: 18, hr: 64 },
      // 第三轮中间空了 5 秒
      ...[20.5, 21.5, 22.5, 28, 29].map(t => ({ t, hr: 60 + (t % 3) })),
    ]
    const amps = cycleAmplitudes(series, [0, 10, 20, 30])
    expect(amps[0]).toBeCloseTo(9, 10)
    expect(amps[1]).toBeNaN()
    expect(amps[2]).toBeNaN()
    expect(peakToTrough(series, [0, 10, 20, 30])).toBeCloseTo(9, 10)
    expect(peakToTrough(series, [10, 20, 30])).toBeNaN()
  })
})

describe('LF power', () => {
  it('recovers the variance of a 0.1 Hz oscillation and its frequency', () => {
    const { power, peakHz } = lfPower(beatsFromRr(sine(1000, 50, 0.1), 300))
    // 正弦的方差为 50² / 2 = 1250 ms²；按心搏线性插值会让幅度在 0.1 Hz 处略减几个百分点
    expect(power).toBeGreaterThan(1250 * 0.9)
    expect(power).toBeLessThan(1250 * 1.02)
    expect(peakHz).toBeCloseTo(0.1, 3)
  })

  it('locates the breathing frequency within a two-minute trial', () => {
    for (const rate of [4.5, 5, 5.5, 6, 6.5]) {
      const beats = beatsFromRr(sine(950, 120, rate / 60), 100)
      expect(Math.abs(lfPower(beats).peakHz - rate / 60)).toBeLessThan(0.002)
    }
  })

  it('ignores oscillations outside the band', () => {
    const { power } = lfPower(beatsFromRr(sine(1000, 50, 0.25), 300))
    expect(power).toBeLessThan(1250 * 0.02)
  })

  it('removes a linear trend before the spectrum', () => {
    const flat = lfPower(beatsFromRr(sine(1000, 50, 0.1), 300)).power
    const drifting = lfPower(beatsFromRr(t => sine(1000, 50, 0.1)(t) + 0.5 * t, 300)).power
    expect(Math.abs(drifting - flat) / flat).toBeLessThan(0.03)
  })

  it('needs at least 50 seconds of data', () => {
    expect(lfPower(beatsFromRr(sine(1000, 50, 0.1), 45)).power).toBeNaN()
    expect(lfPower([]).peakHz).toBeNaN()
  })
})

describe('session summary', () => {
  it('summarizes a paced session', () => {
    // 心率 60 ± 5 次/分，10 秒一轮；按心搏取样，峰谷差略小于连续曲线的 10
    const beats = beatsFromRr(t => 60000 / (60 + 5 * Math.sin((2 * Math.PI * t) / 10)), 300)
    const s = summarizeHrv(beats, { t0: 0, period: 10 })
    expect(s.beats).toBe(beats.length)
    expect(s.artifactRate).toBe(0)
    expect(s.meanHr).toBeCloseTo(60, 0)
    expect(s.amplitude).toBeGreaterThan(9)
    expect(s.amplitude).toBeLessThanOrEqual(10.2)
    expect(s.rmssd).toBeGreaterThan(0)
    expect(s.sdnn).toBeGreaterThan(s.rmssd)
  })

  it('follows the engine pattern and leaves out the warm-up cycles', () => {
    // 目标 6 次/分（10 秒一轮），开头从 8 次/分逐步放慢；放慢阶段心率还没起伏，之后 60 ± 5
    const pattern = withWarmup(buildPattern({ type: 'resonance', rate: 6, ratio: 'equal' }))
    const lead = warmupSec(pattern)
    expect(lead).toBeGreaterThan(30)
    const hrAt = (t: number) => (t < lead ? 60 : 60 + 5 * Math.sin((2 * Math.PI * (t - lead)) / 10))
    const beats = beatsFromRr(t => 60000 / hrAt(t), lead + 200)
    const s = summarizeHrv(beats, { pattern })
    expect(s.amplitude).toBeGreaterThan(9)
    expect(s.amplitude).toBeLessThanOrEqual(10.2)
    // 按固定周期从第 0 秒切，会把放慢阶段也算进去
    expect(summarizeHrv(beats, { t0: 0, period: 10 }).amplitude).toBeLessThan(s.amplitude - 1)
    // 心搏用的时钟与练习时钟差一个固定偏移时，用 t0 对齐
    const later = beats.map(b => ({ ...b, t: b.t + 30 }))
    expect(summarizeHrv(later, { pattern, t0: 30 }).amplitude).toBeCloseTo(s.amplitude, 9)
  })

  it('accepts explicit cycle starts when the pace changed mid-session', () => {
    // 前 150 秒 10 秒一轮，之后 12 秒一轮
    const hrAt = (t: number) => 60 + 5 * Math.sin(2 * Math.PI * (t < 150 ? t / 10 : (t - 150) / 12))
    const beats = beatsFromRr(t => 60000 / hrAt(t), 294)
    const boundaries = [
      ...Array.from({ length: 15 }, (_, k) => 10 * k),
      ...Array.from({ length: 13 }, (_, k) => 150 + 12 * k),
    ]
    const s = summarizeHrv(beats, { boundaries })
    expect(s.amplitude).toBeGreaterThan(9)
    expect(s.amplitude).toBeLessThanOrEqual(10.2)
  })

  it('has no amplitude without pacing, and copes with no data', () => {
    expect(summarizeHrv(beatsOf([1000, 1000, 1000])).amplitude).toBeNaN()
    const empty = summarizeHrv([])
    expect(empty.beats).toBe(0)
    expect(empty.artifactRate).toBe(0)
    expect(empty.meanHr).toBeNaN()
  })
})
