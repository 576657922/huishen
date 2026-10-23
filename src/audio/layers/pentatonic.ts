/**
 * 五声：D 宫五声音阶（D E F♯ A B，D3–B4）上稀疏的拨弦，音色接近古琴、古筝。只是一种风格，不作健康声明。
 * 起音间隔服从均值 3.2 秒的指数分布（放松截在 1.1–8.5 秒，睡前最短 2.2 秒），没有节拍也没有小节；
 * 旋律以级进为主、轻轻拉回中间音区；偶尔加一个五度或八度的和音，像顺手带出的一个双音。
 * 力度柔和，几个音偶然挤在一起时调轻（只压不抬）；休止时音符按密度逐渐变稀。
 * 底下有一层很轻的 D 空五度持续音，音与音之间不会掉进静默。
 */
import { clamp } from '@/lib/math'
import { pluckAsset } from '../dsp/assets'
import { dbToGain } from '../dsp/util'
import { biquadNode, gainNode, panNode } from '../graph'
import { PEDAL, PENTA, PENTATONIC_NOTES } from '../params'
import type { SoundMode } from '../types'
import { createCore, type LayerFactory } from './core'
import { createGovernor } from './governor'
import { createMusicChain } from './music'
import { createPad } from './pad'

const NOTES = PENTATONIC_NOTES
const CENTER = (NOTES.length - 1) / 2
const LAST = NOTES.length - 1

/** 下一个音在音阶里的位置：按级进权重抽取，离中间越远越不容易再往外走 */
export function nextIndex(i: number, rng: () => number): number {
  const cands: [number, number][] = []
  let total = 0
  for (const [step, w] of PENTA.steps) {
    const j = i + step
    if (j < 0 || j > LAST) continue
    const weight = w * Math.exp(-PENTA.gravity * (j - CENTER) ** 2)
    cands.push([j, weight])
    total += weight
  }
  let u = rng() * total
  for (const [j, weight] of cands) {
    u -= weight
    if (u <= 0) return j
  }
  return cands[cands.length - 1]?.[0] ?? i
}

/** 和音：优先上方纯五度，其次上方八度，都不在音域里就取下方 */
export function partnerOf(midi: number, rng: () => number): number | null {
  const up = [7, 12].filter(d => (NOTES as readonly number[]).includes(midi + d))
  const down = [-7, -12].filter(d => (NOTES as readonly number[]).includes(midi + d))
  const pool = up.length ? up : down
  if (!pool.length) return null
  return midi + pool[Math.floor(rng() * pool.length)]!
}

export const createPentatonic: LayerFactory = (ctx, dest, bufs, opts) => {
  const core = createCore(ctx, dest, opts)
  const chain = createMusicChain(core, bufs('ir'), PENTA.tone, opts, PEDAL.tone)
  const pad = createPad(core, chain.padInput!)
  const { rng } = opts
  let mode: SoundMode = opts.mode
  let next = Number.POSITIVE_INFINITY
  let index = Math.floor(CENTER + (rng() - 0.5) * 3)
  const meanVel = (PENTA.velocityLo + PENTA.velocityHi) / 2
  const govern = createGovernor({
    tau: PENTA.governorTau,
    meanGap: PENTA.meanGap,
    meanPower: meanVel ** 2,
    floor: PENTA.governorFloor,
  })
  const noteGain = dbToGain(PENTA.noteDb)

  function note(midi: number, t: number, velocity: number): void {
    const buffer = bufs(pluckAsset(midi))
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const v = clamp((velocity - PENTA.velocityLo) / (PENTA.velocityHi - PENTA.velocityLo), 0, 1)
    // 力度越小越暗，像手指拨得更轻
    const lp = biquadNode(ctx, 'lowpass', PENTA.noteCutLo * (PENTA.noteCutHi / PENTA.noteCutLo) ** v, 0.5)
    const g = gainNode(ctx, velocity * noteGain)
    const spread = (NOTES as readonly number[]).indexOf(midi) / LAST
    const pan = panNode(ctx, PENTA.pan * (2 * spread - 1) + (rng() * 2 - 1) * PENTA.panJitter)
    src.connect(lp).connect(g).connect(pan).connect(chain.input)
    core.play(src, [lp, g, pan], t, t + buffer.duration)
  }

  function pluckAt(t: number): void {
    // 休止前后音符按密度变稀；不出的音也不推进旋律，回来时接着原来的走向
    if (rng() >= chain.density(t)) return
    index = nextIndex(index, rng)
    const midi = NOTES[index]!
    const velocity = govern(t, PENTA.velocityLo + rng() * (PENTA.velocityHi - PENTA.velocityLo))
    note(midi, t, velocity)
    if (rng() < PENTA.dyadChance) {
      const other = partnerOf(midi, rng)
      const delay = PENTA.dyadDelayLo + rng() * (PENTA.dyadDelayHi - PENTA.dyadDelayLo)
      if (other !== null) note(other, t + delay, velocity * dbToGain(PENTA.dyadDb))
    }
  }

  function gap(): number {
    return clamp(-Math.log(1 - rng()) * PENTA.meanGap, PENTA.minGap[mode], PENTA.maxGap)
  }

  return {
    start(at, quick) {
      next = at + (quick ? PENTA.quickFirstNote : PENTA.firstNote)
      pad.start(at)
      for (const v of PENTA.pedal) pad.noteOn(v, at, quick ? PEDAL.quickIn : PEDAL.fadeIn)
    },
    schedule(until) {
      while (next < until && !core.stopped) {
        pluckAt(next)
        next += gap()
      }
      chain.schedule(until)
    },
    breath: chain.breath,
    freeRun: chain.freeRun,
    level: chain.level,
    hold: chain.hold,
    setMode(m) {
      mode = m
    },
    stop: core.stop,
    dispose: core.dispose,
  }
}
