/**
 * 雨：平稳的雨幕加细雨滴两段循环素材，再由这里实时随机地落下几颗更重的雨滴（平均每秒 0.35 颗）。
 * 雨不该随呼吸涨落：跟随节拍时只让高频略微明暗（几 dB 的高架），像雨丝时疏时密，响度几乎不变；
 * 另有 ±0.5 dB 的慢速雨势起伏，按时间求值，不随循环重复。
 */
import { createTrack, followBreath } from '../automation'
import { dropAsset } from '../dsp/assets'
import { smoothNoise } from '../dsp/noise'
import { dbToGain } from '../dsp/util'
import { biquadNode, gainNode } from '../graph'
import { ASSET_LUFS, RAIN } from '../params'
import { createCore, type LayerFactory, noMode } from './core'
import { playShot } from './shots'

const shelfOf = (y: number): number => RAIN.shelfLo + (RAIN.shelfHi - RAIN.shelfLo) * y

/** 不跟节拍、也没有节拍时停在中间 */
const IDLE_Y = 0.5
const STEP = 0.5

/** 雨幕与细雨滴相加后的响度（层内电平）：重雨滴按它定电平 */
const BED_LUFS = ASSET_LUFS + 10 * Math.log10(10 ** (RAIN.mix.bedDb / 10) + 10 ** (RAIN.mix.dropsDb / 10))

export const createRain: LayerFactory = (ctx, dest, bufs, opts) => {
  const core = createCore(ctx, dest, opts)
  const { rng } = opts
  const t0 = ctx.currentTime
  const seed = Math.floor(rng() * 1e6)
  const shelf = core.keep(biquadNode(ctx, 'highshelf', RAIN.shelfHz, 0.7, shelfOf(IDLE_Y)))
  const bed = core.keep(gainNode(ctx, dbToGain(RAIN.mix.bedDb)))
  const drops = core.keep(gainNode(ctx, dbToGain(RAIN.mix.dropsDb)))
  const sway = core.keep(gainNode(ctx, 1))
  bed.connect(shelf)
  drops.connect(shelf)
  shelf.connect(sway).connect(core.out)
  const bright = createTrack(shelf.gain, shelfOf(IDLE_Y), t0)
  const swayAt = (t: number): number => dbToGain(RAIN.swayDb * (2 * smoothNoise(seed, t, RAIN.swayRate) - 1))
  const swayTrack = createTrack(sway.gain, swayAt(t0), t0)
  let swayUntil = t0
  let nextHeavy = Number.POSITIVE_INFINITY

  function heavy(t: number): void {
    const h = RAIN.heavy
    const buffer = bufs(dropAsset(Math.floor(rng() * h.variants)))
    playShot(core, shelf, buffer, t, {
      lufs: BED_LUFS + h.levelDb + (rng() * 2 - 1) * h.jitterDb,
      rate: h.rateLo + (h.rateHi - h.rateLo) * rng(),
      pan: (rng() * 2 - 1) * h.pan,
    })
  }

  return {
    start(at) {
      core.loop(bufs('rainBed'), bed, at, rng)
      core.loop(bufs('rainDrops'), drops, at, rng)
      nextHeavy = at - Math.log(1 - rng()) / RAIN.heavy.rate
    },
    schedule(until) {
      const now = ctx.currentTime
      for (swayUntil = Math.max(swayUntil, now); swayUntil < until; ) {
        swayUntil += STEP
        swayTrack.rampTo(swayAt(swayUntil), swayUntil)
      }
      swayTrack.forget(now - 1)
      while (nextHeavy < until && !core.stopped) {
        if (nextHeavy >= now) heavy(nextHeavy)
        nextHeavy += -Math.log(1 - rng()) / RAIN.heavy.rate
      }
    },
    breath(seg, at) {
      const now = ctx.currentTime
      followBreath(seg, at, now, opts.breathStep, [[bright, shelfOf]])
      bright.forget(now - 1)
    },
    freeRun() {},
    level(y, at) {
      bright.set(shelfOf(y), at)
    },
    hold(at) {
      bright.cancelFrom(at)
    },
    setMode: noMode,
    stop: core.stop,
    dispose: core.dispose,
  }
}
