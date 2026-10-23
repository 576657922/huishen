/**
 * 长音（移植自原型并改良）：D 大调里柔和的和弦缓慢流动，没有节拍，没有旋律。
 *
 * 五个声部（低音 + 四个中声部）各自持续发声；换和弦时只有音高变了的声部交叉淡变（每次最多两个），
 * 共同音一直保持、不重新起音——原型每 20 秒把整个和弦重新淡入一遍，这里改成真正的声部进行。
 * 和声节奏放松 12 秒一换、睡前 16–24 秒；每个音由同音高的正弦和三角波组成，所有音一起揉（≤ 5 音分）。
 */
import { dbToGain } from '../dsp/util'
import { type ChordSpec, DRONE } from '../params'
import type { SoundMode } from '../types'
import { createCore, type LayerFactory } from './core'
import { createMusicChain } from './music'
import { createPad, type PadNote, type PadVoiceSpec } from './pad'

/** 声部数：低音 + 四个中声部 */
const PARTS = 5

/** 一个和弦的五个音高，下标 0 为低音 */
export const chordNotes = (c: ChordSpec): number[] => [c.bass, ...c.pads]

/** 两个和弦之间要移动的声部数 */
export const movedVoices = (a: ChordSpec, b: ChordSpec): number => {
  const x = chordNotes(a)
  const y = chordNotes(b)
  return x.filter((m, i) => m !== y[i]).length
}

const byName = new Map(DRONE.chords.map(c => [c.name, c]))

/** 按走向权重挑下一个和弦；移动超过两个声部的走向不用 */
export function nextChord(current: ChordSpec, rng: () => number): ChordSpec {
  const moves = Object.entries(DRONE.moves[current.name] ?? {})
    .map(([name, w]) => [byName.get(name), w] as const)
    .filter((m): m is readonly [ChordSpec, number] => !!m[0] && movedVoices(current, m[0]) <= 2)
  const total = moves.reduce((s, [, w]) => s + w, 0)
  let u = rng() * total
  for (const [chord, w] of moves) {
    u -= w
    if (u <= 0) return chord
  }
  return moves[moves.length - 1]?.[0] ?? current
}

/** 中声部的整体电平（各声部幅度的平方和开根），低音按它往下压 */
const padsLevel = Math.sqrt(DRONE.padAmps.reduce((s, a) => s + a * a, 0))
const BASS_AMP = padsLevel * dbToGain(DRONE.bassUnderPadsDb)

/** 第 part 个声部（0 为低音）唱 midi 时的音色 */
function voiceOf(part: number, midi: number): PadVoiceSpec {
  if (part === 0) return { midi, amp: BASS_AMP, pan: 0, harmonic: DRONE.bassHarmonic }
  return { midi, amp: DRONE.padAmps[part - 1] ?? 0.5, pan: DRONE.padPans[part - 1] ?? 0 }
}

export const createDrone: LayerFactory = (ctx, dest, bufs, opts) => {
  const core = createCore(ctx, dest, opts)
  const chain = createMusicChain(core, bufs('ir'), DRONE.tone, opts)
  const pad = createPad(core, chain.input)
  const { rng } = opts
  let mode: SoundMode = opts.mode
  let chord = DRONE.chords[0]!
  let next = Number.POSITIVE_INFINITY
  const sounding: (PadNote | null)[] = Array.from({ length: PARTS }, () => null)

  function holdSeconds(): number {
    const [lo, hi] = DRONE.hold[mode]
    return lo + (hi - lo) * rng()
  }

  function change(to: ChordSpec, at: number): void {
    const notes = chordNotes(to)
    for (let part = 0; part < PARTS; part++) {
      const midi = notes[part]!
      const cur = sounding[part]
      // 共同音保持，不重新起音
      if (cur && cur.midi === midi) continue
      if (cur) pad.noteOff(cur, at, DRONE.crossfade)
      sounding[part] = pad.noteOn(voiceOf(part, midi), at, DRONE.crossfade)
    }
    chord = to
  }

  return {
    start(at, quick) {
      pad.start(at)
      const notes = chordNotes(chord)
      const fadeIn = quick ? DRONE.quickIn : DRONE.firstIn
      for (let part = 0; part < PARTS; part++)
        sounding[part] = pad.noteOn(voiceOf(part, notes[part]!), at, fadeIn)
      next = at + holdSeconds()
    },
    schedule(until) {
      while (next < until && !core.stopped) {
        change(nextChord(chord, rng), next)
        next += holdSeconds()
      }
      chain.schedule(until)
    },
    breath: chain.breath,
    freeRun: chain.freeRun,
    level: chain.level,
    hold: chain.hold,
    setMode(m) {
      mode = m
    },
    stop: core.stop,
    dispose: core.dispose,
  }
}
