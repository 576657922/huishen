/**
 * 回响：仿 Brian Eno《Music for Airports》的相位音乐。六个声部各自只重复一个音（都在 D 宫五声里），
 * 周期是 17–31 秒之间互不成整数比的数，所以音与音的组合一直在变、几乎不会重复；
 * 音色是柔和的调频电钢琴，衰减很长，泡在长混响里，没有节拍。平均每秒不到 0.3 个音，睡前也不用变。
 * 底下有一层很轻的挂二和弦持续音，几个声部恰好都在等待时不会掉进静默。
 */
import { epAsset } from '../dsp/assets'
import { dbToGain } from '../dsp/util'
import { gainNode, panNode } from '../graph'
import { PEDAL, PHASING } from '../params'
import { createCore, type LayerFactory, noMode } from './core'
import { createGovernor } from './governor'
import { createMusicChain } from './music'
import { createPad } from './pad'

export const createPhasing: LayerFactory = (ctx, dest, bufs, opts) => {
  const core = createCore(ctx, dest, opts)
  const chain = createMusicChain(core, bufs('ir'), PHASING.tone, opts, PEDAL.tone)
  const pad = createPad(core, chain.padInput!)
  const { rng } = opts
  const next = PHASING.voices.map(() => Number.POSITIVE_INFINITY)
  // 几个声部恰好同时落下时调轻一点，组合的变化仍然听得见，只是不会突然变响
  const govern = createGovernor({
    tau: PHASING.governorTau,
    meanGap: 1 / PHASING.voices.reduce((s, v) => s + 1 / v.period, 0),
    meanPower: 1,
    floor: PHASING.governorFloor,
  })
  const noteGain = dbToGain(PHASING.noteDb)

  function note(i: number, t: number): void {
    // 休止前后按密度跳过一些音；周期照走，回来时各声部的相位关系不变
    if (rng() >= chain.density(t)) return
    const voice = PHASING.voices[i]!
    const buffer = bufs(epAsset(voice.midi))
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const velocity = govern(t, dbToGain((rng() * 2 - 1) * PHASING.velocityJitterDb))
    const g = gainNode(ctx, velocity * noteGain)
    const pan = panNode(ctx, voice.pan)
    src.connect(g).connect(pan).connect(chain.input)
    core.play(src, [g, pan], t, t + buffer.duration)
  }

  return {
    start(at, quick) {
      const k = quick ? PHASING.quickScale : 1
      PHASING.voices.forEach((v, i) => {
        next[i] = at + v.offset * k
      })
      pad.start(at)
      for (const v of PHASING.pedal) pad.noteOn(v, at, quick ? PEDAL.quickIn : PEDAL.fadeIn)
    },
    schedule(until) {
      if (core.stopped) return
      PHASING.voices.forEach((v, i) => {
        for (let t = next[i]!; t < until; t += v.period) {
          note(i, t)
          next[i] = t + v.period
        }
      })
      chain.schedule(until)
    },
    breath: chain.breath,
    freeRun: chain.freeRun,
    level: chain.level,
    hold: chain.hold,
    setMode: noMode,
    stop: core.stop,
    dispose: core.dispose,
  }
}
