import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/lib/random'
import { MUSIC } from './params'
import { endRests, NO_RESTS, planRests, type Rest, restDensity, restEnd } from './rests'

const P = MUSIC.rest

function restsOf(start: number, plannedSec: number | undefined, seed: number, horizon: number): Rest[] {
  const plan = planRests(start, plannedSec, mulberry32(seed))
  const out: Rest[] = []
  for (let r = plan.next(start - 1); r && r.at < horizon; r = plan.next(r.at)) out.push(r)
  return out
}

describe('music rests', () => {
  it('sessions shorter than 10 minutes have none', () => {
    expect(restsOf(5, 599, 1, 10_000)).toEqual([])
    expect(planRests(5, 599, mulberry32(1)).density(300)).toBe(1)
    expect(NO_RESTS.next(0)).toBeNull()
  })

  it('10–20 minute sessions get one rest, longer ones two, away from the start and the end', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const [planned, count] of [
        [600, 1],
        [1199, 1],
        [1200, 2],
        [3600, 2],
      ] as const) {
        const start = 100
        const rests = restsOf(start, planned, seed, start + planned)
        expect(rests).toHaveLength(count)
        for (const r of rests) {
          expect(r.at).toBeGreaterThanOrEqual(start + P.margin)
          expect(restEnd(r)).toBeLessThanOrEqual(start + planned - P.margin + 1e-9)
          // 研究：8–10 秒变稀到静，停 20–40 秒
          expect(r.fade).toBeGreaterThanOrEqual(8)
          expect(r.fade).toBeLessThanOrEqual(10)
          expect(r.hold).toBeGreaterThanOrEqual(20)
          expect(r.hold).toBeLessThanOrEqual(40)
        }
        if (count === 2) expect(rests[1]!.at).toBeGreaterThan(restEnd(rests[0]!))
      }
    }
  })

  it('open-ended listening rests about every 15 minutes, planned lazily', () => {
    const rests = restsOf(0, undefined, 7, 4 * 3600)
    expect(rests.length).toBeGreaterThanOrEqual(12)
    rests.reduce((prev, r) => {
      const gap = r.at - prev
      expect(gap).toBeGreaterThanOrEqual(P.every - P.jitter)
      expect(gap).toBeLessThanOrEqual(P.every + P.jitter)
      return r.at
    }, 0)
  })

  it('density eases to silence, holds, and eases back without overshoot', () => {
    const r: Rest = { at: 100, fade: 9, hold: 30, back: 12 }
    expect(restDensity(r, 99)).toBe(1)
    expect(restDensity(r, 104.5)).toBeCloseTo(0.5, 5)
    expect(restDensity(r, 120)).toBe(0)
    expect(restDensity(r, restEnd(r) + 1)).toBe(1)
    let prev = 1
    for (let t = 100; t <= 109; t += 0.25) {
      const d = restDensity(r, t)
      expect(d).toBeLessThanOrEqual(prev + 1e-12)
      prev = d
    }
    for (let t = 139; t <= restEnd(r); t += 0.25) {
      const d = restDensity(r, t)
      expect(d).toBeGreaterThanOrEqual(prev - 1e-12)
      expect(d).toBeLessThanOrEqual(1)
      prev = d
    }
  })

  it('ending rests cancels the later ones and brings a rest under way back smoothly', () => {
    const plan = planRests(0, 900, mulberry32(3))
    const r = plan.next(-1)!
    // 还没到休止就开始跟随节拍：之后一直是 1，也不再排休止
    const early = endRests(plan, r.at - 10)
    expect(early.next(-1)).toBeNull()
    for (let t = r.at - 10; t < 900; t += 0.5) expect(early.density(t)).toBe(1)
    // 正在休止（完全安静）时开始：从 0 缓缓回来，用 back 秒，不过冲
    const mid = r.at + r.fade + 1
    const late = endRests(plan, mid)
    expect(late.next(-1)).toBeNull()
    expect(late.density(mid - 1)).toBe(plan.density(mid - 1))
    expect(late.density(mid)).toBe(0)
    let prev = 0
    for (let t = mid; t <= mid + P.back; t += 0.25) {
      const d = late.density(t)
      expect(d).toBeGreaterThanOrEqual(prev)
      expect(d).toBeLessThanOrEqual(1)
      prev = d
    }
    expect(late.density(mid + P.back)).toBe(1)
    expect(late.density(restEnd(r) + 60)).toBe(1)
  })
})
