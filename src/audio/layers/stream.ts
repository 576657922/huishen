/**
 * 溪流：水体与水泡两段循环素材，平稳流淌，不随呼吸变化——流水本身的涨落已经足够。
 * 实时再加两样不随循环重复的变化：整体电平 ±0.4 dB 的慢速起伏，以及一个在 500–1800 Hz 之间游移的轻微共鸣，
 * 像水流在石头间换了个路线。两样都按时间直接求值，循环素材的 17 秒周期因此听不出来。
 */
import { createTrack, expMap } from '../automation'
import { smoothNoise } from '../dsp/noise'
import { dbToGain } from '../dsp/util'
import { biquadNode, gainNode } from '../graph'
import { STREAM } from '../params'
import { createCore, type LayerFactory, noHold, noMode } from './core'

/** 慢速起伏每隔多少秒取一个点 */
const STEP = 0.5

export const createStream: LayerFactory = (ctx, dest, bufs, opts) => {
  const core = createCore(ctx, dest, opts)
  const t0 = ctx.currentTime
  const seed = Math.floor(opts.rng() * 1e6)
  const flowIn = core.keep(gainNode(ctx, dbToGain(STREAM.mix.flowDb)))
  const bubblesIn = core.keep(gainNode(ctx, dbToGain(STREAM.mix.bubblesDb)))
  const focus = core.keep(biquadNode(ctx, 'peaking', STREAM.focusLo, STREAM.focusQ, STREAM.focusDb))
  const sway = core.keep(gainNode(ctx, 1))
  flowIn.connect(focus)
  bubblesIn.connect(focus)
  focus.connect(sway).connect(core.out)

  const focusAt = (t: number): number =>
    expMap(STREAM.focusLo, STREAM.focusHi, smoothNoise(seed, t, STREAM.focusRate))
  const swayAt = (t: number): number =>
    dbToGain(STREAM.swayDb * (2 * smoothNoise(seed + 1, t, STREAM.swayRate) - 1))
  const focusTrack = createTrack(focus.frequency, focusAt(t0), t0)
  const swayTrack = createTrack(sway.gain, swayAt(t0), t0)
  let until0 = t0

  return {
    start(at) {
      core.loop(bufs('flow'), flowIn, at, opts.rng)
      core.loop(bufs('bubbles'), bubblesIn, at, opts.rng)
    },
    schedule(until) {
      const now = ctx.currentTime
      for (until0 = Math.max(until0, now); until0 < until; ) {
        until0 += STEP
        focusTrack.rampTo(focusAt(until0), until0)
        swayTrack.rampTo(swayAt(until0), until0)
      }
      focusTrack.forget(now - 1)
      swayTrack.forget(now - 1)
    },
    breath() {},
    freeRun() {},
    level() {},
    hold: noHold,
    setMode: noMode,
    stop: core.stop,
    dispose: core.dispose,
  }
}
