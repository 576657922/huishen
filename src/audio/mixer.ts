/**
 * 混音台与输出链：
 *
 *   ambience ─┐
 *   music ────┴─ 压低（有人声时）─── 暂停淡出 ─┐
 *   cues（提示音、钟声、滑音）──────── 暂停淡出 ─┴─ 模式音色（睡前 −5 dB、3 kHz 低通、高架；全部滤掉 38 Hz 以下）
 *     ─ 动态处理（柔和压缩 + 真峰值限幅，AudioWorklet；不支持时用两个 DynamicsCompressorNode）
 *     ─ master ─ destination
 *
 * master 在限幅器之后：限幅器总在「总音量 100」的电平上工作，调小总音量不改变它的行为，输出的真峰值也只会更低。
 * 限幅器模块异步载入（worklet/load.ts）：没载入时先用后备的压缩器，载入后两条路交叉淡变换过去，不会咔哒。
 */
import { createTrack, type Track } from './automation'
import { dbToGain } from './dsp/util'
import { biquadNode, disconnectAll, gainNode, glideExp, glideLinear, quietly } from './graph'
import { volumeGain } from './levels'
import { DEFAULT_VOLUMES, DUCK, DYNAMICS, FADES, FALLBACK_DYNAMICS, MODE } from './params'
import type { Bus, SoundMode } from './types'
import { LIMITER_PROCESSOR, type LimiterMessage } from './worklet/protocol'

export type BusName = Exclude<Bus, 'master'>

/** worklet：真峰值限幅器；fallback：浏览器自带的压缩器；none：不处理（质检看限幅之前的信号） */
export type DynamicsKind = 'worklet' | 'fallback' | 'none'

/** DynamicsCompressorNode 自带的补偿增益（dB），按 Web Audio 规范的公式、硬拐点计算 */
export function compressorMakeupDb(threshold: number, ratio: number): number {
  const fullRangeDb = threshold * (1 - 1 / ratio)
  return -0.6 * fullRangeDb
}

export interface DynamicsStats {
  /** 自上次读取以来压缩、限幅的最大衰减（dB） */
  compDb: number
  limitDb: number
}

/** 暂停、继续时两组声音各自的淡变秒数 */
export interface TransportFade {
  bed: number
  cues: number
}

export interface Mixer {
  readonly ctx: BaseAudioContext
  /** 各母线的输入 */
  readonly buses: Readonly<Record<BusName, GainNode>>
  setVolume(bus: Bus, volume: number): void
  volume(bus: Bus): number
  setDuck(on: boolean): void
  /** 换模式音色；ramp 秒过渡 */
  setMode(mode: SoundMode, ramp?: number): void
  mode(): SoundMode
  /** 暂停时淡出、继续时淡入：两组声音从当前值走到 level，返回都走完的时刻 */
  transport(level: number, dur: TransportFade): number
  /**
   * 两组声音此刻直接跳到 level，不渐变。只在听不见时用：音频环境已被系统停掉、时钟不走，
   * 跳变落在下一次出声之前；之后继续时再用 transport 从这里淡入
   */
  transportNow(level: number): void
  /** 现在用的动态处理 */
  dynamics(): DynamicsKind
  /** 换上 Worklet 限幅器（模块须已载入）；成功返回 true */
  switchToWorklet(): boolean
  /** Worklet 报来的最大衰减（质检用）；读后清零 */
  takeStats(): DynamicsStats
  dispose(): void
}

export interface MixerOptions {
  volumes?: Partial<Record<Bus, number>>
  mode?: SoundMode
  /** 开始时的动态处理，默认 fallback；worklet 要求模块已经载入，建不成时退回 fallback */
  dynamics?: DynamicsKind
  /** 平滑音量变化的秒数 */
  smooth?: number
  /** Worklet 每隔多少秒报一次压缩、限幅量；0 为不报 */
  statsEvery?: number
}

interface DynPath {
  kind: DynamicsKind
  /** dynIn 直接连着的第一个节点：换路时要从 dynIn 上单独断开它 */
  head: AudioNode
  nodes: AudioNode[]
  out: GainNode
}

export function createMixer(ctx: BaseAudioContext, options: MixerOptions = {}): Mixer {
  const smooth = options.smooth ?? FADES.volume
  const t0 = ctx.currentTime
  const nyquist = ctx.sampleRate / 2
  const volumes: Record<Bus, number> = { ...DEFAULT_VOLUMES, ...options.volumes }
  let mode: SoundMode = options.mode ?? 'relax'
  const nodes: AudioNode[] = []
  const keep = <T extends AudioNode>(n: T): T => {
    nodes.push(n)
    return n
  }

  const buses: Record<BusName, GainNode> = {
    ambience: keep(gainNode(ctx, 1)),
    music: keep(gainNode(ctx, 1)),
    cues: keep(gainNode(ctx, 1)),
  }
  const duck = keep(gainNode(ctx, 1))
  const bedTransport = keep(gainNode(ctx, 1))
  const cueTransport = keep(gainNode(ctx, 1))
  const tone = MODE[mode]
  const modeGain = keep(gainNode(ctx, dbToGain(tone.gainDb)))
  const hp = keep(biquadNode(ctx, 'highpass', MODE.highpass, Math.SQRT1_2))
  const lp = keep(biquadNode(ctx, 'lowpass', Math.min(tone.lowpass, nyquist), Math.SQRT1_2))
  const shelf = keep(biquadNode(ctx, 'highshelf', MODE.shelfHz, Math.SQRT1_2, tone.shelfDb))
  const dynIn = keep(gainNode(ctx, 1))
  const dynOut = keep(gainNode(ctx, 1))
  const master = keep(gainNode(ctx, 1))

  buses.ambience.connect(duck)
  buses.music.connect(duck)
  duck.connect(bedTransport).connect(modeGain)
  buses.cues.connect(cueTransport).connect(modeGain)
  modeGain.connect(hp).connect(lp).connect(shelf).connect(dynIn)
  dynOut.connect(master).connect(ctx.destination)

  const tracks: Record<Bus, Track> = {
    master: createTrack(master.gain, volumeGain(volumes.master, 'master'), t0),
    ambience: createTrack(buses.ambience.gain, volumeGain(volumes.ambience, 'ambience'), t0),
    music: createTrack(buses.music.gain, volumeGain(volumes.music, 'music'), t0),
    cues: createTrack(buses.cues.gain, volumeGain(volumes.cues, 'cues'), t0),
  }
  const duckTrack = createTrack(duck.gain, 1, t0)
  const bedTrack = createTrack(bedTransport.gain, 1, t0)
  const cueTrack = createTrack(cueTransport.gain, 1, t0)
  const stats: DynamicsStats = { compDb: 0, limitDb: 0 }

  function fallbackPath(): DynPath {
    const { compressor: c, limiter: l } = FALLBACK_DYNAMICS
    const stage = (p: typeof c | typeof l): [DynamicsCompressorNode, GainNode] => {
      const node = ctx.createDynamicsCompressor()
      node.threshold.value = p.threshold
      node.knee.value = p.knee
      node.ratio.value = p.ratio
      node.attack.value = p.attack
      node.release.value = p.release
      // 规范要求压缩器自带补偿增益，不压缩时也会把整体抬高几 dB；每一级之后马上抵消，
      // 下一级看到的才是原来的电平，平时音量下这条路完全透明
      const unmakeup = gainNode(ctx, dbToGain(-compressorMakeupDb(p.threshold, p.ratio)))
      node.connect(unmakeup)
      return [node, unmakeup]
    }
    const [comp, compOut] = stage(c)
    const [lim, limOut] = stage(l)
    const out = gainNode(ctx, 1)
    dynIn.connect(comp)
    compOut.connect(lim)
    limOut.connect(out).connect(dynOut)
    return { kind: 'fallback', head: comp, nodes: [comp, compOut, lim, limOut], out }
  }

  function workletPath(): DynPath | null {
    let node: AudioWorkletNode
    try {
      node = new AudioWorkletNode(ctx, LIMITER_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
        processorOptions: { ...DYNAMICS, statsEvery: options.statsEvery ?? 0 },
      })
    } catch {
      return null
    }
    node.port.onmessage = (e: MessageEvent<LimiterMessage>) => {
      const m = e.data
      if (m?.type !== 'stats') return
      stats.compDb = Math.max(stats.compDb, m.compDb)
      stats.limitDb = Math.max(stats.limitDb, m.limitDb)
    }
    const out = gainNode(ctx, 1)
    dynIn.connect(node).connect(out).connect(dynOut)
    return { kind: 'worklet', head: node, nodes: [node], out }
  }

  function plainPath(): DynPath {
    const out = gainNode(ctx, 1)
    dynIn.connect(out).connect(dynOut)
    return { kind: 'none', head: out, nodes: [], out }
  }

  function closePath(p: DynPath): void {
    for (const n of p.nodes) {
      if (typeof AudioWorkletNode === 'function' && n instanceof AudioWorkletNode) n.port.onmessage = null
    }
    quietly(() => dynIn.disconnect(p.head))
    disconnectAll([...p.nodes, p.out])
  }

  function initialPath(): DynPath {
    const want = options.dynamics ?? 'fallback'
    if (want === 'none') return plainPath()
    return (want === 'worklet' ? workletPath() : null) ?? fallbackPath()
  }

  let path = initialPath()
  /** 刚换下、还在淡出的旧路：淡完再断开；销毁时一起断开 */
  let retired: DynPath | null = null
  let swapTimer: ReturnType<typeof setTimeout> | null = null

  return {
    ctx,
    buses,
    setVolume(bus, v) {
      if (!Number.isFinite(v)) return
      volumes[bus] = Math.max(0, Math.min(100, v))
      const now = ctx.currentTime
      // 拖动滑块时每次只平滑几十毫秒，既不拉链也不迟钝
      tracks[bus].glide(volumeGain(volumes[bus], bus), now, now + smooth, q => q, 1)
      tracks[bus].forget(now - 1)
    },
    volume: bus => volumes[bus],
    setDuck(on) {
      const now = ctx.currentTime
      const target = on ? dbToGain(DUCK.depthDb) : 1
      duckTrack.glide(target, now, now + (on ? DUCK.attack : DUCK.release), undefined, 8)
      duckTrack.forget(now - 1)
    },
    setMode(next, ramp = MODE.ramp) {
      if (next === mode) return
      mode = next
      const t = MODE[next]
      const now = ctx.currentTime
      glideLinear(modeGain.gain, dbToGain(t.gainDb), now, ramp)
      glideExp(lp.frequency, Math.min(t.lowpass, nyquist), now, ramp)
      glideLinear(shelf.gain, t.shelfDb, now, ramp)
    },
    mode: () => mode,
    transport(level, dur) {
      const now = ctx.currentTime
      let end = now
      for (const [track, d] of [
        [bedTrack, dur.bed],
        [cueTrack, dur.cues],
      ] as const) {
        const t1 = now + Math.max(FADES.minStop, d)
        track.glide(level, now, t1, undefined, 12)
        track.forget(now - 1)
        end = Math.max(end, t1)
      }
      return end
    },
    transportNow(level) {
      const now = ctx.currentTime
      for (const track of [bedTrack, cueTrack]) {
        track.set(level, now)
        track.forget(now - 1)
      }
    },
    dynamics: () => path.kind,
    switchToWorklet() {
      if (path.kind === 'worklet') return true
      const next = workletPath()
      if (!next) return false
      const old = path
      path = next
      const now = ctx.currentTime
      // 两条路的延迟差几毫秒，交叉淡变几十毫秒，听不出梳状滤波
      next.out.gain.setValueAtTime(0, now)
      next.out.gain.linearRampToValueAtTime(1, now + FADES.swap)
      old.out.gain.setValueAtTime(1, now)
      old.out.gain.linearRampToValueAtTime(0, now + FADES.swap)
      retired = old
      swapTimer = setTimeout(
        () => {
          swapTimer = null
          retired = null
          closePath(old)
        },
        FADES.swap * 1000 + 200,
      )
      return true
    },
    takeStats() {
      const s = { ...stats }
      stats.compDb = 0
      stats.limitDb = 0
      return s
    },
    dispose() {
      if (swapTimer) clearTimeout(swapTimer)
      if (retired) closePath(retired)
      closePath(path)
      disconnectAll(nodes)
    },
  }
}
