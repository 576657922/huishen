/**
 * 粉噪声、棕噪声：用来遮蔽环境里断断续续的噪音（证据很弱，不作健康声明）。
 * 都低通在 8 kHz，滤掉 30 Hz 以下；两个声道各自独立，声音有宽度，单声道播放时也不会抵消。
 */
import { mulberry32 } from '@/lib/random'
import { biquad } from './filters'
import { brownFilter, pinkFilter } from './noise'
import type { Task } from './task'
import { type Channels, due } from './util'

export type NoiseColor = 'pink' | 'brown'

export interface ColorParams {
  seed: number
  hp: number
  lp: number
}

export function* colorNoise(sr: number, n: number, color: NoiseColor, p: ColorParams): Task<Channels> {
  const out: Channels = []
  for (let c = 0; c < 2; c++) {
    const rng = mulberry32(p.seed + c * 4099)
    const shape = color === 'pink' ? pinkFilter() : brownFilter()
    const hp = biquad('highpass', p.hp, 0.7, sr)
    const lp = biquad('lowpass', p.lp, 0.7, sr)
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      a[i] = lp(hp(shape(rng() * 2 - 1)))
      if (due(i)) yield
    }
    out.push(a)
  }
  return out
}
