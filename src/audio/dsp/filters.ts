/**
 * 双二阶滤波器（RBJ Audio EQ Cookbook）。纯函数，不依赖 Web Audio，可以在 Worker 和 Node 里运行。
 */
import type { Task } from './task'
import { due } from './util'

export type BiquadType = 'lowpass' | 'highpass' | 'bandpass' | 'peaking' | 'lowshelf' | 'highshelf'

/** 已按 a0 归一的系数 */
export interface BiquadCoefs {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

export type Filter = (x: number) => number

function norm(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): BiquadCoefs {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

function shelf(high: boolean, A: number, cw: number, alpha: number): BiquadCoefs {
  const s = 2 * Math.sqrt(A) * alpha
  const k = high ? 1 : -1
  return norm(
    A * (A + 1 + k * (A - 1) * cw + s),
    -2 * k * A * (A - 1 + k * (A + 1) * cw),
    A * (A + 1 + k * (A - 1) * cw - s),
    A + 1 - k * (A - 1) * cw + s,
    2 * k * (A - 1 - k * (A + 1) * cw),
    A + 1 - k * (A - 1) * cw - s,
  )
}

/** bandpass 为「峰值 0 dB」的形式，与原型一致；gainDb 只对 peaking 和搁架有效 */
export function biquadCoefs(type: BiquadType, freq: number, q: number, sr: number, gainDb = 0): BiquadCoefs {
  const w = (2 * Math.PI * freq) / sr
  const cw = Math.cos(w)
  const alpha = Math.sin(w) / (2 * q)
  const A = 10 ** (gainDb / 40)
  switch (type) {
    case 'lowpass':
      return norm((1 - cw) / 2, 1 - cw, (1 - cw) / 2, 1 + alpha, -2 * cw, 1 - alpha)
    case 'highpass':
      return norm((1 + cw) / 2, -(1 + cw), (1 + cw) / 2, 1 + alpha, -2 * cw, 1 - alpha)
    case 'bandpass':
      return norm(alpha, 0, -alpha, 1 + alpha, -2 * cw, 1 - alpha)
    case 'peaking':
      return norm(1 + alpha * A, -2 * cw, 1 - alpha * A, 1 + alpha / A, -2 * cw, 1 - alpha / A)
    case 'lowshelf':
      return shelf(false, A, cw, alpha)
    case 'highshelf':
      return shelf(true, A, cw, alpha)
  }
}

/** 有状态的滤波器闭包（直接 I 型），每个采样调用一次 */
export function fromCoefs(c: BiquadCoefs): Filter {
  const { b0, b1, b2, a1, a2 } = c
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  return x => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    return y
  }
}

export function biquad(type: BiquadType, freq: number, q: number, sr: number, gainDb = 0): Filter {
  return fromCoefs(biquadCoefs(type, freq, q, sr, gainDb))
}

/** 串联多个滤波器 */
export function chain(filters: readonly Filter[]): Filter {
  return x => {
    let y = x
    for (const f of filters) y = f(y)
    return y
  }
}

/**
 * 原地滤波，分块让出。circular 为 true 时先空跑一遍，让滤波器状态等于「从结尾接回开头」的状态，
 * 这样处理过的循环素材在接缝处仍然连续。
 */
export function* filterInPlace(a: Float32Array, f: Filter, circular = false): Task<void> {
  if (circular) {
    for (let i = 0; i < a.length; i++) {
      f(a[i]!)
      if (due(i)) yield
    }
  }
  for (let i = 0; i < a.length; i++) {
    a[i] = f(a[i]!)
    if (due(i)) yield
  }
}

/** 一阶低通：y += k (x − y)，k 越大越亮 */
export function onePole(k: number): Filter {
  let y = 0
  return x => {
    y += k * (x - y)
    return y
  }
}
