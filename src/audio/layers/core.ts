/**
 * 声音层的公共部分：节点登记与回收。
 *
 * 每一层都可能在一次练习里被换掉好几次，试听更是频繁创建、销毁；任何没断开的节点都会一直占着音频线程。
 * 所以层里创建的每个节点都在这里登记：会自己结束的声音（音符、雨滴、鸟鸣）结束时立刻断开，
 * 常驻节点（滤波、混响、输出）在层停下后由一个哨兵源的 ended 事件统一断开。
 */
import type { Segment } from '@/engine/types'
import type { AssetName } from '../dsp/assets'
import { disconnectAll, gainNode, quietly } from '../graph'
import type { RestPlan } from '../rests'
import type { SoundMode } from '../types'

export interface Layer {
  /** at 时刻开始；quick 用于试听和练习中途切换：跳过长的引入，几秒内就听得到 */
  start(at: number, quick?: boolean): void
  /** 把自己的音符、和弦、随机事件和慢速起伏排到 until */
  schedule(until: number): void
  /** 跟随节拍：这一段吸或呼期间的起伏 */
  breath(seg: Segment, at: number): void
  /** 不跟节拍：按自己的慢周期起伏到 until */
  freeRun(now: number, until: number): void
  /** at 时刻直接到 y 对应的状态；中途加入的层先用它对齐当前的呼吸位置 */
  level(y: number, at: number): void
  /** 撤销 at 以后排过的呼吸起伏，停在当时的值；之后再排的从这里接着走 */
  hold(at: number): void
  /** 换模式：睡前没有鸟声、和声更慢、起音更稀 */
  setMode(mode: SoundMode): void
  /** at 时刻停下（调用方应已把它淡出），之后断开全部节点 */
  stop(at: number): void
  /** 立刻断开全部节点；只在听不见时用（音频环境已挂起、或增益已为 0） */
  dispose(): void
}

export interface LayerOptions {
  /** 随机数：正式播放用 Math.random，离线质检用固定种子，结果可复现 */
  rng: () => number
  /** 跟随呼吸时每隔多少秒取一个点 */
  breathStep: number
  mode: SoundMode
  /** 音乐的中间休止；声景不用 */
  rests?: RestPlan | null
  /** 层的全部节点都断开之后调用；引擎借此回收层外面的节点和素材占用 */
  onDisposed?: () => void
  /** 质检用：层把内部的某一路（如鸟鸣）交出来，离线渲染时可以单独静音、比较 */
  inspect?: (name: string, node: GainNode) => void
}

/** 取一个已生成的素材；层只在素材齐全时创建，所以取不到是编程错误 */
export type Buffers = (name: AssetName) => AudioBuffer

export type LayerFactory = (
  ctx: BaseAudioContext,
  dest: AudioNode,
  bufs: Buffers,
  opts: LayerOptions,
) => Layer

interface Voice {
  src: AudioScheduledSourceNode
  nodes: readonly AudioNode[]
  at: number
  until: number
  /** 回收时额外要做的事，比如断开从常驻节点连到它参数上的线 */
  cleanup?: () => void
}

export interface LayerCore {
  readonly ctx: BaseAudioContext
  /** 层的输出 */
  readonly out: GainNode
  readonly stopped: boolean
  /** 登记常驻节点，层停下后统一断开 */
  keep<T extends AudioNode>(node: T): T
  /**
   * 登记一个声音：src 在 at 开始、until（不填则一直到层停下或调用返回的函数）结束，结束后断开它和 nodes。
   * 返回的函数让它在给定时刻停下（长音换和弦时用）
   */
  play(
    src: AudioScheduledSourceNode,
    nodes: readonly AudioNode[],
    at: number,
    until?: number,
    cleanup?: () => void,
  ): (at: number) => void
  /** 循环播放一段素材，从随机位置开始，循环接缝落在不同时刻 */
  loop(buffer: AudioBuffer, dest: AudioNode, at: number, rng: () => number): AudioBufferSourceNode
  stop(at: number): void
  dispose(): void
}

export function createCore(
  ctx: BaseAudioContext,
  dest: AudioNode,
  opts: Pick<LayerOptions, 'onDisposed'> = {},
): LayerCore {
  const out = gainNode(ctx, 1)
  out.connect(dest)
  const kept: AudioNode[] = [out]
  const voices = new Set<Voice>()
  let stopped = false
  let disposed = false

  function release(v: Voice): void {
    voices.delete(v)
    v.src.onended = null
    quietly(() => v.src.disconnect())
    disconnectAll(v.nodes)
    if (v.cleanup) quietly(v.cleanup)
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    stopped = true
    for (const v of [...voices]) {
      quietly(() => v.src.stop())
      release(v)
    }
    disconnectAll(kept)
    kept.length = 0
    opts.onDisposed?.()
  }

  return {
    ctx,
    out,
    get stopped() {
      return stopped
    },
    keep(node) {
      kept.push(node)
      return node
    },
    play(src, nodes, at, until, cleanup) {
      if (stopped) {
        // 层已经停下还来的音符：不出声，直接回收
        quietly(() => src.disconnect())
        disconnectAll(nodes)
        if (cleanup) quietly(cleanup)
        return () => {}
      }
      const v: Voice = { src, nodes, at, until: until ?? Number.POSITIVE_INFINITY, cleanup }
      voices.add(v)
      src.onended = () => release(v)
      src.start(at)
      if (until !== undefined) src.stop(until)
      return end => {
        if (!voices.has(v) || end >= v.until) return
        v.until = end
        quietly(() => src.stop(Math.max(end, v.at)))
      }
    },
    loop(buffer, to, at, rng) {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      src.connect(to)
      // 起点取在整数个采样上，循环接缝之外不引入额外的插值
      const offset = Math.floor(rng() * buffer.length) / buffer.sampleRate
      const v: Voice = { src, nodes: [], at, until: Number.POSITIVE_INFINITY }
      voices.add(v)
      src.onended = () => release(v)
      src.start(at, offset)
      return src
    },
    stop(at) {
      if (stopped) return
      stopped = true
      for (const v of [...voices]) {
        // 还没开始的声音不必等，立刻回收
        if (v.at >= at) {
          quietly(() => v.src.stop())
          release(v)
        } else if (v.until > at) quietly(() => v.src.stop(at))
      }
      // 哨兵：常驻节点要等到停止时刻过后才能断开，否则淡出的尾巴会被截断
      const sentinel = ctx.createConstantSource()
      sentinel.offset.value = 0
      sentinel.connect(out)
      sentinel.onended = () => {
        quietly(() => sentinel.disconnect())
        dispose()
      }
      sentinel.start(Math.min(at, ctx.currentTime))
      sentinel.stop(Math.max(at, ctx.currentTime) + 0.05)
    },
    dispose,
  }
}

/** 层里没有呼吸起伏可撤、也不分模式时，用这两个空实现 */
export const noHold = (): void => {}
export const noMode = (): void => {}
