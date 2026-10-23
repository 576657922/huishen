/**
 * 声景里实时随机安排的单次音（重雨滴、鸟鸣）：不放进循环素材，所以永远不会按循环的周期重复出现。
 */
import { dbToGain } from '../dsp/util'
import { biquadNode, gainNode, panNode } from '../graph'
import { ONESHOT_LUFS } from '../params'
import type { LayerCore } from './core'

export interface ShotOptions {
  /** 目标瞬时响度最大值（LUFS，层内电平：与层里循环素材的 ASSET_LUFS 同一把尺子） */
  lufs: number
  /** 播放速率：同时改变音高与长短 */
  rate: number
  pan: number
  /** 低通截止（Hz）；不填不加 */
  cutoff?: number
}

/**
 * 单次音素材按「两个声道都响」归一到 ONESHOT_LUFS；经过声像之后总功率只剩一半，所以再乘 √2，
 * 放在哪个方位听起来都一样响
 */
export function shotGain(lufs: number): number {
  return dbToGain(lufs - ONESHOT_LUFS) * Math.SQRT2
}

export function playShot(
  core: LayerCore,
  dest: AudioNode,
  buffer: AudioBuffer,
  at: number,
  o: ShotOptions,
): void {
  const { ctx } = core
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = o.rate
  const g = gainNode(ctx, shotGain(o.lufs))
  const pan = panNode(ctx, o.pan)
  const nodes: AudioNode[] = [g, pan]
  if (o.cutoff !== undefined) {
    const lp = biquadNode(ctx, 'lowpass', o.cutoff, 0.7)
    src.connect(lp).connect(g)
    nodes.unshift(lp)
  } else src.connect(g)
  g.connect(pan).connect(dest)
  core.play(src, nodes, at, at + buffer.duration / o.rate + 0.02)
}
