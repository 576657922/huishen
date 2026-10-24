/**
 * 节拍提示「柔音」：固定音高的温和长音，仅音量随吸呼缓慢起伏；不扫频、不颤音。
 * 吸气渐强、呼气渐弱，第二口吸气接着渐强；屏息、停的段不出声。
 * 保留 glide 的内部名称，已保存的偏好与计划会直接使用新声音，无需迁移。
 *
 * 前一段刚结束、下一段紧接着开始时，两段连成一个音，转折处不断开；中间隔着屏息时，各自起音、收音。
 * 撤销（cancelScheduled）时，还没开始的不再响，正在响的从当时的音量慢慢淡出；
 * 如果紧接着又从同一时刻排了一段（会话「有点急」重排节拍时就是这样），就把这个音接回来继续起伏，
 * 不另起一个音：两个同音高、相位无关的音交叠时会互相抵消，听起来像一下凹陷。
 * 振荡器用自定义的周期波形（基音加一点二、三次谐波），比纯正弦更容易在背景声里听清，又不尖。
 */
import type { Segment } from '@/engine/types'
import { breathY, createTrack, followBreath, type Track } from './automation'
import { quietly } from './graph'
import { GLIDE, TIMING } from './params'
import type { Scheduled } from './types'

export interface Glides {
  /** 排一段柔音；返回的 cancel 撤销这一段 */
  play(seg: Segment, at: number): Scheduled
  /** 撤销全部：没开始的不响，正在响的从当前音量淡出 */
  cancelAll(): void
  /** 最后一个音响完的时刻 */
  busyUntil(): number
  dispose(): void
}

interface Tone {
  osc: OscillatorNode
  gain: GainNode
  amp: Track
  start: number
  /** 当前最后一段结束（开始收音）的时刻 */
  end: number
  /** 振荡器停下的时刻 */
  stopAt: number
  /** 被撤销、开始淡出的时刻；没被撤销为 null */
  cut: number | null
  done: boolean
}

const NOOP: Scheduled = { cancel() {} }

const envelope = (y: number): number => GLIDE.floor + (1 - GLIDE.floor) * Math.max(0, Math.min(1, y))

const silentSeg = (seg: Segment): boolean =>
  !GLIDE.holdTone && (seg.key === 'hold' || seg.key === 'rest' || seg.y0 === seg.y1 || seg.ease === 'flat')

/** level 为峰顶振幅（基音），由 levels.ts 按柔音的综合响度目标和包络补偿算好 */
export function createGlides(ctx: BaseAudioContext, dest: AudioNode, level: () => number): Glides {
  const tones = new Set<Tone>()
  let wave: PeriodicWave | null = null

  function periodicWave(): PeriodicWave {
    if (!wave) {
      const n = GLIDE.harmonics.length + 1
      const real = new Float32Array(n)
      const imag = new Float32Array(n)
      GLIDE.harmonics.forEach((a, i) => {
        imag[i + 1] = a
      })
      // 不让浏览器归一：基音的振幅就是 1，电平计算才准
      wave = ctx.createPeriodicWave(real, imag, { disableNormalization: true })
    }
    return wave
  }

  function release(t: Tone): void {
    if (!tones.delete(t)) return
    t.done = true
    t.osc.onended = null
    quietly(() => t.osc.disconnect())
    quietly(() => t.gain.disconnect())
  }

  /** 与画面同一条缓动，仅排音量；频率从创建到结束始终固定 */
  function swell(t: Tone, seg: Segment, at: number, from = at): void {
    const peak = level()
    followBreath(seg, at, from, TIMING.breathStep, [[t.amp, y => peak * envelope(y)]])
  }

  /** 在 end 开始收音，收完停下振荡器（再次调用 stop 会取代上一次的停止时刻） */
  function scheduleRelease(t: Tone, end: number): void {
    t.end = end
    t.amp.glide(0, end, end + GLIDE.release, undefined, 10)
    t.stopAt = end + GLIDE.release + 0.05
    quietly(() => t.osc.stop(t.stopAt))
  }

  function startTone(seg: Segment, at: number): Tone {
    const osc = ctx.createOscillator()
    osc.setPeriodicWave(periodicWave())
    osc.frequency.value = GLIDE.frequency
    const gain = ctx.createGain()
    gain.gain.value = 0
    osc.connect(gain).connect(dest)
    const t0 = Math.min(at, ctx.currentTime)
    const t: Tone = {
      osc,
      gain,
      amp: createTrack(gain.gain, 0, t0),
      start: at,
      end: at + seg.dur,
      stopAt: Number.POSITIVE_INFINITY,
      cut: null,
      done: false,
    }
    const attackEnd = at + Math.min(GLIDE.attack, seg.dur / 2)
    t.amp.glide(level() * envelope(breathY(seg, at, attackEnd)), at, attackEnd, undefined, 16)
    swell(t, seg, at, attackEnd)
    scheduleRelease(t, at + seg.dur)
    osc.onended = () => release(t)
    osc.start(at)
    tones.add(t)
    return t
  }

  /** 接在前一个音后面：撤掉收音，继续同一个振荡器的音量起伏 */
  function extend(t: Tone, seg: Segment, at: number): void {
    t.amp.cancelFrom(t.end)
    swell(t, seg, at)
    scheduleRelease(t, at + seg.dur)
  }

  /** 重排时从当前电平接回这段包络，避免突变和叠音 */
  function revive(t: Tone, seg: Segment, at: number): void {
    t.cut = null
    const fadeEnd = at + Math.min(GLIDE.cancelFade / 2, seg.dur / 2)
    t.amp.glide(level() * envelope(breathY(seg, at, fadeEnd)), at, fadeEnd, undefined, 6)
    swell(t, seg, at, fadeEnd)
    scheduleRelease(t, at + seg.dur)
  }

  /** 从 at 时的电平淡出后停下；at 之前还没开始的音直接不响 */
  function cutAt(t: Tone, at: number): void {
    if (t.done) return
    if (t.start >= at) {
      quietly(() => t.osc.stop())
      release(t)
      return
    }
    t.amp.glide(0, at, at + GLIDE.cancelFade, undefined, 8)
    t.end = at
    t.cut = at
    t.stopAt = at + GLIDE.cancelFade + 0.05
    quietly(() => t.osc.stop(t.stopAt))
  }

  /** at 正好接在某个音后面（它还没收完）：返回这个音和接法 */
  function successor(at: number): { tone: Tone; how: 'extend' | 'revive' } | null {
    const now = ctx.currentTime
    for (const t of tones) {
      if (t.done || Math.abs(at - t.end) > GLIDE.join) continue
      if (t.cut === null && now < t.end) return { tone: t, how: 'extend' }
      if (t.cut !== null && now < t.cut + GLIDE.cancelFade) return { tone: t, how: 'revive' }
    }
    return null
  }

  return {
    play(seg, at) {
      if (silentSeg(seg) || !(seg.dur > 0)) return NOOP
      const prev = successor(at)
      let tone: Tone
      if (prev) {
        tone = prev.tone
        if (prev.how === 'extend') extend(tone, seg, at)
        else revive(tone, seg, at)
      } else tone = startTone(seg, at)
      return {
        cancel() {
          // 只撤这一段：已经开始的在当时停住淡出，没开始的从这一段的开头收掉
          cutAt(tone, Math.max(at, ctx.currentTime))
        },
      }
    },
    cancelAll() {
      const now = ctx.currentTime
      for (const t of [...tones]) if (t.stopAt > now && t.cut === null) cutAt(t, now)
    },
    busyUntil() {
      let end = 0
      for (const t of tones) end = Math.max(end, t.stopAt)
      return end
    },
    dispose() {
      for (const t of [...tones]) {
        quietly(() => t.osc.stop())
        release(t)
      }
    },
  }
}
