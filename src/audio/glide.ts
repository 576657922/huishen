/**
 * 节拍提示「木音」：吸、补吸、呼开始时各一声短音，屏息和停顿安静。
 * 与用户试听的合成木音使用相同的频率、分音、8 ms 起音和 60 ms 衰减。
 * glide 的端口与偏好键保留，旧设置直接沿用新声音。
 */
import type { PhaseKey, Segment } from '@/engine/types'
import { momentaryMax } from './dsp/analysis'
import { soft } from './dsp/cues'
import { dbToGain } from './dsp/util'
import { createOneShots } from './oneshots'
import { ONESHOT_LUFS, TIMING, WOOD_CUE } from './params'
import type { Scheduled } from './types'

export interface Glides {
  play(seg: Segment, at: number): Scheduled
  cancelAll(): void
  busyUntil(): number
  dispose(): void
}

const NOOP: Scheduled = { cancel() {} }
type WoodPhase = Extract<PhaseKey, 'in' | 'in2' | 'out'>

export function createGlides(ctx: BaseAudioContext, dest: AudioNode, level: () => number): Glides {
  const shots = createOneShots(ctx, dest)
  const buffers = new Map<WoodPhase, AudioBuffer>()
  const scheduled = new Map<Scheduled, number>()

  function prune(): void {
    for (const [handle, end] of scheduled) if (end <= ctx.currentTime) scheduled.delete(handle)
  }

  function bufferFor(key: WoodPhase): AudioBuffer {
    const cached = buffers.get(key)
    if (cached) return cached
    const samples = soft(
      ctx.sampleRate,
      WOOD_CUE.frequencies[key],
      WOOD_CUE.attack,
      WOOD_CUE.decay,
      WOOD_CUE.partials,
    )
    // 单声道会在左右各播放一次；按双声道瞬时响度归一，再交给提示音和总音量母线。
    const gain = dbToGain(ONESHOT_LUFS - momentaryMax([samples, samples], ctx.sampleRate))
    for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! * gain
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate)
    buffer.getChannelData(0).set(samples)
    buffers.set(key, buffer)
    return buffer
  }

  return {
    play(seg, at) {
      prune()
      if (!(seg.dur > 0) || (seg.key !== 'in' && seg.key !== 'in2' && seg.key !== 'out')) return NOOP
      // 迟到的转换提示会误导吸呼，不能补响。
      if (at < ctx.currentTime - TIMING.lateCue) return NOOP
      const buffer = bufferFor(seg.key)
      const start = Math.max(at, ctx.currentTime)
      const handle = shots.play(buffer, start, [[0, level()]])
      scheduled.set(handle, start + buffer.duration)
      return {
        cancel() {
          if (!scheduled.delete(handle)) return
          handle.cancel()
        },
      }
    },
    cancelAll() {
      prune()
      for (const handle of scheduled.keys()) handle.cancel()
      scheduled.clear()
    },
    busyUntil: () => shots.busyUntil(),
    dispose() {
      shots.dispose()
      scheduled.clear()
      buffers.clear()
    },
  }
}
