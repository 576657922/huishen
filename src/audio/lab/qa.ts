/**
 * 离线质检与校准。用 OfflineAudioContext 走正式播放的同一条链路渲染：
 * bed.ts 的一组背景声 → 母线音量 → 模式音色 → 真峰值限幅器（AudioWorklet）→ master，
 * 默认音量下按 EBU R 128 测综合响度、响度范围、真峰值，另测直流、咔哒声（含循环接缝）、渐强、30 秒内的平稳和频谱。
 * 每个场景都用固定种子，结果可以复现：同一场景去掉某一路再渲染一遍，两者相减就是那一路本身。
 */
import { isAllowed, SOUND_PRESETS } from '@/content/sounds'
import type { Segment } from '@/engine/types'
import { mulberry32 } from '@/lib/random'
import { segment } from '../automation'
import { createBed } from '../bed'
import type { BufferStore } from '../buffers'
import {
  blockLoudness,
  clickScore,
  integratedLoudness,
  type Metrics,
  measure,
  momentaryMax,
  seamJump,
} from '../dsp/analysis'
import { type AssetName, CUE_ASSETS, CUE_KINDS, isLoop } from '../dsp/assets'
import { createGlides } from '../glide'
import { AMBIENCE_IDS, layerAssets, layerKey, MUSIC_IDS } from '../layers'
import { bellStrikes, cueGain, glideAmp } from '../levels'
import { type BusName, createMixer, type DynamicsKind, type DynamicsStats } from '../mixer'
import { createOneShots } from '../oneshots'
import { DEFAULT_VOLUMES, LAYER_TRIMS, type LayerKey, LOUDNESS, QA } from '../params'
import type { AmbienceId, BellKind, Bus, CueKind, MusicId, SoundMix, SoundMode } from '../types'
import { loadLimiter } from '../worklet/load'

/* ---------- 场景与渲染 ---------- */

/** 节拍的一段（不含 t0） */
export type SegSpec = Pick<Segment, 'key' | 'dur' | 'y0' | 'y1' | 'ease'>

/** 慢呼吸的默认节拍：每分钟 5.5 次，吸 4.5、呼 6.5（产品规格 §2） */
export const SLOW_BREATH: readonly SegSpec[] = [
  { key: 'in', dur: 4.5, y0: 0, y1: 1, ease: 'inout' },
  { key: 'out', dur: 6.5, y0: 1, y1: 0, ease: 'inout' },
]

/** 周期性叹息：吸 2.5、再吸 1、呼 7 */
export const SIGH_BREATH: readonly SegSpec[] = [
  { key: 'in', dur: 2.5, y0: 0, y1: 0.78, ease: 'inout' },
  { key: 'in2', dur: 1, y0: 0.78, y1: 1, ease: 'out' },
  { key: 'out', dur: 7, y0: 1, y1: 0, ease: 'inout' },
]

/** 箱式呼吸：吸、屏息（吸满）、呼、屏息（呼空）每步 step 秒，屏息段没有滑音 */
export function boxBreath(step: number): readonly SegSpec[] {
  return [
    { key: 'in', dur: step, y0: 0, y1: 1, ease: 'inout' },
    { key: 'hold', dur: step, y0: 1, y1: 1, ease: 'flat' },
    { key: 'out', dur: step, y0: 1, y1: 0, ease: 'inout' },
    { key: 'rest', dur: step, y0: 0, y1: 0, ease: 'flat' },
  ]
}

/** 箱式呼吸的默认节拍：4-4-4-4 */
export const BOX_BREATH: readonly SegSpec[] = boxBreath(4)

/** 把一轮节拍从 0 秒铺到 until */
export function cycleSegments(pattern: readonly SegSpec[], until: number): { seg: Segment; at: number }[] {
  const out: { seg: Segment; at: number }[] = []
  for (let t = 0; t < until; ) {
    for (const s of pattern) {
      out.push({ seg: segment(s.key, s.y0, s.y1, s.dur, s.ease), at: t })
      t += s.dur
    }
  }
  return out
}

export interface Scene {
  mix: Pick<SoundMix, 'ambience' | 'music'>
  mode: SoundMode
  /** 总秒数 */
  seconds: number
  volumes?: Partial<Record<Bus, number>>
  /** free：不跟节拍，按自己的慢周期起伏；paced：按 pattern 跟随节拍 */
  motion?: 'free' | 'paced'
  pattern?: readonly SegSpec[]
  /** 节拍提示「滑音」 */
  glide?: boolean
  /** 不放背景声，只渲染滑音、钟声或提示音 */
  noBed?: boolean
  bells?: readonly { kind: BellKind; at: number }[]
  cues?: readonly { kind: CueKind; at: number }[]
  /** 练习中换声音（在 at 秒调用 changeBed） */
  changes?: readonly { at: number; mix: Partial<SoundMix> }[]
  plannedSec?: number
  fadeIn?: number
  dynamics?: DynamicsKind
  seed?: number
  /** 层内某一路静音（如 'birds'），用于相减得到那一路本身 */
  mute?: string
  /** 直接送进某条母线的正弦测试信号 */
  tone?: { bus: BusName; freq: number; dbfs: number }
}

export interface Rendered {
  audio: Float32Array[]
  sampleRate: number
  stats: DynamicsStats
}

const ALL_CUE_ASSETS: readonly AssetName[] = CUE_ASSETS

function sceneAssets(scene: Scene): AssetName[] {
  const names = new Set<AssetName>(ALL_CUE_ASSETS)
  for (const [kind, id] of [
    ['ambience', scene.mix.ambience],
    ['music', scene.mix.music],
  ] as const) {
    const key = layerKey(kind, id)
    if (key) for (const n of layerAssets(key)) names.add(n)
  }
  for (const c of scene.changes ?? []) {
    for (const [kind, id] of [
      ['ambience', c.mix.ambience],
      ['music', c.mix.music],
    ] as const) {
      const key = id === undefined ? null : layerKey(kind, id)
      if (key) for (const n of layerAssets(key)) names.add(n)
    }
  }
  names.add('ir')
  return [...names]
}

/** OfflineAudioContext.suspend 只能停在渲染块（128 帧）的边界上 */
const quantum = (t: number, sr: number): number => (Math.ceil((t * sr) / 128) * 128) / sr

/** 渲染一个场景；dynamics 默认用真峰值限幅器的 Worklet（载入失败就报错，不悄悄退回） */
export async function renderScene(
  scene: Scene,
  store: BufferStore,
  sr: number = QA.sampleRate,
): Promise<Rendered> {
  // 渲染期间占用这一场景的素材：前面的场景已把缓存填到上限时，刚生成的素材可能在建层之前被淘汰，
  // 层就会在渲染中途才晚到、补一个淡入，测到的不再是正常播放的样子
  const names = sceneAssets(scene)
  const release = store.hold(names, sr)
  try {
    return await renderHeld(scene, store, sr, names)
  } finally {
    release()
  }
}

async function renderHeld(
  scene: Scene,
  store: BufferStore,
  sr: number,
  names: AssetName[],
): Promise<Rendered> {
  const total = scene.seconds
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(total * sr), sampleRate: sr })
  const dynamics = scene.dynamics ?? 'worklet'
  if (dynamics === 'worklet' && !(await loadLimiter(ctx))) throw new Error('限幅器 Worklet 载入失败')
  const volumes = { ...DEFAULT_VOLUMES, ...scene.volumes }
  const mixer = createMixer(ctx, {
    volumes,
    mode: scene.mode,
    dynamics,
    statsEvery: 0.25,
  })
  await store.load(names, sr, 'now')
  const rng = mulberry32(scene.seed ?? QA.seed)
  if (!scene.noBed) {
    const bed = createBed(
      {
        ctx,
        buses: mixer.buses,
        store,
        rng,
        horizon: () => total,
        audible: () => true,
        inspect: (name, node) => {
          if (name === scene.mute) node.gain.value = 0
        },
      },
      {
        mix: { ...scene.mix, mode: scene.mode, ambienceVolume: volumes.ambience, musicVolume: volumes.music },
        at: 0,
        fadeIn: scene.fadeIn ?? 2,
        plannedSec: scene.plannedSec ?? total,
      },
    )
    if (scene.motion === 'paced')
      for (const { seg, at } of cycleSegments(scene.pattern ?? SLOW_BREATH, total)) bed.breath(seg, at)
    else bed.freeRun(0, total)
    bed.schedule(total)
    for (const c of scene.changes ?? []) {
      void ctx.suspend(quantum(c.at, sr)).then(() => {
        bed.change(c.mix)
        bed.schedule(total)
        void ctx.resume()
      })
    }
  }
  if (scene.glide) {
    const glides = createGlides(ctx, mixer.buses.cues, glideAmp)
    for (const { seg, at } of cycleSegments(scene.pattern ?? SLOW_BREATH, total - 1)) glides.play(seg, at)
  }
  const shots = createOneShots(ctx, mixer.buses.cues)
  for (const b of scene.bells ?? []) {
    const buf = store.peek('bell', sr)
    if (buf) shots.play(buf, b.at, bellStrikes(b.kind))
  }
  for (const c of scene.cues ?? []) {
    const buf = store.peek(`cue:${c.kind}`, sr)
    if (buf) shots.play(buf, c.at, [[0, cueGain(c.kind)]])
  }
  if (scene.tone) {
    const osc = ctx.createOscillator()
    osc.frequency.value = scene.tone.freq
    const g = ctx.createGain()
    g.gain.value = 10 ** (scene.tone.dbfs / 20)
    osc.connect(g).connect(mixer.buses[scene.tone.bus])
    osc.start(0)
  }
  const out = await ctx.startRendering()
  // Worklet 的统计经消息口送来，渲染结束后再等一下
  await new Promise(r => setTimeout(r, 30))
  return { audio: [out.getChannelData(0), out.getChannelData(1)], sampleRate: sr, stats: mixer.takeStats() }
}

/* ---------- 判定 ---------- */

export interface QaCheck {
  name: string
  ok: boolean
  value: number
  /** 合格范围的文字说明，如「≤ −3」 */
  limit: string
}

export type QaGroup =
  | 'ambience'
  | 'music'
  | 'preset'
  | 'sleep'
  | 'switch'
  | 'paced'
  | 'bell'
  | 'cue'
  | 'limiter'
  | 'rate'

export interface QaCase {
  label: string
  group: QaGroup
  metrics: Metrics | null
  checks: QaCheck[]
  ok: boolean
  /** 限幅器的最大衰减（dB）：默认音量下应为 0 */
  limitDb: number
  /** 渲染结果，供试听或导出；只有 keepAudio 时才有 */
  audio?: Float32Array[]
}

export interface QaReport {
  sampleRate: number
  cases: QaCase[]
  ok: boolean
  ms: number
}

const fmt = (x: number): string => (Math.round(x * 10) / 10).toString().replace('-', '−')

const within = (name: string, value: number, target: number, tol: number): QaCheck => ({
  name,
  ok: Math.abs(value - target) <= tol,
  value,
  limit: `${fmt(target)} ± ${fmt(tol)}`,
})

const atMost = (name: string, value: number, max: number): QaCheck => ({
  name,
  ok: value <= max,
  value,
  limit: `≤ ${fmt(max)}`,
})

const between = (name: string, value: number, lo: number, hi: number): QaCheck => ({
  name,
  ok: value >= lo && value <= hi,
  value,
  limit: `${fmt(lo)} … ${fmt(hi)}`,
})

/** 每个渲染都要满足的：真峰值、直流、咔哒声 */
function basics(m: Metrics): QaCheck[] {
  return [
    atMost('真峰值（dBTP）', m.truePeak, LOUDNESS.truePeak),
    atMost('直流', m.dc, QA.maxDc),
    atMost('咔哒声', m.click, QA.maxClick),
  ]
}

/** 循环素材首尾相接处：接起来测咔哒声评分，以及首尾两个采样的跳变（各素材、各声道取最大） */
function seamScores(
  store: BufferStore,
  names: readonly AssetName[],
  sr: number,
): { click: number; jump: number } {
  let click = 0
  let jump = 0
  for (const name of names.filter(isLoop)) {
    const b = store.peek(name, sr)
    if (!b) continue
    const q = Math.min(b.length >> 1, Math.round(0.25 * b.sampleRate))
    for (let c = 0; c < b.numberOfChannels; c++) {
      const a = b.getChannelData(c)
      const joined = new Float32Array(2 * q)
      joined.set(a.subarray(a.length - q))
      joined.set(a.subarray(0, q), q)
      click = Math.max(click, clickScore([joined], b.sampleRate))
      jump = Math.max(jump, seamJump(a))
    }
  }
  return { click, jump }
}

/* ---------- 质检的各个场景 ---------- */

type Ambience = Exclude<AmbienceId, 'none'>
type Music = Exclude<MusicId, 'none'>

/**
 * 睡前能选的声景和音乐，跟内容目录（content/sounds.ts）走：鸟鸣是白天的声音不在其中；
 * 林间在睡前可选，声音层这时只放溪水和风，所以也要按睡前的目标测
 */
export const SLEEP_AMBIENCES: readonly Ambience[] = AMBIENCE_IDS.filter(id => isAllowed(id, 'sleep'))
export const SLEEP_MUSIC: readonly Music[] = MUSIC_IDS.filter(id => isAllowed(id, 'sleep'))

/** 内容目录里「听声音」两种模式的出厂默认组合：放松是溪流，睡前是雨，都不加音乐 */
export const DEFAULT_RELAX: Pick<SoundMix, 'ambience' | 'music'> = {
  ambience: SOUND_PRESETS.relax.ambience,
  music: SOUND_PRESETS.relax.music,
}
export const DEFAULT_SLEEP: Pick<SoundMix, 'ambience' | 'music'> = {
  ambience: SOUND_PRESETS.sleep.ambience,
  music: SOUND_PRESETS.sleep.music,
}

/** 用户自己加上音乐的组合：两层相加也要落在目标上 */
const RAIN_DRONE: Pick<SoundMix, 'ambience' | 'music'> = { ambience: 'rain', music: 'drone' }

const mixLabel = (m: Pick<SoundMix, 'ambience' | 'music'>): string =>
  [m.ambience, m.music].filter(id => id !== 'none').join(' + ') || '静音'

interface Ctx {
  store: BufferStore
  sr: number
  seconds: number
  keepAudio: boolean
}

const solo = (key: LayerKey): Pick<SoundMix, 'ambience' | 'music'> =>
  (AMBIENCE_IDS as readonly string[]).includes(key)
    ? { ambience: key as Ambience, music: 'none' }
    : { ambience: 'none', music: key as Music }

function done(
  label: string,
  group: QaGroup,
  metrics: Metrics | null,
  checks: QaCheck[],
  r: Rendered | null,
  x: Ctx,
): QaCase {
  const c: QaCase = {
    label,
    group,
    metrics,
    checks,
    ok: checks.every(k => k.ok),
    limitDb: r?.stats.limitDb ?? 0,
  }
  if (x.keepAudio && r) c.audio = r.audio
  return c
}

/** 单独一层（另一层为 none）：响度、响度范围、冲击、渐强、接缝 */
async function layerCase(x: Ctx, key: LayerKey, mode: SoundMode): Promise<QaCase> {
  const total = QA.preroll + x.seconds
  const r = await renderScene({ mix: solo(key), mode, seconds: total }, x.store, x.sr)
  const from = Math.round(QA.preroll * x.sr)
  const m = measure(r.audio, x.sr, from)
  const ambience = (AMBIENCE_IDS as readonly string[]).includes(key)
  const lra = mode === 'sleep' ? LOUDNESS.lra.sleep : ambience ? LOUDNESS.lra.ambience : LOUDNESS.lra.relax
  const checks = [
    within('综合响度（LUFS）', m.lufs, LOUDNESS.target[mode], LOUDNESS.tolerance),
    atMost('响度范围（LU）', m.lra, lra),
    atMost('20 秒内升幅（LU）', m.maxRise, LOUDNESS.maxRise),
    atMost('30 秒内变化（LU）', m.maxSwing, LOUDNESS.maxSwing),
    ...basics(m),
    atMost('限幅（dB）', r.stats.limitDb, QA.maxLimitDb),
  ]
  if (ambience) checks.push(atMost('冲击：瞬时最大 − 综合（LU）', m.momentaryMax - m.lufs, LOUDNESS.impulse))
  if (mode === 'sleep')
    checks.push(atMost('4 kHz 以上 − 200–800 Hz（dB）', m.highVsMid, LOUDNESS.sleepHighVsMid))
  if (ambience && mode === 'relax') {
    const seam = seamScores(x.store, layerAssets(key), x.sr)
    checks.push(atMost('接缝咔哒声', seam.click, QA.maxClick), atMost('接缝跳变', seam.jump, QA.maxSeam))
  }
  const group: QaGroup = mode === 'sleep' ? 'sleep' : ambience ? 'ambience' : 'music'
  return done(`${group}/${key}`, group, m, checks, r, x)
}

/**
 * 校准只在 QA.sampleRate 上做。混响的冲激响应要按设备的采样率给 ConvolverNode，用到它的层在另一个常见采样率上
 * 也要落在目标上，并且与校准时的采样率几乎一样响（ref 为校准采样率上测到的综合响度；没测过就现在测）
 */
async function rateCase(x: Ctx, key: LayerKey, ref: number | undefined): Promise<QaCase> {
  const total = QA.preroll + x.seconds
  const sr = QA.altRate
  const r = await renderScene({ mix: solo(key), mode: 'relax', seconds: total }, x.store, sr)
  const m = measure(r.audio, sr, Math.round(QA.preroll * sr))
  let base = ref
  if (base === undefined) {
    const b = await renderScene({ mix: solo(key), mode: 'relax', seconds: total }, x.store, x.sr)
    base = integratedLoudness(b.audio, x.sr, Math.round(QA.preroll * x.sr))
  }
  const checks = [
    within('综合响度（LUFS）', m.lufs, LOUDNESS.target.relax, LOUDNESS.tolerance),
    within(`与 ${x.sr / 1000} kHz 相差（LU）`, m.lufs - base, 0, QA.maxRateDiff),
    atMost('30 秒内变化（LU）', m.maxSwing, LOUDNESS.maxSwing),
    ...basics(m),
  ]
  return done(`rate/${key} @ ${sr / 1000} kHz`, 'rate', m, checks, r, x)
}

/** 鸟鸣比底子低 12–18 dB：同一场景去掉鸟鸣再渲染一遍，相减得到鸟鸣本身（不经限幅器，保证线性） */
async function birdsCase(x: Ctx, key: 'birds' | 'forest'): Promise<QaCase> {
  const total = QA.preroll + x.seconds
  const scene: Scene = { mix: solo(key), mode: 'relax', seconds: total, dynamics: 'none' }
  const all = await renderScene(scene, x.store, x.sr)
  const bed = await renderScene({ ...scene, mute: 'birds' }, x.store, x.sr)
  const birds = all.audio.map((a, c) => a.map((v, i) => v - bed.audio[c]![i]!))
  const from = Math.round(QA.preroll * x.sr)
  const bedLufs = integratedLoudness(bed.audio, x.sr, from)
  const tail = birds.map(a => a.subarray(from))
  const rel = momentaryMax(tail, x.sr) - bedLufs
  const checks = [between('鸟鸣瞬时最大 − 底子（LU）', rel, -18, -12)]
  return done(`ambience/${key} 鸟鸣电平`, 'ambience', null, checks, null, x)
}

async function presetCase(
  x: Ctx,
  label: string,
  mix: Pick<SoundMix, 'ambience' | 'music'>,
  mode: SoundMode,
): Promise<QaCase> {
  const total = QA.preroll + x.seconds
  const r = await renderScene({ mix, mode, seconds: total }, x.store, x.sr)
  const m = measure(r.audio, x.sr, Math.round(QA.preroll * x.sr))
  const checks = [
    within('综合响度（LUFS）', m.lufs, LOUDNESS.target[mode], LOUDNESS.tolerance),
    atMost('响度范围（LU）', m.lra, LOUDNESS.lra[mode]),
    atMost('20 秒内升幅（LU）', m.maxRise, LOUDNESS.maxRise),
    atMost('30 秒内变化（LU）', m.maxSwing, LOUDNESS.maxSwing),
    ...basics(m),
    atMost('限幅（dB）', r.stats.limitDb, QA.maxLimitDb),
  ]
  if (mode === 'sleep')
    checks.push(atMost('4 kHz 以上 − 200–800 Hz（dB）', m.highVsMid, LOUDNESS.sleepHighVsMid))
  return done(`preset/${label}`, 'preset', m, checks, r, x)
}

/** 换声景、换音乐：各自单独时的综合响度彼此相差不超过 1.5 LU */
function switchCase(x: Ctx, label: string, cases: readonly QaCase[]): QaCase {
  const xs = cases.map(c => c.metrics?.lufs ?? Number.NaN).filter(Number.isFinite)
  const spread = xs.length ? Math.max(...xs) - Math.min(...xs) : Number.NaN
  return done(
    `switch/${label}`,
    'switch',
    null,
    [atMost('综合响度的极差（LU）', spread, LOUDNESS.maxSwitch)],
    null,
    x,
  )
}

/** 练习中换声音：交叉淡变前后，短期响度平稳、没有咔哒声 */
async function liveSwitchCase(x: Ctx): Promise<QaCase> {
  const total = 70
  const r = await renderScene(
    {
      mix: { ambience: 'rain', music: 'drone' },
      mode: 'relax',
      seconds: total,
      changes: [
        { at: 25, mix: { ambience: 'ocean' } },
        { at: 40, mix: { music: 'none' } },
        { at: 55, mix: { ambience: 'stream', music: 'phasing' } },
      ],
    },
    x.store,
    x.sr,
  )
  const m = measure(r.audio, x.sr, Math.round(QA.preroll * x.sr))
  const checks = [
    within('综合响度（LUFS）', m.lufs, LOUDNESS.target.relax, LOUDNESS.tolerance),
    atMost('短期响度极差（LU）', m.shortTermMax - m.shortTermMin, 2 * LOUDNESS.maxSwitch + 1),
    atMost('20 秒内升幅（LU）', m.maxRise, LOUDNESS.maxRise),
    ...basics(m),
  ]
  return done('switch/练习中换声音', 'switch', m, checks, r, x)
}

/** 跟随节拍的组合加滑音：亮度随吸呼起伏，短期响度变化不超过 3 LU；滑音约比背景声低 6 LU */
async function pacedCase(
  x: Ctx,
  label: string,
  mix: Pick<SoundMix, 'ambience' | 'music'>,
  pattern: readonly SegSpec[],
): Promise<QaCase> {
  const total = QA.preroll + x.seconds
  const scene: Scene = { mix, mode: 'relax', seconds: total, motion: 'paced', pattern, glide: true }
  const r = await renderScene(scene, x.store, x.sr)
  const from = Math.round(QA.preroll * x.sr)
  const m = measure(r.audio, x.sr, from)
  const glideOnly = await renderScene({ ...scene, noBed: true }, x.store, x.sr)
  const glideLufs = integratedLoudness(glideOnly.audio, x.sr, from)
  const checks = [
    atMost('20 秒内升幅（LU）', m.maxRise, LOUDNESS.maxRise),
    atMost('30 秒内变化（LU）', m.maxSwing, LOUDNESS.maxSwing),
    atMost('响度范围（LU）', m.lra, LOUDNESS.lra.relax),
    within('综合响度（LUFS）', m.lufs, LOUDNESS.target.relax, LOUDNESS.tolerance + 0.5),
    within('滑音 − 目标（LU）', glideLufs - LOUDNESS.target.relax, -6, 1.5),
    ...basics(m),
    atMost('滑音咔哒声', clickScore(glideOnly.audio, x.sr, from), QA.maxClick),
  ]
  return done(`paced/${label}`, 'paced', m, checks, r, x)
}

/**
 * 最坏的跟随节拍：箱式呼吸屏息在吸满、呼空两头，起伏走得最满；只有一层，没有别的层来冲淡；再加滑音
 * （它在屏息时不响，一开一停也是起伏）。屏息越长短期响度在两头停得越久，起伏又随随机种子变：
 * 每个种子都要平稳，报告里列最坏的那个种子
 */
async function pacedSoloCase(x: Ctx, key: LayerKey, step: number, seeds: number): Promise<QaCase> {
  const total = QA.preroll + x.seconds
  let worst: { m: Metrics; r: Rendered } | null = null
  const all: Metrics[] = []
  for (let k = 0; k < seeds; k++) {
    const scene: Scene = {
      mix: solo(key),
      mode: 'relax',
      seconds: total,
      motion: 'paced',
      pattern: boxBreath(step),
      glide: true,
      seed: QA.seed + k,
    }
    const r = await renderScene(scene, x.store, x.sr)
    const m = measure(r.audio, x.sr, Math.round(QA.preroll * x.sr))
    all.push(m)
    if (!worst || m.maxSwing > worst.m.maxSwing) worst = { m, r }
  }
  const most = (f: (m: Metrics) => number): number => Math.max(...all.map(f))
  const farthest = all.reduce((a, b) =>
    Math.abs(b.lufs - LOUDNESS.target.relax) > Math.abs(a.lufs - LOUDNESS.target.relax) ? b : a,
  )
  const checks = [
    atMost(
      '20 秒内升幅（LU）',
      most(m => m.maxRise),
      LOUDNESS.maxRise,
    ),
    atMost(
      '30 秒内变化（LU）',
      most(m => m.maxSwing),
      LOUDNESS.maxSwing,
    ),
    within('综合响度（LUFS）', farthest.lufs, LOUDNESS.target.relax, LOUDNESS.tolerance + 0.5),
    atMost(
      '真峰值（dBTP）',
      most(m => m.truePeak),
      LOUDNESS.truePeak,
    ),
    atMost(
      '直流',
      most(m => m.dc),
      QA.maxDc,
    ),
    atMost(
      '咔哒声',
      most(m => m.click),
      QA.maxClick,
    ),
  ]
  const label = `paced/箱式 ${step} 秒 + 滑音（只有 ${key}${seeds > 1 ? `，${seeds} 个种子` : ''}）`
  return done(label, 'paced', worst!.m, checks, worst!.r, x)
}

/** 钟声或提示音叠在默认背景声上：短期响度最多比背景声高 3 LU */
async function overBedCase(
  x: Ctx,
  label: string,
  group: 'bell' | 'cue',
  extra: Pick<Scene, 'bells' | 'cues'>,
  span: number,
): Promise<QaCase> {
  const at = QA.preroll
  const total = at + span
  const base: Scene = { mix: DEFAULT_RELAX, mode: 'relax', seconds: total }
  const withEvent = await renderScene({ ...base, ...extra }, x.store, x.sr)
  const bed = await renderScene(base, x.store, x.sr)
  const alone = await renderScene({ ...base, ...extra, noBed: true }, x.store, x.sr)
  const from = Math.round((at - 3) * x.sr)
  const bedLufs = integratedLoudness(bed.audio, x.sr, from)
  const st = blockLoudness(withEvent.audio, x.sr, 3, 0.1, from)
  const over = Math.max(...st) - bedLufs
  const m = measure(withEvent.audio, x.sr, from)
  const a = measure(alone.audio, x.sr, Math.round((at - 0.5) * x.sr))
  const checks = [
    atMost('短期响度 − 背景声（LU）', over, LOUDNESS.overBed),
    atMost('真峰值（dBTP）', m.truePeak, LOUDNESS.truePeak),
    atMost('单独：直流', a.dc, QA.maxDc),
    atMost('单独：咔哒声', a.click, QA.maxClick),
  ]
  return done(`${group}/${label}`, group, m, checks, withEvent, x)
}

/** 限幅器：平时完全透明；各路音量开到最大时真峰值也不过 −3 dBTP */
async function limiterCases(x: Ctx): Promise<QaCase[]> {
  const out: QaCase[] = []
  // −20 dBFS 的正弦经音量 100 的母线（带 boost）和总音量 100：进出电平一致，只差预读的延迟
  const tone = { bus: 'ambience' as const, freq: 1000, dbfs: -20 - 20 * Math.log10(1.4) }
  for (const dynamics of ['worklet', 'fallback'] as const) {
    const r = await renderScene(
      {
        mix: { ambience: 'none', music: 'none' },
        mode: 'relax',
        seconds: 3,
        volumes: { master: 100, ambience: 100 },
        noBed: true,
        tone,
        dynamics,
      },
      x.store,
      x.sr,
    )
    const m = measure(r.audio, x.sr, Math.round(1 * x.sr))
    out.push(
      done(`limiter/${dynamics} 透明`, 'limiter', m, [within('正弦峰值（dBFS）', m.peakDb, -20, 0.2)], r, x),
    )
  }
  for (const dynamics of ['worklet', 'fallback'] as const) {
    const r = await renderScene(
      {
        mix: { ambience: 'rain', music: 'drone' },
        mode: 'relax',
        seconds: 30,
        volumes: { master: 100, ambience: 100, music: 100, cues: 100 },
        bells: [{ kind: 'start', at: 14 }],
        cues: [
          { kind: 'section', at: 20 },
          { kind: 'ninth', at: 24 },
        ],
        dynamics,
      },
      x.store,
      x.sr,
    )
    const m = measure(r.audio, x.sr, Math.round(4 * x.sr))
    // 后备的压缩器只看采样峰值，按 R 128 的 −1 dBTP 要求；Worklet 守 −3 dBTP
    const ceiling = dynamics === 'worklet' ? LOUDNESS.truePeak : -1
    out.push(
      done(
        `limiter/${dynamics} 最大音量`,
        'limiter',
        m,
        [atMost('真峰值（dBTP）', m.truePeak, ceiling), atMost('咔哒声', m.click, QA.maxClick)],
        r,
        x,
      ),
    )
  }
  return out
}

export interface QaOptions {
  store: BufferStore
  sampleRate?: number
  /** 每个场景测量的秒数（不含开头的预热） */
  seconds?: number
  /** 保留渲染结果（试听、导出 WAV 用） */
  keepAudio?: boolean
  /** 只跑名字匹配的场景 */
  only?: (label: string) => boolean
  onProgress?: (done: number, total: number, label: string) => void
}

interface Job {
  label: string
  run: () => Promise<QaCase | QaCase[]>
}

export async function runQa(options: QaOptions): Promise<QaReport> {
  const t0 = performance.now()
  const x: Ctx = {
    store: options.store,
    sr: options.sampleRate ?? QA.sampleRate,
    seconds: options.seconds ?? QA.seconds,
    keepAudio: options.keepAudio ?? false,
  }
  const relaxAmb: QaCase[] = []
  const relaxMus: QaCase[] = []
  const sleepAll: QaCase[] = []
  const jobs: Job[] = []
  const keep =
    (into: QaCase[], fn: () => Promise<QaCase>): (() => Promise<QaCase>) =>
    async () => {
      const c = await fn()
      into.push(c)
      return c
    }
  for (const id of AMBIENCE_IDS)
    jobs.push({ label: `ambience/${id}`, run: keep(relaxAmb, () => layerCase(x, id, 'relax')) })
  for (const id of MUSIC_IDS)
    jobs.push({ label: `music/${id}`, run: keep(relaxMus, () => layerCase(x, id, 'relax')) })
  for (const id of [...SLEEP_AMBIENCES, ...SLEEP_MUSIC])
    jobs.push({ label: `sleep/${id}`, run: keep(sleepAll, () => layerCase(x, id, 'sleep')) })
  jobs.push(
    { label: 'ambience/birds 鸟鸣电平', run: () => birdsCase(x, 'birds') },
    { label: 'ambience/forest 鸟鸣电平', run: () => birdsCase(x, 'forest') },
    {
      label: 'preset/默认放松',
      run: () => presetCase(x, `默认放松（${mixLabel(DEFAULT_RELAX)}）`, DEFAULT_RELAX, 'relax'),
    },
    {
      label: 'preset/默认睡前',
      run: () => presetCase(x, `默认睡前（${mixLabel(DEFAULT_SLEEP)}）`, DEFAULT_SLEEP, 'sleep'),
    },
    { label: 'preset/放松 雨 + 长音', run: () => presetCase(x, '放松（rain + drone）', RAIN_DRONE, 'relax') },
    { label: 'preset/睡前 雨 + 长音', run: () => presetCase(x, '睡前（rain + drone）', RAIN_DRONE, 'sleep') },
    {
      label: 'preset/海浪 + 五声',
      run: () =>
        presetCase(x, '放松（ocean + pentatonic）', { ambience: 'ocean', music: 'pentatonic' }, 'relax'),
    },
    { label: 'switch/声景', run: async () => switchCase(x, '声景', relaxAmb) },
    { label: 'switch/音乐', run: async () => switchCase(x, '音乐', relaxMus) },
    { label: 'switch/睡前', run: async () => switchCase(x, '睡前', sleepAll) },
    { label: 'switch/练习中换声音', run: () => liveSwitchCase(x) },
    {
      label: 'paced/慢呼吸',
      run: () => pacedCase(x, '慢呼吸（海浪 + 长音）', { ambience: 'ocean', music: 'drone' }, SLOW_BREATH),
    },
    {
      label: 'paced/叹息',
      run: () => pacedCase(x, '周期性叹息（雨 + 回响）', { ambience: 'rain', music: 'phasing' }, SIGH_BREATH),
    },
    {
      label: 'paced/箱式',
      run: () => pacedCase(x, '箱式（风 + 五声）', { ambience: 'wind', music: 'pentatonic' }, BOX_BREATH),
    },
  )
  for (const key of ['ocean', 'drone', 'pentatonic', 'phasing'] as const)
    for (const [step, seeds] of QA.boxRuns)
      jobs.push({ label: `paced/箱式 单层 ${key} ${step}s`, run: () => pacedSoloCase(x, key, step, seeds) })
  if (x.sr !== QA.altRate) {
    for (const id of MUSIC_IDS) {
      const key = layerKey('music', id)
      if (!key || !layerAssets(key).includes('ir')) continue
      jobs.push({
        label: `rate/${key}`,
        run: () => rateCase(x, key, relaxMus.find(c => c.label === `music/${key}`)?.metrics?.lufs),
      })
    }
  }
  for (const kind of ['start', 'interval', 'end'] as const) {
    const span = kind === 'end' ? 30 : 14
    jobs.push({
      label: `bell/${kind}`,
      run: () => overBedCase(x, kind, 'bell', { bells: [{ kind, at: QA.preroll }] }, span),
    })
  }
  for (const kind of CUE_KINDS) {
    jobs.push({
      label: `cue/${kind}`,
      run: () => overBedCase(x, kind, 'cue', { cues: [{ kind, at: QA.preroll }] }, 8),
    })
  }
  jobs.push({ label: 'limiter', run: () => limiterCases(x) })

  const selected = jobs.filter(j => !options.only || options.only(j.label))
  const cases: QaCase[] = []
  for (const [i, job] of selected.entries()) {
    options.onProgress?.(i, selected.length, job.label)
    const c = await job.run()
    cases.push(...(Array.isArray(c) ? c : [c]))
  }
  options.onProgress?.(selected.length, selected.length, '')
  return { sampleRate: x.sr, cases, ok: cases.every(c => c.ok), ms: Math.round(performance.now() - t0) }
}

/* ---------- 校准 ---------- */

export interface CalibrationRow {
  key: LayerKey
  mode: SoundMode
  /** 用当前校准值渲染时测得的综合响度 */
  measured: number
  target: number
  /** 现在的校准值与建议的校准值（dB） */
  trim: number
  suggested: number
}

export interface CalibrationOptions {
  store: BufferStore
  sampleRate?: number
  seconds?: number
  keys?: readonly LayerKey[]
  modes?: readonly SoundMode[]
  onProgress?: (done: number, total: number, label: string) => void
}

/** 每一层单独在默认音量下渲染几分钟，测综合响度，算出让它正好落在目标上的校准值 */
export async function calibrate(options: CalibrationOptions): Promise<CalibrationRow[]> {
  const sr = options.sampleRate ?? QA.sampleRate
  const seconds = options.seconds ?? QA.calibrateSeconds
  const keys = options.keys ?? ([...AMBIENCE_IDS, ...MUSIC_IDS] as LayerKey[])
  const modes = options.modes ?? (['relax', 'sleep'] as const)
  const jobs = keys.flatMap(key => modes.map(mode => ({ key, mode })))
  const rows: CalibrationRow[] = []
  for (const [i, { key, mode }] of jobs.entries()) {
    options.onProgress?.(i, jobs.length, `${key} ${mode}`)
    const total = QA.preroll + seconds
    const r = await renderScene({ mix: solo(key), mode, seconds: total }, options.store, sr)
    const measured = integratedLoudness(r.audio, sr, Math.round(QA.preroll * sr))
    const target = LOUDNESS.target[mode]
    const trim = LAYER_TRIMS[key][mode]
    rows.push({
      key,
      mode,
      measured,
      target,
      trim,
      suggested: Math.round((trim + target - measured) * 10) / 10,
    })
  }
  options.onProgress?.(jobs.length, jobs.length, '')
  return rows
}

/** 把校准结果写成 params.ts 里 LAYER_TRIMS 的样子，直接粘贴 */
export function trimsSource(rows: readonly CalibrationRow[]): string {
  const keys = [...new Set(rows.map(r => r.key))]
  const lines = keys.map(key => {
    const get = (mode: SoundMode) =>
      rows.find(r => r.key === key && r.mode === mode)?.suggested ?? LAYER_TRIMS[key][mode]
    return `  ${key}: { relax: ${get('relax')}, sleep: ${get('sleep')} },`
  })
  return `export const LAYER_TRIMS: Record<LayerKey, Record<SoundMode, number>> = {\n${lines.join('\n')}\n}`
}
