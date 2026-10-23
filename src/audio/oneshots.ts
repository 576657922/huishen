/**
 * 单次音（提示音、钟声）的播放与撤销。
 * 一次「声音」可以有几击（结束钟声是三击）；撤销时还没响的直接取消，已经在响的快速淡出，不留咔哒声。
 */
import { quietly } from './graph'
import type { Scheduled } from './types'

/** 已经在响的声音被撤销时，淡出的秒数 */
const CANCEL_FADE = 0.06

interface Strike {
  src: AudioBufferSourceNode
  gain: GainNode
  at: number
  end: number
}

export interface OneShots {
  /** strikes：每一击相对 at 的秒数和增益（线性） */
  play(buffer: AudioBuffer, at: number, strikes: readonly (readonly [number, number])[]): Scheduled
  /** 撤销所有还没开始响的声音；正在响的照常响完 */
  cancelPending(): void
  /** 最后一个声音响完的时刻；用来判断什么时候可以挂起音频环境 */
  busyUntil(): number
  /** 立刻断开全部（只在听不见时用） */
  dispose(): void
}

export function createOneShots(ctx: BaseAudioContext, dest: AudioNode, onIdle?: () => void): OneShots {
  const live = new Set<Strike>()

  function release(s: Strike): void {
    if (!live.delete(s)) return
    s.src.onended = null
    quietly(() => s.src.disconnect())
    quietly(() => s.gain.disconnect())
    if (!live.size) onIdle?.()
  }

  function cancelStrike(s: Strike): void {
    const now = ctx.currentTime
    if (s.at > now) {
      quietly(() => s.src.stop())
      release(s)
      return
    }
    const g = s.gain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(0, now + CANCEL_FADE)
    quietly(() => s.src.stop(now + CANCEL_FADE + 0.01))
  }

  return {
    play(buffer, at, strikes) {
      const mine: Strike[] = strikes.map(([offset, level]) => {
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = level
        src.connect(gain).connect(dest)
        const start = at + offset
        const s: Strike = { src, gain, at: start, end: start + buffer.duration }
        src.onended = () => release(s)
        src.start(start)
        live.add(s)
        return s
      })
      return {
        cancel() {
          for (const s of mine) if (live.has(s)) cancelStrike(s)
        },
      }
    },
    cancelPending() {
      const now = ctx.currentTime
      for (const s of [...live]) if (s.at > now) cancelStrike(s)
    },
    busyUntil() {
      let end = 0
      for (const s of live) end = Math.max(end, s.end)
      return end
    },
    dispose() {
      for (const s of [...live]) {
        quietly(() => s.src.stop())
        release(s)
      }
    },
  }
}
