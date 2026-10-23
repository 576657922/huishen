/**
 * 多声道采样数组的通用处理：电平、循环、淡入淡出。全部原地修改并返回原数组，便于串联。
 * 要遍历上百万个采样的处理写成生成任务，每处理 CHUNK 个采样让出一次，主线程后备路径不卡界面。
 */
import type { Task } from './task'

export type Channels = Float32Array[]

/** 生成任务每处理这么多个采样让出一次：最慢的手机上一块也在几毫秒内 */
export const CHUNK = 16384
const MASK = CHUNK - 1

/** 在循环里调用：第 i 个采样处理完后是否该让出 */
export const due = (i: number): boolean => (i & MASK) === MASK

export const dbToGain = (db: number): number => 10 ** (db / 20)

export const gainToDb = (g: number): number => 20 * Math.log10(Math.max(Math.abs(g), 1e-12))

export const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12)

export function rmsOf(chs: readonly Float32Array[]): number {
  let s = 0
  let n = 0
  for (const a of chs) {
    for (let i = 0; i < a.length; i++) {
      const v = a[i]!
      s += v * v
    }
    n += a.length
  }
  return n ? Math.sqrt(s / n) : 0
}

export function peakOf(chs: readonly Float32Array[]): number {
  let p = 0
  for (const a of chs) for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i]!))
  return p
}

export function scale<T extends Float32Array[]>(chs: T, k: number): T {
  for (const a of chs) for (let i = 0; i < a.length; i++) a[i] = a[i]! * k
  return chs
}

/** 逐采样原地变换，分块让出 */
export function* mapInPlace(chs: readonly Float32Array[], f: (x: number) => number): Task<void> {
  for (const a of chs) {
    for (let i = 0; i < a.length; i++) {
      a[i] = f(a[i]!)
      if (due(i)) yield
    }
  }
}

/** 把峰值柔和地压到 RMS 的 k 倍以内，避免个别水泡、雨滴太尖 */
export function* softPeak<T extends Float32Array[]>(chs: T, k: number): Task<T> {
  const c = k * rmsOf(chs)
  if (c > 0) yield* mapInPlace(chs, x => c * Math.tanh(x / c))
  return chs
}

/**
 * 做成无缝循环：素材比循环长 xf 个采样，把多出的尾巴用等功率曲线叠回开头。
 * 循环时末尾接回开头，正好是原素材里连续的两段，所以接缝处既没有跳变，能量也不塌陷。
 */
export function loopify(chs: readonly Float32Array[], n: number, xf: number): Channels {
  return chs.map(a => {
    const o = new Float32Array(n)
    o.set(a.subarray(0, n))
    for (let i = 0; i < xf; i++) {
      const q = (i / xf) * (Math.PI / 2)
      o[i] = a[i]! * Math.sin(q) + a[n + i]! * Math.cos(q)
    }
    return o
  })
}

export function removeDc<T extends Float32Array[]>(chs: T): T {
  for (const a of chs) {
    let s = 0
    for (let i = 0; i < a.length; i++) s += a[i]!
    const m = a.length ? s / a.length : 0
    for (let i = 0; i < a.length; i++) a[i] = a[i]! - m
  }
  return chs
}

/** 去直流，分块让出 */
export function* removeDcTask<T extends Float32Array[]>(chs: T): Task<T> {
  for (const a of chs) {
    let s = 0
    for (let i = 0; i < a.length; i++) {
      s += a[i]!
      if (due(i)) yield
    }
    const m = a.length ? s / a.length : 0
    yield* mapInPlace([a], x => x - m)
  }
  return chs
}

/** 首尾升余弦淡入淡出，避免单次音的开头和截断处有咔哒声 */
export function fadeEdges(a: Float32Array, sr: number, fadeIn: number, fadeOut: number): Float32Array {
  const ni = Math.min(a.length, Math.floor(fadeIn * sr))
  for (let i = 0; i < ni; i++) a[i] = a[i]! * ((1 - Math.cos((Math.PI * i) / ni)) / 2)
  const no = Math.min(a.length, Math.floor(fadeOut * sr))
  for (let i = 0; i < no; i++) {
    const j = a.length - 1 - i
    a[j] = a[j]! * ((1 - Math.cos((Math.PI * i) / no)) / 2)
  }
  return a
}

/**
 * 正弦振荡的二阶递推：每个采样一次乘加，比逐点 Math.sin 快得多；
 * 双精度下几十秒内的相位漂移可以忽略。第一次调用返回 sin(phase)。
 */
export function sineOsc(w: number, phase: number): () => number {
  const k = 2 * Math.cos(w)
  let y1 = Math.sin(phase - w)
  let y2 = Math.sin(phase - 2 * w)
  return () => {
    const y = k * y1 - y2
    y2 = y1
    y1 = y
    return y
  }
}

/** 前 seconds 秒的 RMS，用于让单次音的响度一致（峰值会因起音而异） */
export function headRms(a: Float32Array, sr: number, seconds: number): number {
  const n = Math.min(a.length, Math.floor(seconds * sr))
  let s = 0
  for (let i = 0; i < n; i++) s += a[i]! * a[i]!
  return n ? Math.sqrt(s / n) : 0
}

/** 等功率声像：pan 为 −1（左）到 1（右），返回左右声道增益 */
export function panGains(pan: number): [number, number] {
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4
  return [Math.cos(a), Math.sin(a)]
}
