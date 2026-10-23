/**
 * 噪声源。所有随机数都来自固定种子，同一参数每次生成的结果完全相同。
 */
import type { Filter } from './filters'

export type Rng = () => number

/** 均匀白噪声，[-1, 1) */
export const white = (rng: Rng): number => rng() * 2 - 1

/** Paul Kellet 的粉红噪声滤波（精确版）：输入白噪声，输出约 −3 dB/倍频程 */
export function pinkFilter(): Filter {
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  return w => {
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    const p = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
    return p
  }
}

/** 带泄漏的积分器，近似布朗噪声（−6 dB/倍频程）；泄漏避免直流漂移 */
export function brownFilter(): Filter {
  let y = 0
  return w => {
    y = (y + 0.02 * w) / 1.02
    return y
  }
}

/**
 * 值噪声：每隔 rate/freq 个点取一个随机节点，节点之间余弦插值。
 * 输出 n 个点，范围 [0, 1)。用于缓慢的包络。
 */
export function valueNoise(rng: Rng, n: number, rate: number, freq: number): Float32Array {
  const step = rate / freq
  const knots = Math.ceil(n / step) + 3
  const k = new Float32Array(knots)
  for (let i = 0; i < knots; i++) k[i] = rng()
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = i / step
    const j = x | 0
    const u = (1 - Math.cos(Math.PI * (x - j))) / 2
    out[i] = k[j]! * (1 - u) + k[j + 1]! * u
  }
  return out
}

/** 整数哈希到 [0, 1)：无状态，任意位置可以直接求值 */
export function hash01(seed: number, i: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed, 0x27d4eb2d)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** 无状态的值噪声：t 秒处的值，范围 [0, 1)；适合实时排程时按时间直接取值 */
export function smoothNoise(seed: number, t: number, freq: number): number {
  const x = t * freq
  const j = Math.floor(x)
  const u = (1 - Math.cos(Math.PI * (x - j))) / 2
  return hash01(seed, j) * (1 - u) + hash01(seed, j + 1) * u
}

/**
 * 首尾相接的值噪声：knots 个随机节点均匀分布在一圈上，节点之间余弦插值，第 n 个点正好接回第 0 个点。
 * 用于循环素材里的疏密变化，接缝处不会突然变密或变疏。范围 [0, 1)
 */
export function periodicNoise(rng: Rng, n: number, knots: number): Float32Array {
  const m = Math.max(2, Math.round(knots))
  const k = Float32Array.from({ length: m }, () => rng())
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / n) * m
    const j = x | 0
    const u = (1 - Math.cos(Math.PI * (x - j))) / 2
    out[i] = k[j % m]! * (1 - u) + k[(j + 1) % m]! * u
  }
  return out
}
