import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/lib/random'
import { AUDIO_EXTRAPOLATE_MAX_SEC, type AudioTimeSource, createAudioClock, createPerfClock } from './clock'

/** 手动推进的毫秒时钟 */
function manualPerf(start = 1000) {
  let ms = start
  return {
    now: () => ms,
    advance(dt: number) {
      ms += dt
    },
  }
}

/** 假的声音时钟：running 时跟着毫秒时钟走，可按块更新 */
function audioSource(perf: { now(): number }, quantum = 0) {
  let base = 50
  let since: number | null = perf.now()
  const raw = (): number => (since === null ? base : base + (perf.now() - since) / 1000)
  const src: AudioTimeSource & { suspend(): void; resume(): void } = {
    now: () => (quantum > 0 ? Math.floor(raw() / quantum) * quantum : raw()),
    running: () => since !== null,
    suspend() {
      base = raw()
      since = null
    },
    resume() {
      since = perf.now()
    },
  }
  return src
}

describe('perf clock', () => {
  it('starts at the given reading and follows performance time', () => {
    const perf = manualPerf()
    const clock = createPerfClock({ perfNow: perf.now, start: -3 })
    expect(clock.mode).toBe('perf')
    expect(clock.now()).toBe(-3)
    perf.advance(2500)
    expect(clock.now()).toBeCloseTo(-0.5, 12)
  })

  it('leaves paused time out', () => {
    const perf = manualPerf()
    const clock = createPerfClock({ perfNow: perf.now })
    perf.advance(10_000)
    clock.pause()
    clock.pause()
    expect(clock.paused).toBe(true)
    perf.advance(60_000)
    expect(clock.now()).toBeCloseTo(10, 12)
    clock.resume()
    perf.advance(5000)
    expect(clock.now()).toBeCloseTo(15, 12)
    clock.pause()
    perf.advance(1000)
    clock.resume()
    clock.resume()
    perf.advance(1000)
    expect(clock.now()).toBeCloseTo(16, 12)
  })

  it('runs faster with a time scale', () => {
    const perf = manualPerf()
    const clock = createPerfClock({ perfNow: perf.now, start: -3, timeScale: 10 })
    perf.advance(300)
    expect(clock.now()).toBeCloseTo(0, 12)
    clock.pause()
    perf.advance(5000)
    clock.resume()
    perf.advance(1000)
    expect(clock.now()).toBeCloseTo(10, 12)
  })
})

describe('audio clock', () => {
  it('reads audio time relative to the origin', () => {
    const perf = manualPerf()
    const src = audioSource(perf)
    const clock = createAudioClock(src, 53, perf.now)
    expect(clock.mode).toBe('audio')
    expect(clock.now()).toBeCloseTo(-3, 12)
    perf.advance(4000)
    expect(clock.now()).toBeCloseTo(1, 12)
  })

  it('smooths coarse audio updates without running ahead or going back', () => {
    const perf = manualPerf()
    const src = audioSource(perf, 0.05)
    const clock = createAudioClock(src, 50, perf.now)
    let prev = clock.now()
    for (let i = 0; i < 400; i++) {
      perf.advance(4)
      const v = clock.now()
      expect(v).toBeGreaterThanOrEqual(prev)
      // 推算的读数紧跟真实时间，不超过上限
      const real = (i + 1) * 0.004
      expect(v).toBeLessThanOrEqual(real + 1e-9)
      expect(v).toBeGreaterThan(real - 0.01)
      prev = v
    }
  })

  it('caps extrapolation when the audio thread stalls', () => {
    const perf = manualPerf()
    let ct = 10
    const clock = createAudioClock({ now: () => ct, running: () => true }, 0, perf.now)
    expect(clock.now()).toBe(10)
    perf.advance(5000)
    expect(clock.now()).toBeCloseTo(10 + AUDIO_EXTRAPOLATE_MAX_SEC, 12)
    // 声音时钟追上来之前读数保持不动，不倒退
    ct = 10.05
    expect(clock.now()).toBeCloseTo(10 + AUDIO_EXTRAPOLATE_MAX_SEC, 12)
    ct = 10.2
    expect(clock.now()).toBeCloseTo(10.2, 12)
  })

  it('does not extrapolate while the audio is suspended', () => {
    const perf = manualPerf()
    const src = audioSource(perf, 0.02)
    const clock = createAudioClock(src, 50, perf.now)
    perf.advance(1000)
    src.suspend()
    const frozen = clock.now()
    perf.advance(3000)
    expect(clock.now()).toBe(frozen)
  })

  it('freezes on pause and follows the audio again after resume', () => {
    const perf = manualPerf()
    const src = audioSource(perf)
    const clock = createAudioClock(src, 50, perf.now)
    perf.advance(7000)
    clock.pause()
    src.suspend()
    perf.advance(60_000)
    expect(clock.now()).toBeCloseTo(7, 12)
    src.resume()
    clock.resume()
    perf.advance(5000)
    expect(clock.now()).toBeCloseTo(12, 9)
  })

  it('jumps to the audio position if the audio kept playing through a pause', () => {
    const perf = manualPerf()
    const src = audioSource(perf)
    const clock = createAudioClock(src, 50, perf.now)
    perf.advance(2000)
    clock.pause()
    perf.advance(3000)
    expect(clock.now()).toBeCloseTo(2, 12)
    clock.resume()
    expect(clock.now()).toBeCloseTo(5, 12)
  })

  it('switches to the perf clock and carries on from the current reading', () => {
    const perf = manualPerf()
    const src = audioSource(perf)
    const clock = createAudioClock(src, 50, perf.now)
    perf.advance(1500)
    src.suspend()
    clock.switchToPerf()
    clock.switchToPerf()
    expect(clock.mode).toBe('perf')
    perf.advance(2000)
    expect(clock.now()).toBeCloseTo(3.5, 12)
  })

  it('keeps a paused reading when switching to the perf clock', () => {
    const perf = manualPerf()
    const src = audioSource(perf)
    const clock = createAudioClock(src, 50, perf.now)
    perf.advance(4000)
    clock.pause()
    clock.switchToPerf()
    perf.advance(10_000)
    expect(clock.now()).toBeCloseTo(4, 12)
    clock.resume()
    perf.advance(1000)
    expect(clock.now()).toBeCloseTo(5, 12)
  })

  it('never goes backwards under jittery updates', () => {
    const rnd = mulberry32(7)
    const perf = manualPerf()
    let ct = 0
    let running = true
    const clock = createAudioClock({ now: () => ct, running: () => running }, 0, perf.now)
    let prev = clock.now()
    for (let i = 0; i < 5000; i++) {
      perf.advance(rnd() * 20)
      if (rnd() < 0.3) ct += rnd() * 0.03
      if (rnd() < 0.01) running = !running
      if (rnd() < 0.005) clock.pause()
      if (rnd() < 0.005) clock.resume()
      const v = clock.now()
      expect(v).toBeGreaterThanOrEqual(prev)
      expect(v).toBeLessThanOrEqual(ct + AUDIO_EXTRAPOLATE_MAX_SEC + 1e-9)
      prev = v
    }
  })
})
