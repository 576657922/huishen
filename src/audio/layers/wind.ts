/**
 * 林间风。素材只有两段平稳的底子（风体、树叶），阵风实时做在滤波和增益上：
 * 阵风来时风体的频带上移、变响一点，枝间有一丝呼啸，树叶沙沙作响；阵风过去又归于平静。
 * 阵风强度由几层 0.03–0.15 Hz 的慢速噪声按时间直接求出，永远不会循环重复；
 * 跟随节拍时，一部分阵风对齐呼气，像一口气呼出去时林间正好过一阵风。
 * 鸟鸣、林间两种声景也用它做底子，只是把阵风压得更平（calm）。
 */
import type { Segment } from '@/engine/types'
import { easeInOut } from '@/lib/math'
import { createTrack, expMap, type Track } from '../automation'
import { dbToGain } from '../dsp/util'
import { gustAt } from '../dsp/wind'
import { biquadNode, gainNode } from '../graph'
import { WIND } from '../params'
import { createCore, type Layer, type LayerFactory, type LayerOptions, noMode } from './core'

type GustMap = readonly (readonly [Track, (g: number) => number])[]

const bodyFreq = (g: number): number => expMap(WIND.bodyLo, WIND.bodyHi, g)
const bodyGain = (g: number): number => WIND.bodyGainLo + (1 - WIND.bodyGainLo) * g
const whistleFreq = (g: number): number => WIND.whistleLo + (WIND.whistleHi - WIND.whistleLo) * g
const whistleGain = (g: number): number => dbToGain(WIND.whistleDb) * g * g
const leavesGain = (g: number): number =>
  dbToGain(WIND.leavesDb) * (WIND.leavesFloor + (1 - WIND.leavesFloor) * g * g)

/** 呼气里的一阵风：前 40% 涌起，后 60% 慢慢平息 */
function exhaleGust(q: number): number {
  return q < 0.4 ? easeInOut(q / 0.4) : easeInOut(1 - (q - 0.4) / 0.6)
}

/** calm 为阵风的幅度比例：1 为原样，越小越平静 */
export function windLayer(calm: number): LayerFactory {
  return (ctx, dest, bufs, opts) => createWindLayer(ctx, dest, bufs, opts, calm)
}

function createWindLayer(
  ctx: BaseAudioContext,
  dest: AudioNode,
  bufs: Parameters<LayerFactory>[2],
  opts: LayerOptions,
  calm: number,
): Layer {
  const core = createCore(ctx, dest, opts)
  const t0 = ctx.currentTime
  const idle = WIND.gust.idle
  const soften = (g: number): number => idle + calm * (g - idle)
  // 每次创建换一组阵风：同一段练习里换回林间风，也不会听到刚才那阵风再来一遍
  const gust = { ...WIND.gust, seed: WIND.gust.seed + Math.floor(opts.rng() * 1e6) }
  const g0 = soften(idle)

  const bedIn = core.keep(gainNode(ctx, 1))
  const bodyBp = core.keep(biquadNode(ctx, 'bandpass', bodyFreq(g0), WIND.bodyQ))
  const body = core.keep(gainNode(ctx, bodyGain(g0)))
  const whistleBp = core.keep(biquadNode(ctx, 'bandpass', whistleFreq(g0), WIND.whistleQ))
  const whistle = core.keep(gainNode(ctx, whistleGain(g0)))
  const leaves = core.keep(gainNode(ctx, leavesGain(g0)))
  bedIn.connect(bodyBp).connect(body).connect(core.out)
  bedIn.connect(whistleBp).connect(whistle).connect(core.out)
  leaves.connect(core.out)

  const map: GustMap = [
    [createTrack(bodyBp.frequency, bodyFreq(g0), t0), bodyFreq],
    [createTrack(body.gain, bodyGain(g0), t0), bodyGain],
    [createTrack(whistleBp.frequency, whistleFreq(g0), t0), whistleFreq],
    [createTrack(whistle.gain, whistleGain(g0), t0), whistleGain],
    [createTrack(leaves.gain, leavesGain(g0), t0), leavesGain],
  ]

  let mode: 'idle' | 'paced' | 'free' = 'idle'
  let freeAt = 0

  function put(g: number, t: number): void {
    const s = soften(g)
    for (const [track, f] of map) track.rampTo(f(s), t)
  }

  function cancelFrom(t: number): void {
    for (const [track] of map) track.cancelFrom(t)
  }

  function forget(now: number): void {
    for (const [track] of map) track.forget(now - 1)
  }

  /** 一段呼吸里的阵风：自然的阵风与对齐呼气的一阵按比例混合 */
  function pacedGust(seg: Segment, at: number, t: number): number {
    const natural = gustAt(t, gust)
    const q = seg.dur > 0 ? (t - at) / seg.dur : 1
    const aligned = seg.key === 'out' ? exhaleGust(q) : 0
    return (1 - WIND.gust.breathMix) * natural + WIND.gust.breathMix * aligned
  }

  return {
    start(at) {
      core.loop(bufs('windBed'), bedIn, at, opts.rng)
      core.loop(bufs('leaves'), leaves, at, opts.rng)
    },
    schedule() {},
    breath(seg, at) {
      const now = ctx.currentTime
      if (mode === 'free') cancelFrom(Math.max(at, now))
      mode = 'paced'
      const n = Math.max(2, Math.ceil(seg.dur / WIND.gust.step))
      for (let k = 1; k <= n; k++) {
        const t = at + (seg.dur * k) / n
        if (t > now) put(pacedGust(seg, at, t), t)
      }
      forget(now)
    },
    freeRun(now, until) {
      if (mode === 'paced') return
      if (mode === 'idle') freeAt = now
      mode = 'free'
      for (freeAt = Math.max(freeAt, now); freeAt < until; ) {
        freeAt += WIND.gust.step
        put(gustAt(freeAt, gust), freeAt)
      }
      forget(now)
    },
    level(_y, at) {
      // 风与肺容量无关：中途加入时从平静的自然阵风开始，随后由 breath 接上这一口气里的那阵风
      const g = soften((1 - WIND.gust.breathMix) * gustAt(at, gust))
      for (const [track, f] of map) track.set(f(g), at)
    },
    hold(at) {
      cancelFrom(at)
      if (mode === 'free') freeAt = at
    },
    setMode: noMode,
    stop: core.stop,
    dispose: core.dispose,
  }
}

export const createWind: LayerFactory = windLayer(1)
