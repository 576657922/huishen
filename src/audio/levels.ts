/**
 * 电平校准的换算。所有目标都定义在默认音量（总 80、声景 55、音乐 45、提示音 70）下：
 * - 背景声（声景、音乐，或两者一起）= −23 LUFS，睡前 −28 LUFS。两层一起时按两条母线默认音量的比例分配
 *   （声景约 −24.8、音乐约 −27.6 LUFS）；只有一层时由「补位」把另一层的份额补上，
 *   所以选不选音乐、换成哪种声景，综合响度都不变；
 * - 每一层单独校准到它的份额（params.LAYER_TRIMS，离线实测）；
 * - 提示音、钟声、滑音按「比背景声目标高或低多少 LU」给出（params.LEVELS），这里换算成播放增益。
 */
import { dbToGain, gainToDb } from './dsp/util'
import {
  BELL,
  DEFAULT_VOLUMES,
  LAYER_TRIMS,
  type LayerKey,
  LEVELS,
  LOUDNESS,
  ONESHOT_LUFS,
  VOLUME,
} from './params'
import type { BellKind, Bus, CueKind, SoundMode } from './types'

export type BedKind = 'ambience' | 'music'

/** 感知音量曲线：0–100 → 增益。master 不乘 boost，100 即原样 */
export function volumeGain(v: number, bus: Bus): number {
  const x = Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0)) / 100
  return x ** VOLUME.exponent * (bus === 'master' ? 1 : VOLUME.boost)
}

/** 某条母线在音量 v 时的增益（dB） */
export const volumeDb = (v: number, bus: Bus): number => gainToDb(volumeGain(v, bus))

const power = (db: number): number => 10 ** (db / 10)

/** 两层一起时，这一层在默认音量下分到的响度份额（dB，≤ 0） */
function shareDb(kind: BedKind): number {
  const amb = power(volumeDb(DEFAULT_VOLUMES.ambience, 'ambience'))
  const mus = power(volumeDb(DEFAULT_VOLUMES.music, 'music'))
  return 10 * Math.log10((kind === 'ambience' ? amb : mus) / (amb + mus))
}

/** 每一层在默认音量下、两层都在时的目标综合响度（LUFS）；校准按它定 */
export const layerTarget = (kind: BedKind, mode: SoundMode): number => LOUDNESS.target[mode] + shareDb(kind)

/**
 * 补位（dB）：另一层没有时，把它的份额补到这一层上，背景声在默认音量下仍是目标响度。
 * 这只看选了哪些层，不看音量：用户把音乐调到 0 是自己的选择，不补
 */
export const presenceDb = (kind: BedKind, otherPresent: boolean): number =>
  otherPresent ? 0 : -shareDb(kind)

/** 层的校准增益（线性） */
export const layerTrim = (key: LayerKey, mode: SoundMode): number => dbToGain(LAYER_TRIMS[key][mode])

/** 提示音母线和总音量在默认音量下合起来的增益（dB） */
const cueChainDb = (): number =>
  volumeDb(DEFAULT_VOLUMES.cues, 'cues') + volumeDb(DEFAULT_VOLUMES.master, 'master')

/** 单次音的播放增益（dB）：素材的瞬时响度最大值是 ONESHOT_LUFS，要落在背景声目标 + rel LU */
export const oneShotDb = (rel: number): number => LOUDNESS.target.relax + rel - ONESHOT_LUFS - cueChainDb()

/** 一个提示音的增益（线性）；屏息、停、数息这些轻提示更轻 */
export const cueGain = (kind: CueKind): number => dbToGain(oneShotDb(LEVELS.cues[kind]))

/** 一次钟声的每一击：相对时刻（秒）和增益（线性） */
export function bellStrikes(kind: BellKind): [number, number][] {
  return BELL.strikes[kind].map(([t, db]) => [t, dbToGain(oneShotDb(LEVELS.bell) + db)])
}

/** 一次钟声从第一击到余音结束的秒数 */
export function bellSpan(kind: BellKind): number {
  return Math.max(...BELL.strikes[kind].map(([t]) => t)) + BELL.seconds
}

/**
 * 滑音振荡器的振幅：单声道的正弦上混到两个声道，响度 ≈ 20·log10(A) − 0.69 LUFS
 * （220–330 Hz 处 K 计权几乎是 0 dB，泛音只多出不到 0.1 dB）
 */
export const glideAmp = (): number => dbToGain(LOUDNESS.target.relax + LEVELS.glide - cueChainDb() + 0.691)
