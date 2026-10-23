import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLookahead,
  createTicker,
  HORIZON_HIDDEN_SEC,
  HORIZON_VISIBLE_SEC,
  horizonFor,
  LATE_TOLERANCE_SEC,
  TICK_MS,
} from './scheduler'

describe('ticker', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('ticks at once and then every 200 ms until stopped', () => {
    const onTick = vi.fn()
    const ticker = createTicker(onTick)
    ticker.start()
    expect(ticker.running).toBe(true)
    expect(onTick).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(TICK_MS * 5)
    expect(onTick).toHaveBeenCalledTimes(6)
    ticker.stop()
    ticker.stop()
    expect(ticker.running).toBe(false)
    vi.advanceTimersByTime(TICK_MS * 5)
    expect(onTick).toHaveBeenCalledTimes(6)
  })

  it('restarting does not double the rate', () => {
    const onTick = vi.fn()
    const ticker = createTicker(onTick)
    ticker.start()
    ticker.start()
    onTick.mockClear()
    vi.advanceTimersByTime(TICK_MS * 10)
    expect(onTick).toHaveBeenCalledTimes(10)
    ticker.stop()
  })

  it('uses injected timers', () => {
    const fns: Array<() => void> = []
    const setInterval = vi.fn((fn: () => void) => fns.push(fn))
    const clearInterval = vi.fn()
    const onTick = vi.fn()
    const ticker = createTicker(onTick, { setInterval, clearInterval }, 50)
    ticker.start()
    expect(setInterval).toHaveBeenCalledWith(onTick, 50)
    fns[0]?.()
    expect(onTick).toHaveBeenCalledTimes(2)
    ticker.stop()
    expect(clearInterval).toHaveBeenCalledWith(1)
  })
})

describe('horizon', () => {
  it('looks further ahead in the background', () => {
    expect(horizonFor(false)).toBe(HORIZON_VISIBLE_SEC)
    expect(horizonFor(true)).toBe(HORIZON_HIDDEN_SEC)
    expect(HORIZON_HIDDEN_SEC).toBeGreaterThan(60)
  })
})

describe('lookahead', () => {
  function* every(step: number): Generator<number> {
    for (let t = 0; ; t += step) yield t
  }

  it('emits each event once, in order, as the horizon moves', () => {
    const seen: number[] = []
    const la = createLookahead(
      every(1),
      t => t,
      t => seen.push(t),
    )
    expect(la.next()).toBe(0)
    la.fill(-3, 3)
    expect(seen).toEqual([0, 1, 2])
    la.fill(-2.8, 3.2)
    expect(seen).toEqual([0, 1, 2, 3])
    la.fill(0, 6)
    expect(seen).toEqual([0, 1, 2, 3, 4, 5])
    expect(la.next()).toBe(6)
  })

  it('skips events that were missed instead of playing them late', () => {
    const seen: number[] = []
    const la = createLookahead(
      every(1),
      t => t,
      t => seen.push(t),
    )
    la.fill(10 + LATE_TOLERANCE_SEC / 2, 12)
    expect(seen).toEqual([10, 11])
  })

  it('reports Infinity when the events run out', () => {
    const seen: string[] = []
    const events = [
      { t: 1, name: 'a' },
      { t: 2, name: 'b' },
    ]
    const la = createLookahead(
      events,
      e => e.t,
      e => seen.push(e.name),
    )
    la.fill(0, 100)
    expect(seen).toEqual(['a', 'b'])
    expect(la.next()).toBe(Number.POSITIVE_INFINITY)
    la.fill(0, 200)
    expect(seen).toEqual(['a', 'b'])
  })
})
