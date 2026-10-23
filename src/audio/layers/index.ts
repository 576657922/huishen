/**
 * 声景与音乐的登记表：名字 → 母线、需要的素材、创建函数。引擎和离线质检都从这里建层，校准完全一致。
 */
import { AMBIENCE_ASSETS, type AssetName, MUSIC_ASSETS } from '../dsp/assets'
import type { LayerKey } from '../params'
import type { AmbienceId, MusicId } from '../types'
import { createBirds, createForest } from './birds'
import type { LayerFactory } from './core'
import { createDrone } from './drone'
import { noiseLayer } from './noise'
import { createOcean } from './ocean'
import { createPentatonic } from './pentatonic'
import { createPhasing } from './phasing'
import { createRain } from './rain'
import { createStream } from './stream'
import { createWind } from './wind'

export type { Buffers, Layer, LayerOptions } from './core'

export type LayerKind = 'ambience' | 'music'

type Ambience = Exclude<AmbienceId, 'none'>
type Music = Exclude<MusicId, 'none'>

const AMBIENCE: Record<Ambience, LayerFactory> = {
  rain: createRain,
  stream: createStream,
  ocean: createOcean,
  forest: createForest,
  birds: createBirds,
  wind: createWind,
  pink: noiseLayer('pink'),
  brown: noiseLayer('brown'),
}

const MUSIC: Record<Music, LayerFactory> = {
  drone: createDrone,
  pentatonic: createPentatonic,
  phasing: createPhasing,
}

/** 按证据排序（产品规格 §2）：水声在前 */
export const AMBIENCE_IDS = Object.keys(AMBIENCE) as Ambience[]
export const MUSIC_IDS = Object.keys(MUSIC) as Music[]

export const isAmbienceLayer = (id: string): id is Ambience => Object.hasOwn(AMBIENCE, id)
export const isMusicLayer = (id: string): id is Music => Object.hasOwn(MUSIC, id)

/** 这个声音在哪条母线上 */
export const kindOf = (key: LayerKey): LayerKind => (isAmbienceLayer(key) ? 'ambience' : 'music')

/** 把 'none' 排除在外，得到可以建层的名字；声景的名字放在音乐母线上（或反过来）也返回 null */
export function layerKey(kind: LayerKind, id: AmbienceId | MusicId): LayerKey | null {
  if (kind === 'ambience') return isAmbienceLayer(id) ? id : null
  return isMusicLayer(id) ? id : null
}

export function layerAssets(key: LayerKey): readonly AssetName[] {
  return isAmbienceLayer(key) ? AMBIENCE_ASSETS[key] : MUSIC_ASSETS[key as Music]
}

export function layerFactory(key: LayerKey): LayerFactory {
  return isAmbienceLayer(key) ? AMBIENCE[key] : MUSIC[key as Music]
}
