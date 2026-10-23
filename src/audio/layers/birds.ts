/**
 * 鸟鸣：一层很静的树叶与空气声做底子，上面隔 4–15 秒随机来一句鸟鸣（六种叫声里挑一种），
 * 每次的音高、远近、方位、轻重都略有不同，有时同一只鸟把这一句再唱一遍。
 * 鸟鸣比底子低 12–18 dB（研究建议）；只做和谐柔和的鸣唱。睡前模式不出鸟声（会把人唤醒），只留底子。
 */
import { birdAsset } from '../dsp/assets'
import { gainNode } from '../graph'
import { BIRD_BED, BIRDS, FOREST } from '../params'
import type { SoundMode } from '../types'
import {
  type Buffers,
  createCore,
  type Layer,
  type LayerCore,
  type LayerFactory,
  type LayerOptions,
} from './core'
import { playShot } from './shots'
import { createStream } from './stream'
import { windLayer } from './wind'

export interface Singer {
  start(at: number): void
  schedule(until: number): void
  setMode(mode: SoundMode): void
}

const between = (rng: () => number, lo: number, hi: number): number => lo + (hi - lo) * rng()

/**
 * 在 dest 上随机安排鸟鸣。lufs 为一句鸟鸣的瞬时响度最大值（层内电平）。
 * 睡前模式下照样推进时间、只是不出声，换回放松模式时鸟鸣从下一句接着来
 */
export function createSinger(
  core: LayerCore,
  dest: AudioNode,
  bufs: Buffers,
  opts: LayerOptions,
  lufs: number,
): Singer {
  const { rng } = opts
  let mode: SoundMode = opts.mode
  let next = Number.POSITIVE_INFINITY
  let last = -1

  function sing(t: number): number {
    // 不连着两次挑同一种叫声
    let song = Math.floor(rng() * BIRDS.songs.length)
    if (song === last) song = (song + 1) % BIRDS.songs.length
    last = song
    const buffer = bufs(birdAsset(song))
    const near = rng()
    const voice = {
      rate: between(rng, BIRDS.rateLo, BIRDS.rateHi),
      pan: (rng() * 2 - 1) * BIRDS.pan,
      // 远处的鸟更暗、更轻
      cutoff: BIRDS.farCut * (BIRDS.nearCut / BIRDS.farCut) ** near,
      lufs: lufs + (rng() * 2 - 1) * BIRDS.levelJitterDb - 3 * (1 - near),
    }
    if (mode === 'relax') playShot(core, dest, buffer, t, voice)
    let end = t + buffer.duration / voice.rate
    if (rng() < BIRDS.repeatChance) {
      const again = end + between(rng, BIRDS.repeatLo, BIRDS.repeatHi)
      if (mode === 'relax') playShot(core, dest, buffer, again, voice)
      end = again + buffer.duration / voice.rate
    }
    return end
  }

  return {
    start(at) {
      next = at + between(rng, BIRDS.firstLo, BIRDS.firstHi)
    },
    schedule(until) {
      const now = core.ctx.currentTime
      while (next < until && !core.stopped) {
        const end = next >= now ? sing(next) : next
        next = end + between(rng, BIRDS.gapLo, BIRDS.gapHi)
      }
    },
    setMode(m) {
      mode = m
    },
  }
}

/** 几层声音合成一层：各个方法依次转给每一层，再做自己的那部分 */
function compose(core: LayerCore, children: readonly Layer[], singer: Singer): Layer {
  return {
    start(at, quick) {
      for (const c of children) c.start(at, quick)
      singer.start(at)
    },
    schedule(until) {
      for (const c of children) c.schedule(until)
      singer.schedule(until)
    },
    breath(seg, at) {
      for (const c of children) c.breath(seg, at)
    },
    freeRun(now, until) {
      for (const c of children) c.freeRun(now, until)
    },
    level(y, at) {
      for (const c of children) c.level(y, at)
    },
    hold(at) {
      for (const c of children) c.hold(at)
    },
    setMode(mode) {
      for (const c of children) c.setMode(mode)
      singer.setMode(mode)
    },
    stop(at) {
      for (const c of children) c.stop(at)
      core.stop(at)
    },
    dispose() {
      for (const c of children) c.dispose()
      core.dispose()
    },
  }
}

/** 子层不单独回收外面的节点：整层（core）回收时才通知引擎 */
const childOpts = (opts: LayerOptions): LayerOptions => ({ ...opts, onDisposed: undefined })

export const createBirds: LayerFactory = (ctx, dest, bufs, opts) => {
  const core = createCore(ctx, dest, opts)
  const bed = windLayer(BIRD_BED.calm)(ctx, core.out, bufs, childOpts(opts))
  const birds = core.keep(gainNode(ctx, 1))
  birds.connect(core.out)
  opts.inspect?.('birds', birds)
  const singer = createSinger(core, birds, bufs, opts, BIRD_BED.bedLufs + BIRDS.underBedDb)
  return compose(core, [bed], singer)
}

export const createForest: LayerFactory = (ctx, dest, bufs, opts) => {
  const core = createCore(ctx, dest, opts)
  const brook = core.keep(gainNode(ctx, 10 ** (FOREST.brookDb / 20)))
  const air = core.keep(gainNode(ctx, 10 ** (FOREST.windDb / 20)))
  const birds = core.keep(gainNode(ctx, 1))
  brook.connect(core.out)
  air.connect(core.out)
  birds.connect(core.out)
  opts.inspect?.('birds', birds)
  const stream = createStream(ctx, brook, bufs, childOpts(opts))
  const wind = windLayer(FOREST.calm)(ctx, air, bufs, childOpts(opts))
  const singer = createSinger(core, birds, bufs, opts, FOREST.bedLufs + FOREST.birdsUnderBedDb)
  return compose(core, [stream, wind], singer)
}
