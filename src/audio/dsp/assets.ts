/**
 * 素材登记表：名字 → 生成任务。Worker 和主线程的后备路径都从这里生成，结果完全一致。
 * 循环素材固定用 32 kHz；混响冲激响应用音频环境的实际采样率。
 *
 * 电平：循环素材按综合响度归一到 ASSET_LUFS，单次音按播放时的瞬时响度最大值归一到 ONESHOT_LUFS，
 * 层内的配比和单次音的电平因此都可以直接按 LU 写在 params.ts 里。
 */
import {
  ASSET_LUFS,
  ASSET_RMS,
  BELL,
  BIRDS,
  CUES,
  EP,
  LOOP_RATE,
  NOISE,
  OCEAN,
  ONESHOT_LUFS,
  PENTATONIC_NOTES,
  PHASING,
  PING,
  PLUCK,
  RAIN,
  REVERB,
  STREAM,
  WIND,
} from '../params'
import type { AmbienceId, CueKind, MusicId } from '../types'
import { integratedLoudnessTask, momentaryMaxTask } from './analysis'
import { singingBowl } from './bell'
import { birdSong } from './birds'
import { colorNoise } from './colors'
import { chime, pair, ping, soft, tick } from './cues'
import { fmTone } from './epiano'
import { reverbIR } from './ir'
import { oceanBed, oceanFoam } from './ocean'
import { pluck } from './pluck'
import { heavyDrop, rainBed, rainDrops } from './rain'
import { bubbles, flow } from './stream'
import type { Task } from './task'
import {
  type Channels,
  dbToGain,
  headRms,
  loopify,
  mapInPlace,
  midiToHz,
  removeDcTask,
  rmsOf,
  scale,
  softPeak,
} from './util'
import { leaves, windBed } from './wind'

export type LoopName =
  | 'flow'
  | 'bubbles'
  | 'oceanBed'
  | 'oceanFoam'
  | 'rainBed'
  | 'rainDrops'
  | 'windBed'
  | 'leaves'
  | 'pink'
  | 'brown'

export type AssetName =
  | LoopName
  | 'bell'
  | 'ir'
  | `cue:${CueKind}`
  | `bird:${number}`
  | `drop:${number}`
  | `pluck:${number}`
  | `ep:${number}`

export const LOOP_NAMES: readonly LoopName[] = [
  'flow',
  'bubbles',
  'oceanBed',
  'oceanFoam',
  'rainBed',
  'rainDrops',
  'windBed',
  'leaves',
  'pink',
  'brown',
]

export const CUE_KINDS = Object.keys(CUES) as CueKind[]

export const birdAsset = (i: number): AssetName => `bird:${i}`
export const dropAsset = (i: number): AssetName => `drop:${i}`
export const pluckAsset = (midi: number): AssetName => `pluck:${midi}`
export const epAsset = (midi: number): AssetName => `ep:${midi}`

export const BIRD_ASSETS: readonly AssetName[] = BIRDS.songs.map((_, i) => birdAsset(i))
export const DROP_ASSETS: readonly AssetName[] = Array.from({ length: RAIN.heavy.variants }, (_, i) =>
  dropAsset(i),
)

export const AMBIENCE_ASSETS: Record<AmbienceId, readonly AssetName[]> = {
  none: [],
  rain: ['rainBed', 'rainDrops', ...DROP_ASSETS],
  stream: ['flow', 'bubbles'],
  ocean: ['oceanBed', 'oceanFoam'],
  forest: ['flow', 'bubbles', 'windBed', 'leaves', ...BIRD_ASSETS],
  birds: ['windBed', 'leaves', ...BIRD_ASSETS],
  wind: ['windBed', 'leaves'],
  pink: ['pink'],
  brown: ['brown'],
}

export const MUSIC_ASSETS: Record<MusicId, readonly AssetName[]> = {
  none: [],
  drone: ['ir'],
  pentatonic: [...PENTATONIC_NOTES.map(pluckAsset), 'ir'],
  phasing: [...PHASING.voices.map(v => epAsset(v.midi)), 'ir'],
}

export const CUE_ASSETS: readonly AssetName[] = ['bell', ...CUE_KINDS.map((k): AssetName => `cue:${k}`)]

export const assetRate = (name: AssetName, ctxRate: number): number => (name === 'ir' ? ctxRate : LOOP_RATE)

export const isLoop = (name: string): name is LoopName => (LOOP_NAMES as readonly string[]).includes(name)

const indexed = (s: string, prefix: string, count: number): boolean => {
  if (!s.startsWith(prefix)) return false
  const rest = s.slice(prefix.length)
  return /^\d{1,2}$/.test(rest) && Number(rest) < count
}

/** 校验来自 Worker 消息等外部来源的名字 */
export function isAssetName(s: string): s is AssetName {
  if (isLoop(s) || s === 'bell' || s === 'ir') return true
  if (s.startsWith('cue:')) return (CUE_KINDS as string[]).includes(s.slice(4))
  if (indexed(s, 'bird:', BIRDS.songs.length) || indexed(s, 'drop:', RAIN.heavy.variants)) return true
  return /^(pluck|ep):\d{1,3}$/.test(s)
}

/** 播放时的瞬时响度最大值：单声道素材会被上混到两个声道，按两个声道都响来算 */
export function* playedMomentaryMax(chs: Channels, sr: number): Task<number> {
  const stereo = chs.length === 1 ? [chs[0]!, chs[0]!] : chs
  return yield* momentaryMaxTask(stereo, sr)
}

/** 按综合响度归一 */
function* toLoudness(chs: Channels, sr: number, target: number): Task<Channels> {
  const lufs = yield* integratedLoudnessTask(chs, sr)
  if (!(Number.isFinite(lufs) && lufs > -100)) return chs
  const g = dbToGain(target - lufs)
  yield* mapInPlace(chs, x => x * g)
  return chs
}

/** 用连续素材做循环：多生成 crossfade 秒，尾巴叠回开头 */
function* looped(gen: (n: number) => Task<Channels>, sr: number, seconds: number, crossfade: number) {
  const n = Math.round(seconds * sr)
  const xf = Math.round(crossfade * sr)
  const raw = yield* gen(n + xf)
  yield
  const chs = yield* removeDcTask(loopify(raw, n, xf))
  return yield* toLoudness(chs, sr, ASSET_LUFS)
}

/** 事件类素材（水泡、雨滴）本身已经首尾相接，只需压住个别尖峰再归一 */
function* events(chs: Channels, sr: number, peakRatio: number): Task<Channels> {
  yield* removeDcTask(chs)
  const g = 0.1 / (rmsOf(chs) || 1)
  yield
  yield* mapInPlace(chs, x => x * g)
  yield* softPeak(chs, peakRatio)
  return yield* toLoudness(chs, sr, ASSET_LUFS)
}

/**
 * 单次音按播放时的瞬时响度最大值归一。
 * 不去直流：单次音从零开始、淡回零，减去均值反而让首尾都多出一个常数，播放开始和结束时各有一个阶跃
 * （提示音「停」「数息」短而低，均值约是峰值的 −50 dB，经输出链的高通后是 −78 dBFS 的咔哒声）。
 * 声音本身那一点直流交给输出链 38 Hz 的高通
 */
function* oneShot(chs: Channels, sr: number): Task<Channels> {
  const m = yield* playedMomentaryMax(chs, sr)
  return m > -100 ? scale(chs, dbToGain(ONESHOT_LUFS - m)) : chs
}

function* cueSound(kind: CueKind, sr: number): Task<Float32Array> {
  const spec = CUES[kind]
  switch (spec.type) {
    case 'ping':
      return ping(sr, spec.freq, spec.dur, PING, spec.glide)
    case 'tick':
      return tick(sr, spec.freq, spec.decay)
    case 'pair':
      return pair(sr, spec.freqs, spec.gap, spec.dur, PING)
    case 'chime':
      return yield* chime(sr, spec.freq, spec.partials)
    case 'soft':
      return soft(sr, spec.freq, spec.attack, spec.decay, spec.partials)
  }
}

/** 单个乐音按开头一段的 RMS 归一，不同音高听起来一样响 */
function evenTone(a: Float32Array, sr: number, seconds: number): Channels {
  return scale([a], ASSET_RMS / (headRms(a, sr, seconds) || 1))
}

function* renderLoop(name: LoopName, sr: number): Task<Channels> {
  switch (name) {
    case 'flow': {
      const p = STREAM.flow
      return yield* looped(n => flow(sr, n, p), sr, p.seconds, p.crossfade)
    }
    case 'bubbles': {
      const p = STREAM.bubbles
      return yield* events(yield* bubbles(sr, Math.round(p.seconds * sr), p), sr, p.peakRatio)
    }
    case 'oceanBed': {
      const p = OCEAN.bed
      return yield* looped(n => oceanBed(sr, n, p.seed), sr, p.seconds, p.crossfade)
    }
    case 'oceanFoam': {
      const p = OCEAN.foam
      return yield* looped(n => oceanFoam(sr, n, p.seed, p.hp, p.lp), sr, p.seconds, p.crossfade)
    }
    case 'rainBed': {
      const p = RAIN.bed
      return yield* looped(n => rainBed(sr, n, p), sr, p.seconds, p.crossfade)
    }
    case 'rainDrops': {
      const p = RAIN.drops
      return yield* events(yield* rainDrops(sr, Math.round(p.seconds * sr), p), sr, p.peakRatio)
    }
    case 'windBed': {
      const p = WIND.bed
      return yield* looped(n => windBed(sr, n, p), sr, p.seconds, p.crossfade)
    }
    case 'leaves': {
      const p = WIND.leaves
      return yield* looped(n => leaves(sr, n, p), sr, p.seconds, p.crossfade)
    }
    case 'pink':
    case 'brown': {
      const p = NOISE[name]
      return yield* looped(n => colorNoise(sr, n, name, p), sr, p.seconds, p.crossfade)
    }
  }
}

/** 生成一个素材，返回各声道的采样（单次乐音、提示音、鸟鸣、雨滴为单声道） */
export function* renderAsset(name: AssetName, sr: number): Task<Channels> {
  if (isLoop(name)) return yield* renderLoop(name, sr)
  if (name === 'bell') return yield* oneShot(yield* singingBowl(sr, BELL), sr)
  if (name === 'ir') return yield* reverbIR(sr, REVERB)
  const [kind, arg] = name.split(':') as [string, string]
  if (kind === 'cue') return yield* oneShot([yield* cueSound(arg as CueKind, sr)], sr)
  const i = Number(arg)
  if (kind === 'bird') return yield* oneShot(yield* birdSong(sr, BIRDS.songs[i] ?? [], BIRDS), sr)
  if (kind === 'drop') return yield* oneShot(yield* heavyDrop(sr, i, RAIN.heavy), sr)
  const f = midiToHz(i)
  if (kind === 'pluck') {
    const t60 = PLUCK.t60 * (midiToHz(50) / f) ** PLUCK.t60Slope
    return evenTone(yield* pluck(sr, f, { ...PLUCK, seed: PLUCK.seed + i, t60 }), sr, 1)
  }
  return evenTone(yield* fmTone(sr, f, EP), sr, 1.5)
}
