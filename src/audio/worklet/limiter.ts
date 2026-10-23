/**
 * 输出端的动态处理（AudioWorklet）：柔和的安全压缩 → 4 倍过采样、预读 5 ms 的真峰值限幅，上限 −3 dBTP。
 * 算法全在 dsp/dynamics.ts（纯函数，Node 里有单元测试），这里只是把它接到音频线程上。
 *
 * 这个文件由 Vite 按 Worker 单独打包成一个不含 import 的脚本（见 load.ts 的 `?worker&url`），
 * 正式播放的 AudioContext 和离线质检的 OfflineAudioContext 载入的是同一个文件。
 */
import { createDynamics, type Dynamics, type DynamicsParams } from '../dsp/dynamics'
import { LIMITER_PROCESSOR, type LimiterMessage } from './protocol'

/* AudioWorkletGlobalScope 里的全局名字；TypeScript 的 DOM 库里没有它们 */
declare const sampleRate: number
declare function registerProcessor(name: string, ctor: new (options: ProcessorOptions) => Processor): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

interface ProcessorOptions {
  processorOptions?: Partial<DynamicsParams> & { statsEvery?: number }
}

interface Processor {
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean
}

/** 参数缺失或不合理时的保守值：宁可多压一点，也不让峰值越过上限 */
const SAFE: DynamicsParams = {
  threshold: -12,
  ratio: 2,
  knee: 6,
  attack: 0.03,
  release: 0.5,
  ceiling: -3,
  lookahead: 0.005,
  limitRelease: 0.15,
}

function paramsOf(raw: Partial<DynamicsParams> | undefined): DynamicsParams {
  const out = { ...SAFE }
  for (const key of Object.keys(SAFE) as (keyof DynamicsParams)[]) {
    const v = raw?.[key]
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v
  }
  return out
}

class LimiterProcessor extends AudioWorkletProcessor implements Processor {
  private readonly dyn: Dynamics
  /** 每隔这么多个采样把压缩、限幅的最大衰减报给主线程（质检用）；0 为不报 */
  private readonly statsEvery: number
  private sinceStats = 0

  constructor(options: ProcessorOptions) {
    super()
    this.dyn = createDynamics(sampleRate, 2, paramsOf(options.processorOptions))
    this.statsEvery = Math.max(0, Math.round((options.processorOptions?.statsEvery ?? 0) * sampleRate))
    this.post({ type: 'ready', latency: this.dyn.latency })
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0]
    if (!out?.length) return true
    this.dyn.process(inputs[0] ?? [], out, out[0]!.length)
    if (this.statsEvery > 0) {
      this.sinceStats += out[0]!.length
      if (this.sinceStats >= this.statsEvery) {
        this.sinceStats = 0
        this.post({ type: 'stats', ...this.dyn.takeStats() })
      }
    }
    // 一直处理：输入暂时静音时，预读延迟线里还有尾巴要送出去
    return true
  }

  private post(msg: LimiterMessage): void {
    this.port.postMessage(msg)
  }
}

registerProcessor(LIMITER_PROCESSOR, LimiterProcessor)
