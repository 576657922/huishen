/**
 * 鸟鸣：每一种叫声是一句 0.5–2 秒的短句，由几个音组成；每个音是频率滑动的正弦，
 * 加一点低指数调频和二次谐波（「哨音」的质感），起止都是升余弦。
 * 只做和谐、柔和的鸣唱（2–6 kHz）；不做警报声、乌鸦、海鸥、猛禽这类沙哑或尖利的叫声。
 */
import { easeInOut } from '@/lib/math'
import type { BirdNote } from '../params'
import { biquad, filterInPlace } from './filters'
import type { Task } from './task'
import { type Channels, due } from './util'

export interface BirdParams {
  attack: number
  release: number
  harmonic: number
  fmRatio: number
  fmIndex: number
}

/** 一句的总长：音长加音间的空隙，结尾留 30 ms 收尾 */
export function songSeconds(notes: readonly BirdNote[]): number {
  return notes.reduce((s, n) => s + n.dur + n.gap, 0) + 0.03
}

export function* birdSong(sr: number, notes: readonly BirdNote[], p: BirdParams): Task<Channels> {
  const a = new Float32Array(Math.ceil(songSeconds(notes) * sr))
  let at = 0
  for (const note of notes) {
    const len = Math.floor(note.dur * sr)
    const na = Math.max(2, Math.min(Math.floor(p.attack * sr), len >> 2))
    const nr = Math.max(2, Math.min(Math.floor(p.release * sr), len >> 1))
    const i0 = Math.floor(at * sr)
    const ratio = note.f1 / note.f0
    const vib = note.vib ?? 0
    const depth = note.vibDepth ?? 0
    const amp = note.amp ?? 1
    let ph = 0
    for (let k = 0; k < len; k++) {
      const t = k / sr
      // 滑音按缓动走：两端慢、中间快，像真的鸟一样有一点「弧」
      const f = note.f0 * ratio ** easeInOut(k / len) + depth * Math.sin(2 * Math.PI * vib * t)
      ph += (2 * Math.PI * f) / sr
      const atk = k < na ? (1 - Math.cos((Math.PI * k) / na)) / 2 : 1
      const rel = k > len - nr ? (1 - Math.cos((Math.PI * (len - k)) / nr)) / 2 : 1
      // 音头稍强、音尾稍弱，一个音里也有轻重
      const arch = 1 - 0.25 * (k / len)
      const tone = Math.sin(ph + p.fmIndex * Math.sin(p.fmRatio * ph)) + p.harmonic * Math.sin(2 * ph)
      const i = i0 + k
      if (i < a.length) a[i] = a[i]! + amp * atk * rel * arch * tone
      if (due(i)) yield
    }
    at += note.dur + note.gap
  }
  // 远处的鸟听不到 9 kHz 以上；也防止调频的边带变得刺耳
  yield* filterInPlace(a, biquad('lowpass', 9000, 0.7, sr))
  return [a]
}
