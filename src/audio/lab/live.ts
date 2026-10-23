/**
 * 实时冒烟检查：在真的 AudioContext 里把会话引擎会用到的 AudioPort 调用走一遍，
 * 听输出端（一个分析器）是不是在该响的时候响、该静的时候静。
 * 离线质检测的是声音本身；这里测的是引擎的时序：前瞻排程、暂停挂起、换声音、结尾淡出被取代、撤销、试听，
 * 系统停掉音频环境（锁屏、来电）之后回来时的淡入，以及上一次留下的结束钟声不落进下一次。
 */
import { segment } from '../automation'
import type { BufferStore } from '../buffers'
import { CUE_ASSETS } from '../dsp/assets'
import { createAudioEngine } from '../engine'
import { layerAssets } from '../layers'
import { bellStrikes } from '../levels'
import type { SoundMix } from '../types'

/** 听得见的下限与「静」的上限（dBFS，按 43 毫秒的 RMS） */
const AUDIBLE = -55
const SILENT = -80
/**
 * 回来后 0.1–0.25 秒里至少比稳定电平低这么多 dB，才算在淡入（1.5 秒的缓入缓出此时约 −24 dB；硬切约 0 dB）。
 * 头 0.1 秒不看：音频环境停着时分析器留着停下前最后 2048 个采样，回来后要过 43 毫秒才被新的采样冲掉
 */
const FADING_IN = -12
const STALE_MS = 100
/** 钟声后一击的时刻前后，电平最多抬高这么多 dB（真敲了一击会抬高十几 dB；余音只会更低） */
const NO_STRIKE = 3

export interface LiveStep {
  name: string
  ok: boolean
  /** 测到的电平（dBFS）或状态 */
  value: number | string | boolean
  expect: string
}

export interface LiveResult {
  ok: boolean
  steps: LiveStep[]
}

/** 输出先进一个分析器再到扬声器：引擎照常连 destination，连到的其实是分析器 */
function tappedContext(): { ctx: AudioContext; levelDb: () => number } {
  const ctx = new AudioContext({ latencyHint: 'playback' })
  const tap = ctx.createAnalyser()
  tap.fftSize = 2048
  tap.connect(ctx.destination)
  Object.defineProperty(ctx, 'destination', { get: () => tap })
  const buf = new Float32Array(tap.fftSize)
  return {
    ctx,
    levelDb() {
      tap.getFloatTimeDomainData(buf)
      let s = 0
      for (const v of buf) s += v * v
      return 10 * Math.log10(s / buf.length + 1e-20)
    },
  }
}

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

export async function liveCheck(store: BufferStore): Promise<LiveResult> {
  const { ctx, levelDb } = tappedContext()
  const engine = createAudioEngine({ store, createContext: () => ctx, visibility: null })
  const steps: LiveStep[] = []
  const check = (name: string, ok: boolean, value: number | string | boolean, expect: string): void => {
    steps.push({ name, ok, value: typeof value === 'number' ? Math.round(value * 10) / 10 : value, expect })
  }
  /** ms 毫秒里的最大电平 */
  const peak = async (ms: number): Promise<number> => {
    let m = Number.NEGATIVE_INFINITY
    for (const t0 = performance.now(); performance.now() - t0 < ms; await sleep(20))
      m = Math.max(m, levelDb())
    return m
  }
  /** ms 毫秒里的平均功率（dB） */
  const mean = async (ms: number): Promise<number> => {
    let s = 0
    let n = 0
    for (const t0 = performance.now(); performance.now() - t0 < ms; await sleep(20)) {
      s += 10 ** (levelDb() / 10)
      n++
    }
    return 10 * Math.log10(s / Math.max(1, n))
  }
  const audible = async (name: string, ms: number): Promise<void> => {
    const v = await peak(ms)
    check(name, v > AUDIBLE, v, `> ${AUDIBLE} dBFS`)
  }
  const silent = async (name: string, ms: number): Promise<void> => {
    const v = await peak(ms)
    check(name, v < SILENT, v, `< ${SILENT} dBFS`)
  }
  const bed: SoundMix = { ambience: 'rain', music: 'drone', ambienceVolume: 55, musicVolume: 45 }

  try {
    const unlocked = await engine.unlock()
    check('解锁', unlocked && engine.state() === 'running', engine.state(), 'running')
    // 素材先备好：这里测时序，不测「素材晚到」
    await store.load(
      [
        ...layerAssets('rain'),
        ...layerAssets('drone'),
        ...layerAssets('ocean'),
        ...layerAssets('stream'),
        ...CUE_ASSETS,
      ],
      ctx.sampleRate,
    )
    await store.load(['ir'], ctx.sampleRate)
    await silent('开始前静音', 300)

    engine.startBed(bed, engine.now() + 0.05, 0.4, 120)
    await sleep(1200)
    await audible('背景声淡入后', 600)
    const t = engine.now()
    engine.breath(segment('in', 0, 1, 2), t)
    engine.breath(segment('out', 1, 0, 2), t + 2)

    const before = await mean(600)
    engine.setDuck(true)
    await sleep(700)
    const ducked = await mean(600)
    check('人声压低', before - ducked > 5, before - ducked, '约 8 dB')
    engine.setDuck(false)
    await sleep(1700)

    await engine.suspend()
    check('暂停后挂起', engine.state() === 'suspended', engine.state(), 'suspended')
    await engine.resume()
    check('继续', engine.state() === 'running', engine.state(), 'running')
    await sleep(1600)
    await audible('继续后淡回', 500)

    // 系统先停了音频环境（iOS 锁屏、来电），会话随后才暂停：继续时同样淡入，不能以原电平一下子回来
    const steady = await mean(400)
    await ctx.suspend()
    await engine.suspend()
    await sleep(200)
    await engine.resume()
    await sleep(STALE_MS)
    const resumed = (await peak(150)) - steady
    check('系统中断后继续淡入', resumed < FADING_IN, resumed, `0.1–0.25 秒 < ${FADING_IN} dB`)
    await sleep(1600)
    // 系统停掉又自己恢复，会话没有暂停（比如结束钟声还在响）：引擎自己淡入
    await ctx.suspend()
    await sleep(200)
    await ctx.resume()
    await sleep(STALE_MS)
    const recovered = (await peak(150)) - steady
    check('系统自行恢复时淡入', recovered < FADING_IN, recovered, `0.1–0.25 秒 < ${FADING_IN} dB`)
    await sleep(1600)
    await audible('中断之后淡回', 500)

    engine.changeBed({ ambience: 'ocean', music: 'none' })
    await sleep(2200)
    await audible('换声音之后', 500)

    // 先排一个 3 秒的淡出，0.5 秒后改成 0.5 秒：应当照新的那次很快静下来
    engine.fadeBedOut(engine.now(), 3)
    await sleep(500)
    engine.fadeBedOut(engine.now(), 0.5)
    await sleep(900)
    await silent('结尾淡出被新的一次取代', 400)
    engine.stopBed(0.3)
    await sleep(400)

    engine.cue('in')
    await audible('提示音', 400)
    await sleep(1600)
    await silent('提示音响完', 300)

    const glide = engine.glide(segment('in', 0, 1, 3), engine.now() + 0.05)
    await sleep(700)
    await audible('滑音', 300)
    engine.cancelScheduled()
    await sleep(700)
    await silent('撤销后滑音淡出', 300)
    glide.cancel()

    const bell = engine.bell('end', engine.now() + 0.05)
    await audible('结束钟声第一击', 500)
    bell.cancel()
    await sleep(300)
    await silent('撤销钟声（含还没响的两击）', 400)

    let changes = 0
    const off = engine.onPreviewChange(() => {
      changes++
    })
    engine.preview({ ambience: 'stream', music: 'none', ambienceVolume: 55, musicVolume: 45 }, 4)
    check(
      '试听中',
      engine.previewing()?.ambience === 'stream',
      engine.previewing()?.ambience ?? 'null',
      'stream',
    )
    await sleep(1200)
    await audible('试听出声', 500)
    engine.stopPreview()
    check('停止试听', engine.previewing() === null && changes === 2, changes, '两次通知')
    off()
    await sleep(600)
    await silent('试听停止后', 300)

    // 到点结束时结束钟声留着响完；紧接着试听或开始下一次的话，它还没敲的几击不能落进来，正在响的那一击自然消失
    const second = bellStrikes('end')[1]?.[0] ?? 7
    const quiet: SoundMix = { ambience: 'stream', music: 'none', ambienceVolume: 0, musicVolume: 0 }
    const next: [string, () => void][] = [
      ['试听', () => engine.preview(quiet, 30)],
      ['新的一次', () => engine.startBed({ ...quiet, ambience: 'none' }, engine.now() + 0.05, 1)],
    ]
    for (const [name, start] of next) {
      const t0 = engine.now() + 0.05
      engine.bell('end', t0)
      await sleep(800)
      start()
      while (engine.now() < t0 + second - 0.6) await sleep(20)
      const before = await peak(400)
      while (engine.now() < t0 + second + 0.05) await sleep(10)
      const jump = (await peak(500)) - before
      check(`结束钟声不落进${name}`, jump < NO_STRIKE, jump, `后一击没响：< ${NO_STRIKE} dB`)
      engine.stopPreview()
      engine.stopBed(0.1)
      // 这一轮要是没撤掉，第三击（14 秒）会落进下一轮的参照窗口，下一轮就测不准了
      engine.cancelScheduled()
    }
  } catch (err) {
    check('没有异常', false, String(err), '')
  } finally {
    engine.dispose()
    check('销毁', engine.state() === 'closed', engine.state(), 'closed')
  }
  return { ok: steps.every(s => s.ok), steps }
}
