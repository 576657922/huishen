import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/lib/random'
import { createBeatTracker } from './beats'
import type { HeartRateMeasurement, SensorContact } from './types'

const reading = (rr: number[], contact: SensorContact = 'detected', hr = 70): HeartRateMeasurement => ({
  hr,
  rr,
  contact,
})

/**
 * 模拟心率带的通知：真实心搏每 800 ms 一次，心率带每秒发出这一秒里完成的 RR，
 * 手机在 latency(n) 秒后收到。skip 里的通知丢失。
 */
function stream(seconds: number, latency: (n: number) => number, skip: ReadonlySet<number> = new Set()) {
  const truth = Array.from({ length: Math.floor(seconds / 0.8) }, (_, k) => 0.8 * (k + 1))
  const packets: { at: number; rr: number[]; beats: number[] }[] = []
  for (let n = 1; n <= seconds; n++) {
    const beats = truth.filter(t => t > n - 1 + 1e-9 && t <= n + 1e-9)
    if (!skip.has(n)) packets.push({ at: n + latency(n), rr: beats.map(() => 800), beats })
  }
  return packets
}

describe('beat tracker', () => {
  it('times beats by summing RR, so arrival jitter does not leak in', () => {
    const rand = mulberry32(3)
    const tracker = createBeatTracker()
    const truth: number[] = []
    for (const p of stream(60, () => 0.02 + 0.08 * rand())) {
      tracker.push(reading(p.rr), p.at)
      truth.push(...p.beats)
    }
    const beats = tracker.beats()
    expect(beats).toHaveLength(truth.length)
    for (let i = 1; i < beats.length; i++) expect(beats[i]!.t - beats[i - 1]!.t).toBeCloseTo(0.8, 9)
    // 与真实时刻只差一个固定的偏移，不超过一次通知间隔加延迟
    const offset = beats[0]!.t - truth[0]!
    expect(offset).toBeGreaterThanOrEqual(0)
    expect(offset).toBeLessThan(1.1)
    for (const [i, b] of beats.entries()) expect(b.t - truth[i]!).toBeCloseTo(offset, 9)
  })

  it('realigns to arrival time after lost notifications', () => {
    const tracker = createBeatTracker()
    const packets = stream(40, () => 0.05, new Set([20, 21, 22, 23]))
    for (const p of packets) tracker.push(reading(p.rr), p.at)
    const beats = tracker.beats()
    const jump = beats.findIndex((b, i) => i > 0 && b.t - beats[i - 1]!.t > 1.5)
    expect(jump).toBeGreaterThan(0)
    // 丢失之后的第一搏重新贴近真实时刻
    const resumed = packets.find(p => p.at > 24)!.beats[0]!
    expect(beats[jump]!.t - resumed).toBeGreaterThanOrEqual(0)
    expect(beats[jump]!.t - resumed).toBeLessThan(1.1)
    expect(beats.slice(jump).every((b, i, xs) => i === 0 || Math.abs(b.t - xs[i - 1]!.t - 0.8) < 1e-9)).toBe(
      true,
    )
  })

  it('discards RR while the strap has no skin contact, then realigns', () => {
    const tracker = createBeatTracker()
    expect(tracker.push(reading([800]), 10)).toHaveLength(1)
    expect(tracker.push(reading([800], 'not-detected'), 11)).toEqual([])
    const [beat] = tracker.push(reading([800]), 30)
    expect(beat?.t).toBeCloseTo(30, 9)
  })

  it('keeps beat times increasing when the caller clock jumps back', () => {
    const tracker = createBeatTracker()
    tracker.push(reading([800, 800]), 100)
    expect(tracker.push(reading([800, 800]), 50)).toEqual([])
    const fresh = tracker.push(reading([800, 800]), 100.9)
    expect(fresh.every(b => b.t > 100)).toBe(true)
    const ts = tracker.beats().map(b => b.t)
    expect([...ts].sort((a, b) => a - b)).toEqual(ts)
  })

  it('absorbs a corrupt RR value without pushing later beats out of place', () => {
    const tracker = createBeatTracker()
    for (let s = 1; s <= 40; s++) {
      // 第 10 秒的通知里夹了一个读坏的值（约 64 秒）
      tracker.push(reading(s === 10 ? [63999, 1000] : [1000]), s)
    }
    const normal = tracker.beats().filter(b => b.rr === 1000)
    expect(normal).toHaveLength(40)
    for (const [i, b] of normal.entries()) expect(b.t).toBeCloseTo(i + 1, 9)
  })

  it('ignores non-positive or non-finite intervals', () => {
    const tracker = createBeatTracker()
    expect(tracker.push(reading([0, Number.NaN, 800]), 5)).toEqual([{ t: 5, rr: 800 }])
    expect(tracker.push(reading([800]), Number.NaN)).toEqual([])
  })

  it('tells whether the device sends RR intervals', () => {
    const tracker = createBeatTracker()
    expect(tracker.rrSupported()).toBeNull()
    for (let i = 0; i < 4; i++) tracker.push(reading([]), i)
    expect(tracker.rrSupported()).toBeNull()
    // 没贴紧时的读数不算数
    tracker.push(reading([], 'not-detected'), 4)
    expect(tracker.rrSupported()).toBeNull()
    tracker.push(reading([]), 5)
    expect(tracker.rrSupported()).toBe(false)
    tracker.push(reading([900]), 6)
    expect(tracker.rrSupported()).toBe(true)
  })

  it('gives a new array whenever beats arrive, and resets', () => {
    const tracker = createBeatTracker()
    const before = tracker.beats()
    tracker.push(reading([]), 1)
    expect(tracker.beats()).toBe(before)
    tracker.push(reading([800]), 2)
    expect(tracker.beats()).not.toBe(before)
    tracker.reset()
    expect(tracker.beats()).toEqual([])
    expect(tracker.rrSupported()).toBeNull()
    expect(tracker.status(0)).toBe('waiting')
    expect(tracker.push(reading([800]), 0)[0]?.t).toBe(0)
  })
})

describe('signal status', () => {
  /** 每搏一条通知，收到的时刻就是这一搏的时刻 */
  function feed(tracker: ReturnType<typeof createBeatTracker>, rr: readonly number[], from: number): number {
    let t = from
    for (const x of rr) {
      t += x / 1000
      tracker.push(reading([x]), t)
    }
    return t
  }

  it('waits for the first beats, then reports a good signal', () => {
    const tracker = createBeatTracker()
    expect(tracker.status(0)).toBe('waiting')
    tracker.push(reading([]), 1)
    expect(tracker.status(1)).toBe('waiting')
    const t = feed(tracker, Array(20).fill(1000), 1)
    expect(tracker.status(t)).toBe('good')
  })

  it('reports lost skin contact, then a stale signal until beats resume', () => {
    const tracker = createBeatTracker()
    feed(tracker, Array(20).fill(1000), 0)
    tracker.push(reading([], 'not-detected'), 21)
    expect(tracker.status(21)).toBe('no-contact')
    tracker.push(reading([]), 27)
    expect(tracker.status(27)).toBe('stale')
    tracker.push(reading([1000]), 28)
    expect(tracker.status(28)).toBe('good')
  })

  it('tolerates one ectopic beat but reports a signal full of artifacts as unstable', () => {
    const tracker = createBeatTracker()
    const normal = Array(20).fill(1000)
    let t = feed(tracker, normal, 0)
    // 一次早搏：一短一长两搏被剔除
    t = feed(tracker, [1000, 1000, 600, 1400, 1000, 1000], t)
    expect(tracker.status(t)).toBe('good')
    // 再漏检一搏（间期翻倍）
    t = feed(tracker, [2000, 1000, 1000], t)
    expect(tracker.status(t)).toBe('unstable')
    t = feed(tracker, normal, t)
    expect(tracker.status(t)).toBe('good')
  })

  it('reports a device that sends heart rate without RR intervals', () => {
    const tracker = createBeatTracker()
    for (let s = 1; s <= 5; s++) tracker.push(reading([]), s)
    expect(tracker.status(5)).toBe('no-rr')
  })
})
