/**
 * 海浪。浪的起伏不烤进素材，而是实时做在滤波和增益上：
 * 吸气时浪涌上来（低通打开、稍微变响），呼气从浪顶开始时浪头碎开（浪花的嘶嘶声涌起），随后退去。
 * 不跟节拍时，自己按 8–12 秒一浪起伏。响度起伏控制在约 3 dB 以内，主要靠明暗表现浪。
 */
import type { Segment } from '@/engine/types'
import { createTrack, expMap, followBreath, segment } from '../automation'
import { dbToGain } from '../dsp/util'
import { biquadNode, gainNode } from '../graph'
import { OCEAN } from '../params'
import { createCore, type LayerFactory, noMode } from './core'

const cutOf = (y: number): number => expMap(OCEAN.cutLo, OCEAN.cutHi, y)
const gainOf = (y: number): number => OCEAN.gainLo + (1 - OCEAN.gainLo) * Math.max(0, y) ** OCEAN.gainExp

export const createOcean: LayerFactory = (ctx, dest, bufs, opts) => {
  const core = createCore(ctx, dest, opts)
  const t0 = ctx.currentTime
  const lp = core.keep(biquadNode(ctx, 'lowpass', cutOf(0), OCEAN.cutQ))
  const wave = core.keep(gainNode(ctx, gainOf(0)))
  const bp = core.keep(biquadNode(ctx, 'bandpass', OCEAN.foamBand, OCEAN.foamQ))
  const foamTrim = core.keep(gainNode(ctx, dbToGain(OCEAN.foamDb)))
  const foam = core.keep(gainNode(ctx, 0))
  lp.connect(wave).connect(core.out)
  bp.connect(foamTrim).connect(foam).connect(core.out)
  const cut = createTrack(lp.frequency, cutOf(0), t0)
  const gain = createTrack(wave.gain, gainOf(0), t0)
  const spray = createTrack(foam.gain, 0, t0)
  const tracks = [cut, gain, spray]

  let mode: 'idle' | 'paced' | 'free' = 'idle'
  /** 已排到的最后时刻和那时的浪高，自由起伏从这里接着排 */
  let freeAt = 0
  let lastY = 0

  /** 浪头碎开：浪花迅速涌起，停一会儿，再按这一段的长短慢慢消散 */
  function breakAt(at: number, dur: number): void {
    const tau = Math.max(OCEAN.foamDecayMin, dur * OCEAN.foamDecayRatio)
    const t1 = at + OCEAN.foamRise + OCEAN.foamHold
    spray.cancelFrom(at)
    spray.rampTo(OCEAN.foamPeak, at + OCEAN.foamRise)
    spray.rampTo(OCEAN.foamPeak, t1)
    const n = 8
    for (let k = 1; k <= n; k++) {
      spray.rampTo(k === n ? 0 : OCEAN.foamPeak * Math.exp((-4 * k) / n), t1 + (4 * tau * k) / n)
    }
  }

  function swell(seg: Segment, at: number, from: number): void {
    followBreath(seg, at, from, opts.breathStep, [
      [cut, cutOf],
      [gain, gainOf],
    ])
    // 只有从浪顶开始退的一段才碎出浪花；「有点急」之后接上的半段呼气不再碎一次
    if (seg.y1 < seg.y0 && seg.y0 >= OCEAN.foamFromY && at >= from) breakAt(at, seg.dur)
    lastY = seg.y1
  }

  function forget(now: number): void {
    for (const t of tracks) t.forget(now - 1)
  }

  return {
    start(at) {
      core.loop(bufs('oceanBed'), lp, at, opts.rng)
      core.loop(bufs('oceanFoam'), bp, at, opts.rng)
    },
    schedule() {},
    breath(seg, at) {
      const now = ctx.currentTime
      if (mode === 'free') for (const t of tracks) t.cancelFrom(Math.max(at, now))
      mode = 'paced'
      swell(seg, at, now)
      forget(now)
    },
    freeRun(now, until) {
      if (mode === 'paced') return
      if (mode === 'idle') freeAt = now
      mode = 'free'
      freeAt = Math.max(freeAt, now)
      const { minPeriod, maxPeriod, rise } = OCEAN.free
      while (freeAt < until) {
        const period = minPeriod + opts.rng() * (maxPeriod - minPeriod)
        const up = period * rise
        swell(segment('in', lastY, 1, up), freeAt, now)
        swell(segment('out', 1, 0, period - up), freeAt + up, now)
        freeAt += period
      }
      forget(now)
    },
    level(y, at) {
      cut.set(cutOf(y), at)
      gain.set(gainOf(y), at)
      lastY = y
    },
    hold(at) {
      cut.cancelFrom(at)
      gain.cancelFrom(at)
      // 浪花不停在半空：从当时的值慢慢消散
      const v = spray.valueAt(at)
      spray.glide(0, at, at + Math.max(OCEAN.foamDecayMin, 1.5) + v, undefined, 8)
      lastY =
        cut.valueAt(at) > 0
          ? Math.log(cut.valueAt(at) / OCEAN.cutLo) / Math.log(OCEAN.cutHi / OCEAN.cutLo)
          : 0
      if (mode === 'free') freeAt = at
    },
    setMode: noMode,
    stop: core.stop,
    dispose: core.dispose,
  }
}
