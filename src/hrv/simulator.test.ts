import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPattern, patternAt } from '@/engine/patterns'
import { sum } from '@/lib/math'
import { createBeatTracker } from './beats'
import { cleanBeats, hrSeries, rmssdOfBeats, summarizeHrv } from './metrics'
import { createSimulatedHeartRate, type SimulatorOptions, steadyBreathing, type VolumeFn } from './simulator'
import type { Beat, DisconnectInfo, HeartRateDevice, HeartRateMeasurement } from './types'

/** 心率带的 RR 分辨率是 1/1024 秒 */
const onStrapGrid = (rr: number) => Math.abs((rr * 1024) / 1000 - Math.round((rr * 1024) / 1000)) < 1e-6

/** 跟着引擎的节拍以 rate 次/分呼吸时的肺容量 */
function paced(rate: number): (t: number) => number {
  const pattern = buildPattern({ type: 'resonance', rate, ratio: 'equal' })
  return t => patternAt(pattern, t).y
}

/** 以 rate 次/分呼吸 duration 秒 */
function breathe(
  rate: number,
  duration: number,
  options: Parameters<typeof createSimulatedHeartRate>[0] = {},
) {
  const sim = createSimulatedHeartRate(options)
  sim.setBreathing(paced(rate))
  return sim.advance(duration)
}

/** 心率曲线相对肺容量的滞后（秒）：两者互相关最大处的位移；负数表示心率领先 */
function lagBehindBreath(beats: readonly Beat[], volume: (t: number) => number, from: number, to: number) {
  const hr = hrSeries(cleanBeats(beats).clean)
  const step = 0.05
  const grid: number[] = []
  let j = 1
  for (let t = from - 5; t <= to + 5; t += step) {
    while (j < hr.length - 1 && hr[j]!.t < t) j++
    const a = hr[j - 1]!
    const b = hr[j]!
    grid.push(a.hr + ((b.hr - a.hr) * (t - a.t)) / (b.t - a.t))
  }
  const hrAt = (t: number) => grid[Math.round((t - (from - 5)) / step)]!
  let best = Number.NEGATIVE_INFINITY
  let bestLag = 0
  for (let lag = -4; lag <= 4; lag += step) {
    let s = 0
    for (let t = from; t < to; t += 0.25) s += hrAt(t + lag) * (volume(t) - 0.5)
    if (s > best) {
      best = s
      bestLag = lag
    }
  }
  return bestLag
}

describe('simulated heart', () => {
  it('is reproducible for a seed and the same breathing', () => {
    expect(breathe(6, 120, { seed: 9 })).toEqual(breathe(6, 120, { seed: 9 }))
    expect(breathe(6, 120, { seed: 9 })).not.toEqual(breathe(6, 120, { seed: 10 }))
  })

  it('gives the same beats however time is advanced', () => {
    const sim = createSimulatedHeartRate({ seed: 3 })
    const pieces = [...sim.advance(30.02), ...sim.advance(61.7), ...sim.advance(120)]
    expect(pieces).toEqual(createSimulatedHeartRate({ seed: 3 }).advance(120))
  })

  it('beats around the resting rate with strap-like resolution', () => {
    const beats = createSimulatedHeartRate({ seed: 4, baseHr: 58 }).advance(300)
    const s = summarizeHrv(beats)
    expect(Math.abs(s.meanHr - 58)).toBeLessThan(4)
    expect(s.rmssd).toBeGreaterThan(5)
    expect(s.rmssd).toBeLessThan(80)
    expect(beats.every(b => onStrapGrid(b.rr))).toBe(true)
    expect(beats.every((b, i) => i === 0 || b.t > beats[i - 1]!.t)).toBe(true)
  })

  it('breathes steadily at a rate given as a number, in step with the engine pacer', () => {
    const run = (breathing: number | VolumeFn) => {
      const sim = createSimulatedHeartRate({ seed: 8, resonance: 6, artifacts: 0 })
      sim.setBreathing(breathing)
      return sim.advance(200)
    }
    const beats = run(6)
    expect(beats).toEqual(run(steadyBreathing(6)))
    expect(
      summarizeHrv(
        beats.filter(b => b.t > 40),
        { t0: 0, period: 10 },
      ).amplitude,
    ).toBeGreaterThan(14)
    for (const t of [0, 1.3, 2.5, 5, 7.7, 10, 123.4]) {
      expect(steadyBreathing(6)(t)).toBeCloseTo(paced(6)(t), 9)
    }
    const sim = createSimulatedHeartRate()
    expect(() => sim.setBreathing(0)).toThrow(RangeError)
    expect(() => sim.setBreathing(Number.NaN)).toThrow(RangeError)
  })

  it('rejects options the model cannot run with', () => {
    const bad: SimulatorOptions[] = [
      { resonance: 0 },
      { baseHr: Number.NaN },
      { baseHr: 250 },
      { rsa: -1 },
      { sharpness: 0 },
      { artifacts: 1.5 },
      { intervalMs: 0 },
    ]
    for (const options of bad) expect(() => createSimulatedHeartRate(options)).toThrow(RangeError)
  })

  it('swings most when breathing at the resonance rate', () => {
    for (const resonance of [5, 6]) {
      const amplitudes = [4.5, 5, 5.5, 6, 6.5].map(rate => {
        const beats = breathe(rate, 200, { resonance, seed: 4, artifacts: 0 }).filter(b => b.t > 40)
        return { rate, amplitude: summarizeHrv(beats, { t0: 0, period: 60 / rate }).amplitude }
      })
      const peak = amplitudes.reduce((a, b) => (b.amplitude > a.amplitude ? b : a))
      expect(peak.rate).toBe(resonance)
      // 共振时的峰谷差接近设定值 16 次/分
      expect(peak.amplitude).toBeGreaterThan(14)
      expect(peak.amplitude).toBeLessThan(20)
    }
    // 自然呼吸（每分钟 14 次左右）时起伏小得多
    const spontaneous = createSimulatedHeartRate({ seed: 4, artifacts: 0 }).advance(200)
    expect(summarizeHrv(spontaneous, { t0: 0, period: 60 / 14 }).amplitude).toBeLessThan(8)
  })

  it('keeps heart rate in phase with breathing at resonance, lagging above and leading below it', () => {
    const lag = (resonance: number, rate: number) =>
      lagBehindBreath(breathe(rate, 160, { resonance, seed: 6, artifacts: 0 }), paced(rate), 40, 150)
    const atResonance = lag(5.5, 5.5)
    // 心率记在每个间期结束的那一搏上，曲线本身就晚半个间期左右
    expect(atResonance).toBeGreaterThan(-0.5)
    expect(atResonance).toBeLessThan(1.2)
    expect(lag(4.5, 6.5)).toBeGreaterThan(atResonance + 1)
    expect(lag(6.5, 4.5)).toBeLessThan(atResonance - 1)
  })

  it('adds artifacts that cleaning takes out again', () => {
    const reference = rmssdOfBeats(createSimulatedHeartRate({ seed: 5, artifacts: 0 }).advance(600))
    const noisy = createSimulatedHeartRate({ seed: 5, artifacts: 0.05 }).advance(600)
    const { clean, rejected } = cleanBeats(noisy)
    expect(rejected / noisy.length).toBeGreaterThan(0.03)
    expect(rmssdOfBeats(noisy)).toBeGreaterThan(reference * 1.5)
    expect(Math.abs(rmssdOfBeats(clean) - reference) / reference).toBeLessThan(0.15)
  })
})

describe('simulated strap in real time', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('looks like a device: one reading per second with the new RR intervals', () => {
    vi.useFakeTimers()
    let now = 0
    const device: HeartRateDevice = createSimulatedHeartRate({ seed: 2, now: () => now })
    expect(device.name).toBe('模拟心率带')
    expect(device.connected).toBe(true)
    const got: HeartRateMeasurement[] = []
    const tracker = createBeatTracker()
    const off = device.onReading(m => {
      got.push(m)
      tracker.push(m, now)
    })
    for (let i = 0; i < 30; i++) {
      now += 1
      vi.advanceTimersByTime(1000)
    }
    expect(got).toHaveLength(30)
    expect(got.every(m => m.contact === 'detected' && m.hr > 40 && m.hr < 100)).toBe(true)
    const rr = got.flatMap(m => m.rr)
    expect(Math.abs(sum(rr) / 1000 - 30)).toBeLessThan(2)
    expect(tracker.beats()).toHaveLength(rr.length)

    off()
    vi.advanceTimersByTime(5000)
    expect(got).toHaveLength(30)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('disconnects and reconnects without replaying the missed beats', async () => {
    vi.useFakeTimers()
    let now = 0
    const sim = createSimulatedHeartRate({ seed: 2, now: () => now })
    const events: DisconnectInfo[] = []
    const got: HeartRateMeasurement[] = []
    sim.onDisconnect(info => events.push(info))
    sim.onReading(m => got.push(m))
    now += 1
    vi.advanceTimersByTime(1000)

    sim.disconnect()
    expect(sim.connected).toBe(false)
    expect(events).toEqual([{ requested: true }])
    now += 20
    vi.advanceTimersByTime(20000)
    expect(got).toHaveLength(1)

    await sim.reconnect()
    expect(sim.connected).toBe(true)
    now += 1
    vi.advanceTimersByTime(1000)
    expect(got).toHaveLength(2)
    expect(sum(got[1]!.rr)).toBeLessThan(2500)
  })

  it('starts no timer for offline use', () => {
    vi.useFakeTimers()
    createSimulatedHeartRate().advance(60)
    expect(vi.getTimerCount()).toBe(0)
  })

  /** 用练习时钟驱动的模拟心率带，每次收到测量也交给心搏追踪 */
  function live(options: SimulatorOptions = {}) {
    vi.useFakeTimers()
    const clock = { now: 0 }
    const sim = createSimulatedHeartRate({ seed: 2, now: () => clock.now, ...options })
    const got: HeartRateMeasurement[] = []
    const tracker = createBeatTracker()
    sim.onReading(m => {
      got.push(m)
      tracker.push(m, clock.now)
    })
    const seconds = (n: number) => {
      for (let i = 0; i < n; i++) {
        clock.now += 1
        vi.advanceTimersByTime(1000)
      }
    }
    return { sim, got, tracker, clock, seconds }
  }

  it('drops the link like a strap that went out of range', async () => {
    const { sim, got, seconds } = live()
    const events: DisconnectInfo[] = []
    sim.onDisconnect(info => events.push(info))
    seconds(3)
    sim.drop()
    sim.drop()
    expect(events).toEqual([{ requested: false }])
    expect(sim.connected).toBe(false)
    seconds(10)
    expect(got).toHaveLength(3)
    await sim.reconnect()
    seconds(2)
    expect(got).toHaveLength(5)
    expect(sum(got[3]!.rr)).toBeLessThan(2500)
  })

  it('reports lost skin contact without heart rate or RR, then picks up again', () => {
    const { sim, got, tracker, clock, seconds } = live()
    seconds(20)
    expect(tracker.status(clock.now)).toBe('good')
    sim.setContact(false)
    seconds(6)
    expect(got.slice(-6)).toEqual(Array(6).fill({ hr: 0, rr: [], contact: 'not-detected' }))
    expect(tracker.status(clock.now)).toBe('no-contact')
    const before = tracker.beats().length
    sim.setContact(true)
    seconds(10)
    expect(got.at(-1)).toMatchObject({ contact: 'detected' })
    expect(got.at(-1)!.hr).toBeGreaterThan(40)
    expect(tracker.status(clock.now)).toBe('good')
    // 没贴紧那几秒的心搏不补发，心搏序列里留下一个空档
    const beats = tracker.beats()
    expect(beats[before]!.t - beats[before - 1]!.t).toBeGreaterThan(5)
  })

  it('keeps beating at once when the practice clock starts over', () => {
    const { got, clock, seconds } = live()
    seconds(300)
    // 重新开始一次练习：时钟从倒数的 −3 秒起
    clock.now = -3
    const before = got.length
    seconds(10)
    const rr = got.slice(before).flatMap(m => m.rr)
    expect(sum(rr) / 1000).toBeGreaterThan(8)
    expect(sum(rr) / 1000).toBeLessThan(12)
    expect(rr.every(onStrapGrid)).toBe(true)
  })

  it('can play a band that sends heart rate without RR intervals', () => {
    const { got, tracker, clock, seconds } = live({ rrIntervals: false })
    seconds(6)
    expect(got.every(m => m.rr.length === 0 && m.hr > 40 && m.contact === 'detected')).toBe(true)
    expect(tracker.status(clock.now)).toBe('no-rr')
  })
})
