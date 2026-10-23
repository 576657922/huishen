import { describe, expect, it } from 'vitest'
import { sum } from '@/lib/math'
import { mulberry32 } from '@/lib/random'
import {
  type Pace,
  paceAt,
  paceBreaths,
  paceCycleAt,
  paceCycles,
  paceEndAt,
  paceOf,
  paceSteps,
  paceTarget,
  STEP_BACK_LEAD_SEC,
  STEP_BACK_MAX_RATE,
  STEP_BACK_RATE,
  stepBack,
} from './pace'
import {
  buildPattern,
  type CycleSpan,
  completedCycles,
  patternAt,
  SLOW_RATE_MAX,
  warmupSec,
  withWarmup,
} from './patterns'
import type { BreathPattern } from './types'

const slow = (rate: number, ratio: 'equal' | 'long' = 'long'): BreathPattern =>
  withWarmup(buildPattern({ type: 'resonance', rate, ratio }))

/** 前 n 轮 */
function cyclesUntil(pace: Pace, end: number): CycleSpan[] {
  const out: CycleSpan[] = []
  for (const c of paceCycles(pace)) {
    if (c.start >= end) break
    out.push(c)
  }
  return out
}

/** 第 k 轮 */
function nth(pace: Pace, k: number): CycleSpan {
  let n = 0
  for (const c of paceCycles(pace)) if (n++ === k) return c
  throw new Error('不会到这里')
}

/** 按顺序点几次「有点急」，每次都要生效 */
function stepped(pattern: BreathPattern, times: readonly number[]): Pace {
  let pace = paceOf(pattern)
  for (const t of times) {
    const next = stepBack(pace, t)
    if (!next) throw new Error(`第 ${t} 秒的「有点急」没有生效`)
    pace = next.pace
  }
  return pace
}

describe('a single piece', () => {
  it('reads exactly like the pattern it wraps', () => {
    const p = slow(5.5)
    const pace = paceOf(p)
    for (let t = -3; t < 200; t += 0.173) {
      expect(paceAt(pace, t)).toEqual(patternAt(p, t))
      expect(paceBreaths(pace, t)).toBe(completedCycles(p, t))
    }
    expect(paceTarget(pace, 100)).toBe(5.5)
    expect(paceSteps(pace, 1000)).toBe(0)
    expect(paceCycleAt(pace, -5)).toMatchObject({ index: 0, start: 0, rate: 8 })
  })
})

describe('stepBack', () => {
  it('steps up from the current warm-up cycle and drops the rest of the warm-up', () => {
    const pace = paceOf(slow(5.5))
    // 放慢：8 8 7.5 7.5 7 7 6.5 6.5 6 6；第 7 轮（序号 6）每分钟 6.5 次
    const c6 = nth(pace, 6)
    expect(c6.rate).toBe(6.5)
    const next = stepBack(pace, c6.start + 1)
    expect(next?.rate).toBe(6.5 + STEP_BACK_RATE)
    expect(next?.at).toBeCloseTo(c6.start + c6.T, 12)
    const after = next?.pace ?? pace
    expect(after).toHaveLength(2)
    expect(after[1]).toMatchObject({ firstCycle: 7, pattern: { rate: 7, type: 'resonance' } })
    expect(after[1]?.pattern).not.toHaveProperty('warmup')
    expect(cyclesUntil(after, 200).map(c => c.rate)).toEqual([
      8,
      8,
      7.5,
      7.5,
      7,
      7,
      6.5,
      ...Array.from({ length: cyclesUntil(after, 200).length - 7 }, () => 7),
    ])
    expect(paceTarget(after, 0)).toBe(5.5)
    expect(paceTarget(after, 1000)).toBe(7)
  })

  it('applies from the next cycle in a steady pace', () => {
    const p = buildPattern({ type: 'resonance', rate: 5.5, ratio: 'long' })
    const pace = paceOf(p)
    const t = 3 * p.T + 6
    const next = stepBack(pace, t)
    expect(next).toMatchObject({ rate: 6 })
    expect(next?.at).toBeCloseTo(4 * p.T, 9)
    const after = next?.pace ?? pace
    // 点下去的那一轮照旧走完
    for (let x = 0; x < 4 * p.T - 1e-6; x += 0.05) expect(paceAt(after, x)).toEqual(patternAt(p, x))
    expect(paceAt(after, 4 * p.T + 1)).toMatchObject({ cycle: 4, idx: 0 })
    expect(paceCycleAt(after, 4 * p.T + 1)).toMatchObject({ index: 4, T: 10, rate: 6 })
  })

  it('waits for the cycle after next when the current one is about to end', () => {
    const p = buildPattern({ type: 'resonance', rate: 6, ratio: 'equal' })
    const pace = paceOf(p)
    const late = stepBack(pace, 20 - STEP_BACK_LEAD_SEC / 2)
    expect(late?.at).toBeCloseTo(30, 9)
    expect(late?.pace[1]?.firstCycle).toBe(3)
    const inTime = stepBack(pace, 20 - STEP_BACK_LEAD_SEC - 1e-3)
    expect(inTime?.at).toBeCloseTo(20, 9)
    expect(inTime?.pace[1]?.firstCycle).toBe(2)
  })

  it('stops at 7 a minute, the top of the slow-breathing range, and never slows a faster pace down', () => {
    expect(STEP_BACK_MAX_RATE).toBe(SLOW_RATE_MAX)
    expect(STEP_BACK_MAX_RATE).toBe(7)
    const at65 = paceOf(buildPattern({ type: 'resonance', rate: 6.5, ratio: 'equal' }))
    expect(stepBack(at65, 3)?.rate).toBe(STEP_BACK_MAX_RATE)
    const at7 = paceOf(buildPattern({ type: 'resonance', rate: 7, ratio: 'equal' }))
    expect(stepBack(at7, 3)).toBeNull()
    for (const rate of [7.5, 8, 9])
      expect(stepBack(paceOf(buildPattern({ type: 'resonance', rate, ratio: 'equal' })), 3)).toBeNull()
  })

  it('during the warm-up cycles faster than 7, holds the pace once the warm-up reaches 7', () => {
    // 放慢：8 8 7.5 7.5 7 7 6.5 …；在 8 次、7.5 次的那几轮点「有点急」，不往慢里调，也不加快到 7 以上：
    // 节拍照常放慢到 7 次，从那一轮（序号 4）起停在 7 次，剩下的放慢不再走
    const warm = paceOf(slow(5.5))
    const c4 = nth(warm, 4)
    for (const t of [2, nth(warm, 2).start + 1, c4.start - STEP_BACK_LEAD_SEC / 2]) {
      const held = stepBack(warm, t)
      expect(held?.rate, `${t}`).toBe(7)
      // 离 7 次的那一轮不到 0.3 秒时从再下一轮起（那一轮本来就是 7 次，听起来没有分别）
      const late = t > c4.start - STEP_BACK_LEAD_SEC
      expect(held?.at).toBeCloseTo(late ? c4.start + c4.T : c4.start, 9)
      expect(held?.pace[1]).toMatchObject({ firstCycle: late ? 5 : 4, pattern: { rate: 7 } })
      const rates = cyclesUntil(held?.pace ?? warm, 200).map(c => c.rate)
      expect(rates.slice(0, 4)).toEqual([8, 8, 7.5, 7.5])
      expect(rates.slice(4).every(r => r === 7)).toBe(true)
      // 已经停在 7 次：再点也没有分别
      expect(stepBack(held?.pace ?? warm, 100)).toBeNull()
    }
    // 放慢到 7 次以后再点：从下一轮起停在 7 次
    const at7 = stepBack(warm, c4.start + 1)
    expect(at7?.at).toBeCloseTo(c4.start + c4.T, 9)
    expect(at7?.rate).toBe(7)
    // 稳定以后仍比 7 快的节拍（旧计划的 7.5 次）在放慢中点也不改
    expect(stepBack(paceOf(slow(7.5)), 2)).toBeNull()
  })

  it('ignores another tap until the previous one has taken effect', () => {
    const p = buildPattern({ type: 'resonance', rate: 5.5, ratio: 'long' })
    const once = stepBack(paceOf(p), 2)
    expect(once?.at).toBeCloseTo(p.T, 9)
    const pace = once?.pace ?? paceOf(p)
    expect(stepBack(pace, 2.5)).toBeNull()
    // 离生效不到 0.3 秒时再点，也不会把排好的那次推后一轮
    expect(stepBack(pace, p.T - 0.1)).toBeNull()
    // 生效以后再点，就再快 0.5 次
    const twice = stepBack(pace, p.T + 1)
    expect(twice?.rate).toBe(6.5)
    expect(twice?.at).toBeCloseTo(p.T + 10, 9)
    expect(paceSteps(twice?.pace ?? pace, 1000)).toBe(2)
    expect(paceSteps(twice?.pace ?? pace, p.T + 5)).toBe(1)
  })

  it('does nothing before the practice starts', () => {
    const pace = paceOf(slow(5.5))
    expect(stepBack(pace, -1)).toBeNull()
    expect(stepBack(pace, Number.NaN)).toBeNull()
  })
})

describe('paceEndAt', () => {
  const p = buildPattern({ type: 'resonance', rate: 6, ratio: 'equal' })
  const pace = paceOf(p)

  it('finishes the phase in progress when the closing lines start', () => {
    // 吸 0–5、呼 5–10……：第 92 秒在吸气里，吸完（第 95 秒）就停；第 97 秒在呼气里，呼完（第 100 秒）
    expect(paceEndAt(pace, 92, 120)).toBeCloseTo(95, 9)
    expect(paceEndAt(pace, 97, 120)).toBeCloseTo(100, 9)
    // 正好落在两段之间：就停在那里
    expect(paceEndAt(pace, 95, 120)).toBeCloseTo(95, 9)
    expect(paceEndAt(pace, 90, 120)).toBeCloseTo(90, 9)
  })

  it('never runs past the end, and paces to the end without closing lines', () => {
    expect(paceEndAt(pace, 117, 118)).toBe(118)
    expect(paceEndAt(pace, 120, 120)).toBe(120)
    expect(paceEndAt(pace, 130, 120)).toBe(120)
    expect(paceEndAt(pace, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
  })

  it('follows the warm-up and 有点急 when finding the phase in progress', () => {
    const warm = paceOf(slow(5.5))
    const c3 = nth(warm, 3)
    const seg = c3.segs[1]
    if (!seg) throw new Error('缺少呼气')
    const t = c3.start + seg.t0 + 1
    expect(paceEndAt(warm, t, 300)).toBeCloseTo(c3.start + c3.T, 9)
    const stepped = stepBack(paceOf(p), 3)?.pace ?? pace
    // 每分钟 6.5 次：一轮 60 / 6.5 秒，从第 10 秒起
    const T = 60 / 6.5
    expect(paceEndAt(stepped, 10 + 2 * T + 1, 120)).toBeCloseTo(10 + 2 * T + T / 2, 9)
  })
})

describe('piecewise schedule properties', () => {
  /** 名称、节拍、12 次随机练习里至少生效的「有点急」次数（6.5 次时一点就到上限 7 次） */
  const PATTERNS: ReadonlyArray<[string, BreathPattern, number]> = [
    ['slow 5.5 long with warm-up', slow(5.5), 18],
    ['slow 4.5 equal with warm-up', slow(4.5, 'equal'), 18],
    ['slow 6 long without warm-up', buildPattern({ type: 'resonance', rate: 6, ratio: 'long' }), 18],
    ['slow 6.5 with a short warm-up', slow(6.5), 10],
  ]

  /** 随机点几次「有点急」，返回节拍；点在开头放慢中、一轮中间、一轮快结束时都有 */
  function randomPace(pattern: BreathPattern, seed: number): Pace {
    const rnd = mulberry32(seed)
    let pace = paceOf(pattern)
    let t = rnd() * 120
    for (let k = 0; k < 6; k++) {
      pace = stepBack(pace, t)?.pace ?? pace
      t += rnd() < 0.3 ? rnd() * 0.5 : 5 + rnd() * 40
    }
    return pace
  }

  for (const [name, pattern, minPieces] of PATTERNS) {
    it(`holds for ${name} under random step-backs`, () => {
      let pieces = 0
      for (let seed = 1; seed <= 12; seed++) {
        const pace = randomPace(pattern, seed)
        pieces += pace.length - 1
        const horizon = 400
        const cycles = cyclesUntil(pace, horizon)

        // 首尾相接：没有空档，也不重叠；轮序号连续；每轮各段之和就是一轮
        expect(cycles[0]).toMatchObject({ index: 0, start: 0 })
        for (const [k, c] of cycles.entries()) {
          expect(c.index).toBe(k)
          expect(sum(c.segs.map(s => s.dur))).toBeCloseTo(c.T, 9)
          expect(c.rate).toBeCloseTo(60 / c.T, 9)
          const next = cycles[k + 1]
          if (next) expect(next.start).toBeCloseTo(c.start + c.T, 9)
        }

        // 每一段从一轮的开头接管，轮序号接得上；之后每一轮都是这一段的速度，不再放慢
        for (const piece of pace.slice(1)) {
          const c = cycles.find(x => Math.abs(x.start - piece.t0) < 1e-9)
          if (piece.t0 < horizon) {
            expect(c?.index).toBe(piece.firstCycle)
            for (const later of cycles.filter(x => x.start >= piece.t0 - 1e-9))
              expect(later.rate).toBeLessThanOrEqual(STEP_BACK_MAX_RATE)
          }
          expect(piece.pattern).not.toHaveProperty('warmup')
        }

        // 交界两侧都在呼空的位置，曲线连续；读数与逐轮展开一致
        let prev = paceAt(pace, 0)
        let maxJump = 0
        let badSteps = 0
        for (let t = 0.02; t < horizon; t += 0.02) {
          const pt = paceAt(pace, t)
          maxJump = Math.max(maxJump, Math.abs(pt.y - prev.y))
          if (pt.cycle - prev.cycle !== 0 && pt.cycle - prev.cycle !== 1) badSteps++
          prev = pt
        }
        expect(maxJump).toBeLessThan(0.03)
        expect(badSteps).toBe(0)
        for (const c of cycles) {
          for (const [idx, seg] of c.segs.entries()) {
            const pt = paceAt(pace, c.start + seg.t0 + seg.dur / 2)
            expect(pt).toMatchObject({ cycle: c.index, idx })
            expect(pt.seg?.key).toBe(seg.key)
            expect(pt.seg?.dur).toBeCloseTo(seg.dur, 9)
          }
          expect(paceAt(pace, c.start + 1e-9).y).toBeCloseTo(0, 6)
          expect(paceCycleAt(pace, c.start + c.T / 2)).toMatchObject({ index: c.index, rate: c.rate })
        }

        // 完成的轮数：跨段累计，恰好练满一轮时算上
        for (const c of cycles) {
          expect(paceBreaths(pace, c.start + c.T)).toBe(c.index + 1)
          expect(paceBreaths(pace, c.start + c.T - 1e-3)).toBe(c.index)
        }
        expect(paceBreaths(pace, 0)).toBe(0)
      }
      // 随机的点击里确实有不少生效了
      expect(pieces).toBeGreaterThanOrEqual(minPieces)
    })
  }

  it('keeps the warm-up length counted in practice time', () => {
    const p = slow(5.5)
    const pace = stepped(p, [warmupSec(p) + 3])
    const cycles = cyclesUntil(pace, 300)
    expect(cycles.filter(c => c.start < warmupSec(p) - 1e-9).map(c => c.rate)).toEqual(
      p.warmup?.map(c => c.rate),
    )
  })
})
