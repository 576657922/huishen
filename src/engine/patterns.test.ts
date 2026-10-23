import { describe, expect, it } from 'vitest'
import type { PacedParams } from '@/content/types'
import { sum } from '@/lib/math'
import {
  atRate,
  buildPattern,
  completedCycles,
  cycleAt,
  cyclesOf,
  describePattern,
  ease,
  HOLD_HINT,
  LONG_EXHALE_INHALE_FRACTION,
  patternAt,
  SIGH_DEFAULT_CYCLE,
  SIGH_IN_LEVEL,
  WARMUP_CYCLES_PER_STEP,
  WARMUP_START_RATE,
  warmupSec,
  withWarmup,
} from './patterns'
import type { BreathPattern } from './types'

const SIGH: PacedParams = { type: 'sigh', cycle: 10.5 }
const RESONANCE: PacedParams = { type: 'resonance', rate: 5.5, ratio: 'equal' }
const BOX: PacedParams = { type: 'phases', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 }

const ALL_PARAMS: PacedParams[] = [
  SIGH,
  { type: 'sigh', cycle: 6 },
  { type: 'sigh', cycle: 20 },
  RESONANCE,
  { type: 'resonance', rate: 6, ratio: 'long' },
  { type: 'resonance', rate: 3, ratio: 'equal' },
  { type: 'resonance', rate: 10, ratio: 'long' },
  BOX,
  { type: 'phases', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
  { type: 'phases', inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 },
  { type: 'phases', inhale: 0.5, holdIn: 20, exhale: 20, holdOut: 20 },
]

describe('buildPattern', () => {
  it('splits a cyclic sigh into two inhales and a long exhale', () => {
    const p = buildPattern(SIGH)
    expect(SIGH_DEFAULT_CYCLE).toBe(10.5)
    expect(p.T).toBe(10.5)
    expect(p.rate).toBeCloseTo(60 / 10.5, 12)
    expect(p.type).toBe('sigh')
    expect(p.segs.map(s => s.key)).toEqual(['in', 'in2', 'out'])
    // 默认一轮恰好分成 2.5、1、7 秒，不带浮点误差
    expect(p.segs.map(s => s.dur)).toEqual([2.5, 1, 7])
    expect(p.segs.map(s => s.t0)).toEqual([0, 2.5, 3.5])
    expect(p.segs.map(s => [s.y0, s.y1])).toEqual([
      [0, SIGH_IN_LEVEL],
      [SIGH_IN_LEVEL, 1],
      [1, 0],
    ])
    expect(SIGH_IN_LEVEL).toBe(0.78)
    expect(p.segs.map(s => s.ease)).toEqual(['inout', 'out', 'inout'])
    expect(p.segs.map(s => s.label)).toEqual(['吸', '再吸', '呼'])
    expect(p.segs.map(s => s.hint)).toEqual([
      '用鼻子慢慢吸气，吸到舒服的满',
      '不呼气，鼻子再补一小口',
      '用嘴慢慢呼，呼得长一些',
    ])
  })

  it('keeps the 2.5 : 1 : 7 proportions for other cycle lengths', () => {
    for (const cycle of [6, 8, 10, 14, 20]) {
      const p = buildPattern({ type: 'sigh', cycle })
      expect(p.T).toBe(cycle)
      const [a, b, c] = p.segs.map(s => s.dur)
      expect(a).toBeCloseTo((cycle * 2.5) / 10.5, 12)
      expect(b).toBeCloseTo((cycle * 1) / 10.5, 12)
      expect(c).toBeCloseTo((cycle * 7) / 10.5, 12)
    }
  })

  it('makes slow breathing equal or 4.5 : 6.5', () => {
    const eq = buildPattern(RESONANCE)
    expect(eq.rate).toBe(5.5)
    expect(eq.type).toBe('resonance')
    expect(eq.T).toBeCloseTo(60 / 5.5, 12)
    expect(eq.segs.map(s => s.key)).toEqual(['in', 'out'])
    expect(eq.segs[0]?.dur).toBeCloseTo(eq.T / 2, 12)
    expect(eq.segs[1]?.dur).toBeCloseTo(eq.T / 2, 12)

    // PRODUCT §2：默认每分钟 5.5 次，吸 4.5 秒、呼 6.5 秒
    expect(LONG_EXHALE_INHALE_FRACTION).toBeCloseTo(4.5 / 11, 15)
    const slow = buildPattern({ type: 'resonance', rate: 5.5, ratio: 'long' })
    expect(slow.T).toBeCloseTo(60 / 5.5, 12)
    expect(slow.segs[0]?.dur).toBeCloseTo((60 / 5.5) * (4.5 / 11), 12)
    expect(slow.segs[1]?.dur).toBeCloseTo((60 / 5.5) * (6.5 / 11), 12)
    // 慢呼吸的提示里不说「深吸」
    for (const s of slow.segs) expect(s.hint).not.toContain('深')

    const long = buildPattern({ type: 'resonance', rate: 6, ratio: 'long' })
    expect(long.T).toBe(10)
    expect(long.segs[0]?.dur).toBeCloseTo(10 * LONG_EXHALE_INHALE_FRACTION, 12)
    expect(long.segs[1]?.dur).toBeCloseTo(10 * (1 - LONG_EXHALE_INHALE_FRACTION), 12)
  })

  it('builds fixed phases and omits zero-length holds', () => {
    const box = buildPattern(BOX)
    expect(box.T).toBe(16)
    expect(box.rate).toBe(3.75)
    expect(box.segs.map(s => [s.key, s.label, s.ease])).toEqual([
      ['in', '吸', 'inout'],
      ['hold', '停', 'flat'],
      ['out', '呼', 'inout'],
      ['rest', '停', 'flat'],
    ])
    expect(box.type).toBe('phases')
    // 两处停顿都提醒放松喉咙：憋着劲停住会让人更紧张
    expect(HOLD_HINT).toBe('停顿时喉咙放松，不要憋劲')
    expect(box.segs.map(s => s.hint)).toEqual(['用鼻子吸气', HOLD_HINT, '慢慢呼出', HOLD_HINT])
    const noHolds = buildPattern({ type: 'phases', inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 })
    expect(noHolds.segs.map(s => s.key)).toEqual(['in', 'out'])
    const fourSevenEight = buildPattern({ type: 'phases', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 })
    expect(fourSevenEight.segs.map(s => s.key)).toEqual(['in', 'hold', 'out'])
    expect(fourSevenEight.T).toBe(19)
  })

  it.each(ALL_PARAMS)('keeps segments contiguous and summing to one cycle: %o', params => {
    const p = buildPattern(params)
    expect(sum(p.segs.map(s => s.dur))).toBeCloseTo(p.T, 9)
    expect(p.rate).toBeCloseTo(60 / p.T, 9)
    let t0 = 0
    for (const s of p.segs) {
      expect(s.dur).toBeGreaterThan(0)
      expect(s.t0).toBeCloseTo(t0, 9)
      t0 += s.dur
    }
    // 吸满之后才呼，一轮首尾都是呼空
    expect(p.segs[0]?.y0).toBe(0)
    expect(p.segs.at(-1)?.y1).toBe(0)
  })

  it.each<[string, PacedParams]>([
    ['cycle too short', { type: 'sigh', cycle: 5.9 }],
    ['cycle too long', { type: 'sigh', cycle: 20.1 }],
    ['cycle NaN', { type: 'sigh', cycle: Number.NaN }],
    ['rate too low', { type: 'resonance', rate: 2.9, ratio: 'equal' }],
    ['rate too high', { type: 'resonance', rate: 10.1, ratio: 'long' }],
    ['rate infinite', { type: 'resonance', rate: Number.POSITIVE_INFINITY, ratio: 'equal' }],
    ['no inhale', { type: 'phases', inhale: 0, holdIn: 4, exhale: 4, holdOut: 4 }],
    ['no exhale', { type: 'phases', inhale: 4, holdIn: 4, exhale: 0, holdOut: 4 }],
    ['negative hold', { type: 'phases', inhale: 4, holdIn: -1, exhale: 4, holdOut: 0 }],
    ['hold too long', { type: 'phases', inhale: 4, holdIn: 0, exhale: 4, holdOut: 20.5 }],
    ['exhale too long', { type: 'phases', inhale: 4, holdIn: 0, exhale: 21, holdOut: 0 }],
  ])('rejects %s', (_, params) => {
    expect(() => buildPattern(params)).toThrow(RangeError)
  })
})

describe('patternAt', () => {
  const sigh = buildPattern(SIGH)

  it('reports the countdown before the start', () => {
    expect(patternAt(sigh, -2.5)).toEqual({ y: 0, seg: null, idx: -1, rem: 2.5, progress: 0, cycle: -1 })
    expect(patternAt(sigh, Number.NaN).idx).toBe(-1)
  })

  it('locates segments, progress and remaining time', () => {
    const start = patternAt(sigh, 0)
    expect(start).toMatchObject({ idx: 0, y: 0, progress: 0, cycle: 0 })
    expect(start.rem).toBeCloseTo(2.5, 12)

    const midIn = patternAt(sigh, 1.25)
    expect(midIn.idx).toBe(0)
    expect(midIn.progress).toBeCloseTo(0.5, 12)
    expect(midIn.y).toBeCloseTo(0.39, 12)

    const midIn2 = patternAt(sigh, 3)
    expect(midIn2.seg?.key).toBe('in2')
    expect(midIn2.y).toBeCloseTo(0.78 + 0.22 * Math.sin(Math.PI / 4), 12)

    const out = patternAt(sigh, 2 * 10.5 + 5.3)
    expect(out).toMatchObject({ idx: 2, cycle: 2 })
    expect(out.rem).toBeCloseTo(10.5 - 5.3, 9)
  })

  it('holds still during flat phases', () => {
    const box = buildPattern(BOX)
    for (const t of [4, 5, 7.99]) expect(patternAt(box, t)).toMatchObject({ y: 1, idx: 1 })
    for (const t of [12, 13.5, 15.99]) expect(patternAt(box, t)).toMatchObject({ y: 0, idx: 3 })
  })

  it.each(ALL_PARAMS)('is continuous, bounded and self-consistent: %o', params => {
    const p: BreathPattern = buildPattern(params)
    let prevY = 0
    // 步长取最短一段的 1/50，最陡的缓动每步也只走约 0.03
    const step = Math.min(...p.segs.map(s => s.dur)) / 50
    for (let t = 0; t < p.T * 3; t += step) {
      const pt = patternAt(p, t)
      const seg = pt.seg
      expect(seg).not.toBeNull()
      if (!seg) return
      expect(pt.y).toBeGreaterThanOrEqual(0)
      expect(pt.y).toBeLessThanOrEqual(1)
      expect(pt.progress).toBeGreaterThanOrEqual(0)
      expect(pt.progress).toBeLessThanOrEqual(1)
      expect(pt.cycle).toBe(Math.floor(t / p.T))
      // 段内位置 + 剩余 = 段长
      expect(pt.progress * seg.dur + pt.rem).toBeCloseTo(seg.dur, 9)
      // 画面上的曲线不能跳
      expect(Math.abs(pt.y - prevY)).toBeLessThan(0.05)
      prevY = pt.y
    }
  })

  it('stays aligned over a long session despite floating point', () => {
    const p = buildPattern(RESONANCE)
    for (let k = 1; k < 500; k++) {
      const pt = patternAt(p, k * p.T + 1e-6)
      expect(pt.cycle).toBe(k)
      expect(pt.idx).toBe(0)
    }
  })
})

describe('describePattern', () => {
  it.each<[PacedParams, string]>([
    [SIGH, '鼻吸 2.5 秒 → 再吸 1 秒 → 嘴呼 7 秒 · 每分钟 5.7 轮'],
    [{ type: 'sigh', cycle: 10 }, '鼻吸 2.4 秒 → 再吸 1 秒 → 嘴呼 6.7 秒 · 每分钟 6 轮'],
    [{ type: 'sigh', cycle: 8 }, '鼻吸 1.9 秒 → 再吸 0.8 秒 → 嘴呼 5.3 秒 · 每分钟 7.5 轮'],
    [RESONANCE, '吸 5.5 秒，呼 5.5 秒 · 每分钟 5.5 次'],
    [{ type: 'resonance', rate: 5.5, ratio: 'long' }, '吸 4.5 秒，呼 6.5 秒 · 每分钟 5.5 次'],
    [{ type: 'resonance', rate: 6, ratio: 'long' }, '吸 4 秒，呼 6 秒 · 每分钟 6 次'],
    [{ type: 'resonance', rate: 6.5, ratio: 'equal' }, '吸 4.5 秒，呼 4.5 秒 · 每分钟 6.5 次'],
    [{ type: 'resonance', rate: 4.5, ratio: 'long' }, '吸 5.5 秒，呼 8 秒 · 每分钟 4.5 次'],
    [BOX, '吸 4 · 停 4 · 呼 4 · 停 4'],
    [{ type: 'phases', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 }, '吸 4 · 停 7 · 呼 8'],
    [{ type: 'phases', inhale: 4, holdIn: 0, exhale: 8, holdOut: 0 }, '吸 4 · 呼 8'],
  ])('%o → %s', (params, text) => {
    expect(describePattern(params)).toBe(text)
  })

  it('rejects the same inputs as buildPattern', () => {
    expect(() => describePattern({ type: 'resonance', rate: 11, ratio: 'equal' })).toThrow(RangeError)
  })
})

describe('ease', () => {
  it('maps the curve kinds', () => {
    expect(ease('inout', 0)).toBe(0)
    expect(ease('inout', 1)).toBe(1)
    expect(ease('inout', 0.5)).toBeCloseTo(0.5, 12)
    expect(ease('out', 0.5)).toBeCloseTo(Math.SQRT1_2, 12)
    expect(ease('linear', 1.5)).toBe(1)
    expect(ease('flat', 0.7)).toBe(0)
  })
})

describe('withWarmup', () => {
  const slow = buildPattern({ type: 'resonance', rate: 5.5, ratio: 'long' })
  const warm = withWarmup(slow)
  const cycles = warm.warmup ?? []

  it('slows from 8 per minute by 0.5 every two cycles until the target', () => {
    expect(cycles.map(c => c.rate)).toEqual([8, 8, 7.5, 7.5, 7, 7, 6.5, 6.5, 6, 6])
    for (const c of cycles) {
      expect(c.T).toBeCloseTo(60 / c.rate, 12)
      // 吸呼比例与目标节拍相同
      expect(c.segs.map(s => s.dur / c.T)).toEqual(slow.segs.map(s => expect.closeTo(s.dur / slow.T, 12)))
      expect(c.segs.map(s => [s.key, s.label, s.hint])).toEqual(slow.segs.map(s => [s.key, s.label, s.hint]))
      expect(sum(c.segs.map(s => s.dur))).toBeCloseTo(c.T, 12)
    }
    // PRODUCT §2：开头约 90 秒逐步放慢
    expect(warmupSec(warm)).toBeCloseTo(2 * 60 * (1 / 8 + 1 / 7.5 + 1 / 7 + 1 / 6.5 + 1 / 6), 9)
    expect(warmupSec(warm)).toBeGreaterThan(80)
    expect(warmupSec(warm)).toBeLessThan(95)
    expect(warm).toMatchObject({ T: slow.T, rate: slow.rate, segs: slow.segs })
  })

  it('stops above targets that are off the half-step grid', () => {
    const rates = withWarmup(buildPattern({ type: 'resonance', rate: 5.8, ratio: 'equal' })).warmup?.map(
      c => c.rate,
    )
    expect(rates).toEqual([8, 8, 7.5, 7.5, 7, 7, 6.5, 6.5, 6, 6])
    expect(withWarmup(buildPattern({ type: 'resonance', rate: 7, ratio: 'equal' })).warmup).toHaveLength(
      2 * WARMUP_CYCLES_PER_STEP,
    )
  })

  it('adds nothing when the target is not slower than the start', () => {
    for (const rate of [WARMUP_START_RATE, 9.5]) {
      const p = withWarmup(buildPattern({ type: 'resonance', rate, ratio: 'equal' }))
      expect(p).not.toHaveProperty('warmup')
      expect(warmupSec(p)).toBe(0)
    }
    // 重新计算而不是叠加
    expect(withWarmup(warm).warmup).toEqual(cycles)
    expect(withWarmup(warm, 7).warmup?.map(c => c.rate)).toEqual([7, 7, 6.5, 6.5, 6, 6])
  })

  it('starts at about 吸 3 / 呼 4.5 and keeps the target proportions', () => {
    const first = cycles[0]
    expect(first?.T).toBe(7.5)
    expect(first?.segs[0]?.dur).toBeCloseTo(7.5 * LONG_EXHALE_INHALE_FRACTION, 12)
    // 取到半秒，就是研究里写的「吸 3.0 / 呼 4.5」
    expect(first?.segs.map(s => Math.round(s.dur * 2) / 2)).toEqual([3, 4.5])
    expect(first?.segs.map(s => s.t0)).toEqual([0, first?.segs[0]?.dur])
  })

  it('only slows into slow breathing', () => {
    for (const params of [SIGH, BOX] as const) {
      const p = withWarmup(buildPattern(params))
      expect(p).not.toHaveProperty('warmup')
      expect(p).toEqual(buildPattern(params))
    }
  })

  it('rejects an invalid start rate', () => {
    for (const rate of [Number.NaN, 0, 2, 11]) expect(() => withWarmup(slow, rate)).toThrow(RangeError)
  })

  it('locates warm-up cycles first, then the target pattern', () => {
    const first = cycles[0]
    if (!first) throw new Error('没有放慢')
    expect(patternAt(warm, 0)).toMatchObject({ idx: 0, cycle: 0, y: 0 })
    expect(patternAt(warm, 0).rem).toBeCloseTo(first.segs[0]?.dur ?? 0, 12)
    expect(patternAt(warm, 0).seg).toBe(first.segs[0])
    const pt = patternAt(warm, first.T + 0.1)
    expect(pt.cycle).toBe(1)
    expect(pt.idx).toBe(0)
    const end = warmupSec(warm)
    expect(patternAt(warm, end + 1e-6)).toMatchObject({ cycle: cycles.length, idx: 0 })
    expect(patternAt(warm, end + 1e-6).seg).toBe(slow.segs[0])
    expect(patternAt(warm, end + slow.T * 2.5).cycle).toBe(cycles.length + 2)
  })

  it('stays continuous through the warm-up and into the target pattern', () => {
    let prev = patternAt(warm, 0)
    for (let t = 0.01; t < warmupSec(warm) + slow.T * 2; t += 0.01) {
      const pt = patternAt(warm, t)
      expect(Math.abs(pt.y - prev.y)).toBeLessThan(0.05)
      expect(pt.cycle - prev.cycle).toBeGreaterThanOrEqual(0)
      expect(pt.cycle - prev.cycle).toBeLessThanOrEqual(1)
      prev = pt
    }
  })
})

describe('cyclesOf', () => {
  it.each([
    ['without a warm-up', buildPattern(SIGH)],
    ['with a warm-up', withWarmup(buildPattern({ type: 'resonance', rate: 6, ratio: 'long' }))],
  ])('agrees with patternAt %s', (_, p) => {
    let n = 0
    let prevStart = Number.NEGATIVE_INFINITY
    for (const c of cyclesOf(p)) {
      expect(c.index).toBe(n)
      expect(c.start).toBeGreaterThan(prevStart)
      prevStart = c.start
      for (const [idx, seg] of c.segs.entries()) {
        const pt = patternAt(p, c.start + seg.t0 + 1e-7)
        expect(pt).toMatchObject({ cycle: c.index, idx })
        expect(pt.seg).toBe(seg)
      }
      if (++n >= 30) break
    }
  })
})

describe('cycleAt', () => {
  it('agrees with cyclesOf at every cycle start and inside cycles', () => {
    const p = withWarmup(buildPattern({ type: 'resonance', rate: 5.5, ratio: 'long' }))
    let n = 0
    for (const c of cyclesOf(p)) {
      for (const dt of [0, c.T / 3, c.T - 1e-6]) expect(cycleAt(p, c.start + dt)).toEqual(c)
      if (++n >= 25) break
    }
  })
})

describe('atRate', () => {
  it('keeps the proportions and the kind, without a warm-up', () => {
    const slow = withWarmup(buildPattern({ type: 'resonance', rate: 5.5, ratio: 'long' }))
    const faster = atRate(slow, 6)
    expect(faster).not.toHaveProperty('warmup')
    expect(faster).toMatchObject({ T: 10, rate: 6, type: 'resonance' })
    expect(faster.segs.map(s => s.dur / faster.T)).toEqual(
      slow.segs.map(s => expect.closeTo(s.dur / slow.T, 12)),
    )
    expect(faster.segs.map(s => [s.key, s.hint])).toEqual(slow.segs.map(s => [s.key, s.hint]))
    expect(faster.segs[1]?.t0).toBeCloseTo(faster.segs[0]?.dur ?? Number.NaN, 12)
  })

  it('rejects rates outside the slow-breathing range', () => {
    const p = buildPattern(RESONANCE)
    for (const rate of [2.9, 10.1, Number.NaN]) expect(() => atRate(p, rate)).toThrow(RangeError)
  })
})

describe('completedCycles', () => {
  it('counts whole cycles with a little slack for floating point', () => {
    const p = buildPattern(RESONANCE)
    expect(completedCycles(p, 0)).toBe(0)
    expect(completedCycles(p, -5)).toBe(0)
    expect(completedCycles(p, Number.NaN)).toBe(0)
    for (const t of [1, 10.9, 59.99, 60, 300, 299.999, 600])
      expect(completedCycles(p, t)).toBe(Math.floor(t / p.T + 1e-6))
    const seven = buildPattern({ type: 'resonance', rate: 7, ratio: 'equal' })
    expect(completedCycles(seven, 60)).toBe(7)
  })

  it('counts warm-up cycles as breaths', () => {
    const p = withWarmup(buildPattern(RESONANCE))
    const cycles = p.warmup ?? []
    expect(completedCycles(p, (cycles[0]?.T ?? 0) - 0.01)).toBe(0)
    expect(completedCycles(p, cycles[0]?.T ?? 0)).toBe(1)
    expect(completedCycles(p, warmupSec(p))).toBe(cycles.length)
    expect(completedCycles(p, warmupSec(p) + p.T * 3)).toBe(cycles.length + 3)
    // 与 patternAt 的轮数一致
    for (let t = 0.5; t < 200; t += 0.37) expect(completedCycles(p, t)).toBe(patternAt(p, t).cycle)
  })
})
