/**
 * 持续的柔和长音（「长音」的和弦、「五声」「回响」底下的持续音共用）：
 * 每个音由同音高的正弦和三角波组成，加 ≤ 5 音分、0.1–0.3 Hz 的慢揉音；起音、收音都按等功率曲线慢慢走。
 *
 * 所有音一起揉（两个错开的慢速振荡器相加，非周期地摆），彼此之间不失谐：
 * 只要两个分音频率相近（同一个音里的正弦和三角波、低音加的二次谐波和高八度的中声部），
 * 相对的几音分就会拍出 0.1–1 Hz、几 dB 深的起伏，比 3 秒的短期响度窗还慢，
 * 持续音单独就能在 20 秒内升 2–3 LU（研究要求整体 ≤ 3 LU）。一起揉时音程始终不变，响度稳定。
 */
import { createTrack, powerIn, powerOut, type Track } from '../automation'
import { midiToHz } from '../dsp/util'
import { gainNode, panNode } from '../graph'
import { DRONE } from '../params'
import type { LayerCore } from './core'

export interface PadNote {
  midi: number
  env: Track
  /** 让这个音的振荡器在某一刻停下 */
  stops: ((at: number) => void)[]
}

export interface PadVoiceSpec {
  midi: number
  /** 振幅（各振荡器按 DRONE.voices 的权重分） */
  amp: number
  pan: number
  /** 加一点二次谐波：手机喇叭放不出 55–110 Hz，靠它听出低音 */
  harmonic?: number
}

export interface Pad {
  /** 揉音振荡器从 at 开始 */
  start(at: number): void
  noteOn(voice: PadVoiceSpec, at: number, fadeIn: number): PadNote
  noteOff(note: PadNote, at: number, fadeOut: number): void
}

export function createPad(core: LayerCore, dest: AudioNode): Pad {
  const { ctx } = core
  // 揉音的音分：两个振荡器各占一半深度，相加后最多 ±vibratoCents
  const bend = core.keep(gainNode(ctx, 1))
  const lfos = DRONE.vibratoRates.map(rate => {
    const osc = ctx.createOscillator()
    osc.frequency.value = rate
    osc.connect(core.keep(gainNode(ctx, DRONE.vibratoCents / DRONE.vibratoRates.length))).connect(bend)
    return osc
  })

  return {
    start(at) {
      for (const osc of lfos) core.play(osc, [], at)
    },
    noteOn(voice, at, fadeIn) {
      const env = gainNode(ctx, 0)
      const pan = panNode(ctx, voice.pan)
      env.connect(pan).connect(dest)
      const track = createTrack(env.gain, 0, Math.min(at, ctx.currentTime))
      track.glide(1, at, at + fadeIn, powerIn, 12)
      const f = midiToHz(voice.midi)
      const specs: { type: OscillatorType; freq: number; gain: number }[] = DRONE.voices.map(v => ({
        type: v.type,
        freq: f,
        gain: voice.amp * v.weight * DRONE.oscGain,
      }))
      if (voice.harmonic)
        specs.push({ type: 'sine', freq: 2 * f, gain: voice.amp * voice.harmonic * DRONE.oscGain })
      const stops = specs.map((s, i) => {
        const osc = ctx.createOscillator()
        osc.type = s.type
        osc.frequency.value = s.freq
        const g = gainNode(ctx, s.gain)
        osc.connect(g).connect(env)
        bend.connect(osc.detune)
        // 包络和声像随这个音的第一个振荡器一起回收；揉音的线从常驻节点上单独断开
        const extra = i === 0 ? [env, pan] : []
        return core.play(osc, [g, ...extra], at, undefined, () => bend.disconnect(osc.detune))
      })
      return { midi: voice.midi, env: track, stops }
    },
    noteOff(note, at, fadeOut) {
      note.env.glide(0, at, at + fadeOut, powerOut, 12)
      for (const stop of note.stops) stop(at + fadeOut + 0.05)
    },
  }
}
