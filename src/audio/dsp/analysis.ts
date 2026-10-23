/**
 * 质检用的测量。纯函数：浏览器里测离线渲染的结果，Node 里测生成的素材，用的是同一套算法。
 * 响度按 ITU-R BS.1770-4 / EBU R 128（K 计权；400 ms 块、75% 重叠；绝对门限 −70 LUFS、相对门限 −10 LU；
 * 短期响度 3 秒窗、每 0.1 秒一个），响度范围按 EBU Tech 3342，真峰值按 4 倍过采样（见 oversample.ts）。
 */
import { type BiquadCoefs, fromCoefs } from './filters'
import { truePeak } from './oversample'
import { runSync, type Task } from './task'
import { due, gainToDb } from './util'

type Chs = readonly Float32Array[]

const len = (chs: Chs): number => chs[0]?.length ?? 0

export function rmsDb(chs: Chs, from = 0, to = len(chs)): number {
  let s = 0
  for (const a of chs) for (let i = from; i < to; i++) s += a[i]! * a[i]!
  const n = (to - from) * chs.length
  return n > 0 ? gainToDb(Math.sqrt(s / n)) : -240
}

export function peakDb(chs: Chs, from = 0, to = len(chs)): number {
  let p = 0
  for (const a of chs) for (let i = from; i < to; i++) p = Math.max(p, Math.abs(a[i]!))
  return gainToDb(p)
}

/** 各声道平均值中绝对值最大的一个 */
export function dcOffset(chs: Chs, from = 0, to = len(chs)): number {
  let worst = 0
  for (const a of chs) {
    let s = 0
    for (let i = from; i < to; i++) s += a[i]!
    worst = Math.max(worst, Math.abs(s / Math.max(1, to - from)))
  }
  return worst
}

/** 最大的相邻采样差相对整体 RMS 的倍数：粗略的跳变指标，只作参考 */
export function maxJumpRatio(chs: Chs, from = 0, to = len(chs)): number {
  let jump = 0
  let s = 0
  for (const a of chs) {
    for (let i = from + 1; i < to; i++) jump = Math.max(jump, Math.abs(a[i]! - a[i - 1]!))
    for (let i = from; i < to; i++) s += a[i]! * a[i]!
  }
  const rms = Math.sqrt(s / Math.max(1, (to - from) * chs.length))
  return rms > 0 ? jump / rms : 0
}

/**
 * 咔哒声评分：取二阶差分（相当于 +12 dB/倍频程的高通），每个值与它前后 ±2 ms（去掉紧挨着的几个采样）
 * 里二阶差分的 RMS 相比，取最大倍数。
 * 正常的声音（雨滴、拨弦的起音）高频能量分布在几毫秒里，倍数不大；
 * 波形断开（循环接缝、突然的增益跳变）只在一两个采样上突变，对平滑的乐音尤其明显，倍数会很大。
 * 小于 −80 dBFS 的突变听不见，不计。
 */
export function clickScore(chs: Chs, sr: number, from = 0, to = len(chs)): number {
  const half = Math.max(8, Math.round(0.002 * sr))
  const gap = 3
  const count = 2 * half + 1 - (2 * gap + 1)
  let worst = 0
  for (const a of chs) {
    const n = to - from
    if (n < 2 * half + 8) continue
    const pre = new Float64Array(n + 1)
    for (let i = 2; i < n; i++) {
      const d = a[from + i]! - 2 * a[from + i - 1]! + a[from + i - 2]!
      pre[i + 1] = pre[i]! + d * d
    }
    const floor = (0.01 * Math.sqrt(pre[n]! / (n - 2))) ** 2 + 1e-14
    for (let i = half + 2; i < n - half - 1; i++) {
      const di = pre[i + 1]! - pre[i]!
      if (di < 1e-8) continue
      const local = (pre[i + half + 1]! - pre[i - half]! - (pre[i + gap + 1]! - pre[i - gap]!)) / count
      worst = Math.max(worst, Math.sqrt(di / (local + floor)))
    }
  }
  return worst
}

/** 循环接缝：末尾接回开头时的跳变，相对接缝两侧各 w 个采样里相邻差 RMS 的倍数（稀疏的声音也适用） */
export function seamJump(a: Float32Array, w = 64): number {
  const n = a.length
  let s = 0
  let c = 0
  for (let i = 1; i < w; i++) {
    const head = a[i]! - a[i - 1]!
    const tail = a[n - i]! - a[n - i - 1]!
    s += head * head + tail * tail
    c += 2
  }
  const rms = Math.sqrt(s / c)
  const jump = Math.abs(a[0]! - a[n - 1]!)
  return rms > 1e-9 ? jump / rms : jump > 1e-6 ? Number.POSITIVE_INFINITY : 0
}

/** BS.1770 的 K 计权两级滤波，按任意采样率求系数（与 libebur128 的做法相同） */
export function kWeightCoefs(sr: number): [BiquadCoefs, BiquadCoefs] {
  let f0 = 1681.974450955533
  let Q = 0.7071752369554196
  const G = 3.999843853973347
  let K = Math.tan((Math.PI * f0) / sr)
  const Vh = 10 ** (G / 20)
  const Vb = Vh ** 0.4996667741545416
  let a0 = 1 + K / Q + K * K
  const shelf = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  }
  f0 = 38.13547087602444
  Q = 0.5003270373238773
  K = Math.tan((Math.PI * f0) / sr)
  a0 = 1 + K / Q + K * K
  const hp = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 }
  return [shelf, hp]
}

/**
 * K 计权后每 hop 秒的能量（各声道相加）。按块计算响度时，一块就是连续几个 hop 的和：
 * 400 ms 块、每 100 ms 一个，正好 4 个 hop。从 from 之前最多 0.5 秒开始滤波，高通的起始暂态落在测量窗口之外。
 * 写成可分片的任务：素材生成时在主线程后备路径里测响度，也不会一次占住主线程。
 */
export function* kHops(chs: Chs, sr: number, hop: number, from = 0, to = len(chs)): Task<Float64Array> {
  const [shelf, hp] = kWeightCoefs(sr)
  const h = Math.max(1, Math.floor(hop * sr))
  const count = Math.max(0, Math.floor((to - from) / h))
  const out = new Float64Array(count)
  const start = Math.max(0, from - Math.floor(0.5 * sr))
  const end = from + count * h
  for (const a of chs) {
    const f1 = fromCoefs(shelf)
    const f2 = fromCoefs(hp)
    for (let i = start; i < end; i++) {
      const y = f2(f1(a[i]!))
      if (i >= from) {
        const k = ((i - from) / h) | 0
        out[k] = out[k]! + y * y
      }
      if (due(i)) yield
    }
  }
  return out
}

const lufsOf = (ms: number): number => (ms > 0 ? -0.691 + 10 * Math.log10(ms) : -240)

/** 由每 hop 的能量求响度序列：每块 m 个 hop、每 hop 一个 */
function blocksOf(hops: Float64Array, m: number, hopSamples: number): number[] {
  const out: number[] = []
  let acc = 0
  for (let i = 0; i < hops.length; i++) {
    acc += hops[i]!
    if (i >= m) acc -= hops[i - m]!
    if (i >= m - 1) out.push(lufsOf(Math.max(0, acc) / (m * hopSamples)))
  }
  return out
}

/** 按窗口计算的响度序列（LUFS）：win 秒窗口，每 hop 秒一个（win 应为 hop 的整数倍） */
export function blockLoudness(
  chs: Chs,
  sr: number,
  win: number,
  hop: number,
  from = 0,
  to = len(chs),
): number[] {
  const hops = runSync(kHops(chs, sr, hop, from, to))
  return blocksOf(hops, Math.max(1, Math.round(win / hop)), Math.max(1, Math.floor(hop * sr)))
}

const powerMean = (xs: readonly number[]): number =>
  xs.length ? xs.reduce((a, x) => a + 10 ** ((x + 0.691) / 10), 0) / xs.length : 0

/** 由 400 ms 块的响度求综合响度：绝对门限 −70，相对门限 −10 LU */
function gated(momentary: readonly number[]): number {
  const blocks = momentary.filter(x => x > -70)
  if (!blocks.length) return -240
  const rel = lufsOf(powerMean(blocks)) - 10
  return lufsOf(powerMean(blocks.filter(x => x > rel)))
}

/** 综合响度（LUFS），可分片执行 */
export function* integratedLoudnessTask(chs: Chs, sr: number, from = 0, to = len(chs)): Task<number> {
  const hops = yield* kHops(chs, sr, 0.1, from, to)
  return gated(blocksOf(hops, 4, Math.max(1, Math.floor(0.1 * sr))))
}

/** 综合响度（LUFS）：400 ms 块、75% 重叠，绝对门限 −70，相对门限 −10 LU */
export function integratedLoudness(chs: Chs, sr: number, from = 0, to = len(chs)): number {
  return runSync(integratedLoudnessTask(chs, sr, from, to))
}

/**
 * 瞬时响度（400 ms 窗）的最大值，每 10 ms 一个窗，不会错过短促的声音。
 * 不足 0.5 秒的声音在后面补静音再测：提示音、雨滴这类单次音也有确定的读数。可分片执行
 */
export function* momentaryMaxTask(chs: Chs, sr: number): Task<number> {
  const min = Math.ceil(0.5 * sr)
  const padded =
    len(chs) >= min
      ? chs
      : chs.map(a => {
          const p = new Float32Array(min)
          p.set(a)
          return p
        })
  const hops = yield* kHops(padded, sr, 0.01, 0, len(padded))
  const xs = blocksOf(hops, 40, Math.max(1, Math.floor(0.01 * sr)))
  return xs.length ? Math.max(...xs) : -240
}

export function momentaryMax(chs: Chs, sr: number): number {
  return runSync(momentaryMaxTask(chs, sr))
}

function percentile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return Number.NaN
  const x = p * (sorted.length - 1)
  const i = Math.floor(x)
  const lo = sorted[i]!
  return lo + ((sorted[Math.min(i + 1, sorted.length - 1)] ?? lo) - lo) * (x - i)
}

/** 响度范围 LRA（LU）：3 秒短期响度（每 0.1 秒一个），绝对门限 −70，相对门限 −20 LU，取第 95 与第 10 百分位之差 */
export function loudnessRange(chs: Chs, sr: number, from = 0, to = len(chs), hop = 0.1): number {
  return lraOf(blockLoudness(chs, sr, 3, hop, from, to))
}

function lraOf(shortTerm: readonly number[]): number {
  const st = shortTerm.filter(x => x > -70)
  const rel = lufsOf(powerMean(st)) - 20
  const kept = st.filter(x => x > rel).sort((a, b) => a - b)
  return kept.length ? percentile(kept, 0.95) - percentile(kept, 0.1) : 0
}

/** 真峰值（dBTP），4 倍过采样 */
export function truePeakDb(chs: Chs, from = 0, to = len(chs)): number {
  return gainToDb(truePeak(chs, from, to))
}

/** 一段声音的响度概况，全部按 BS.1770 / EBU R 128 */
export interface LoudnessStats {
  /** 综合响度（LUFS） */
  integrated: number
  /** 响度范围（LU） */
  lra: number
  /** 瞬时响度（400 ms）的最大值 */
  momentaryMax: number
  /** 短期响度（3 s）的最大值与最小值（只算高于 −70 LUFS 的） */
  shortTermMax: number
  shortTermMin: number
  /** 任意 window 秒之内短期响度的最大升幅（LU）：渐强的度量 */
  maxRise: number
  /** 任意 30 秒之内短期响度的最大变化（LU，升降都算）：平稳的度量 */
  maxSwing: number
  /** 真峰值（dBTP） */
  truePeak: number
}

/**
 * 任意 window 秒之内的最大变化（最大值 − 最小值）：序列每 hop 秒一个值，低于 −70 的（静音）不算。
 * 升幅只管渐强；这里连变轻也算，海浪一类自己有起伏的声音要靠它看整体是否平稳
 */
export function maxSwingWithin(xs: readonly number[], hop: number, window: number): number {
  const span = Math.max(1, Math.round(window / hop))
  let worst = 0
  // 两个单调队列分别维护窗口里的最小值和最大值
  const lo: number[] = []
  const hi: number[] = []
  for (let i = 0; i < xs.length; i++) {
    while (lo.length && lo[0]! < i - span) lo.shift()
    while (hi.length && hi[0]! < i - span) hi.shift()
    const x = xs[i]!
    if (x <= -70) continue
    while (lo.length && xs[lo[lo.length - 1]!]! >= x) lo.pop()
    lo.push(i)
    while (hi.length && xs[hi[hi.length - 1]!]! <= x) hi.pop()
    hi.push(i)
    worst = Math.max(worst, xs[hi[0]!]! - xs[lo[0]!]!)
  }
  return worst
}

/** 任意 window 秒之内的最大升幅：序列每 hop 秒一个值 */
export function maxRiseWithin(xs: readonly number[], hop: number, window: number): number {
  const span = Math.max(1, Math.round(window / hop))
  let worst = 0
  // 单调队列维护窗口里的最小值
  const q: number[] = []
  for (let i = 0; i < xs.length; i++) {
    while (q.length && q[0]! < i - span) q.shift()
    const x = xs[i]!
    if (x > -70 && q.length) worst = Math.max(worst, x - xs[q[0]!]!)
    if (x > -70) {
      while (q.length && xs[q[q.length - 1]!]! >= x) q.pop()
      q.push(i)
    }
  }
  return worst
}

export function loudnessStats(chs: Chs, sr: number, from = 0, to = len(chs), riseWindow = 20): LoudnessStats {
  // 瞬时（400 ms）和短期（3 s）响度都由同一组 100 ms 的能量求出，只滤波一遍
  const hopSamples = Math.max(1, Math.floor(0.1 * sr))
  const hops = runSync(kHops(chs, sr, 0.1, from, to))
  const momentary = blocksOf(hops, 4, hopSamples)
  const shortTerm = blocksOf(hops, 30, hopSamples)
  const audible = shortTerm.filter(x => x > -70)
  return {
    integrated: gated(momentary),
    lra: lraOf(shortTerm),
    momentaryMax: momentary.length ? Math.max(...momentary) : -240,
    shortTermMax: audible.length ? Math.max(...audible) : -240,
    shortTermMin: audible.length ? Math.min(...audible) : -240,
    maxRise: maxRiseWithin(shortTerm, 0.1, riseWindow),
    maxSwing: maxSwingWithin(shortTerm, 0.1, 30),
    truePeak: truePeakDb(chs, from, to),
  }
}

/** 原地基 2 快速傅里叶变换 */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]!
      re[i] = re[j]!
      re[j] = tr
      const ti = im[i]!
      im[i] = im[j]!
      im[j] = ti
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const ang = (-2 * Math.PI) / size
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let s = 0; s < n; s += size) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < size / 2; k++) {
        const a = s + k
        const b = a + size / 2
        const xr = re[b]! * cr - im[b]! * ci
        const xi = re[b]! * ci + im[b]! * cr
        re[b] = re[a]! - xr
        im[b] = im[a]! - xi
        re[a] = re[a]! + xr
        im[a] = im[a]! + xi
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

/**
 * 平均功率谱（Welch 法，Hann 窗，帧长 size、50% 重叠），各声道功率相加，不先混成单声道，
 * 免得左右反相的成分互相抵消。返回 size/2 个频点的功率。
 */
export function powerSpectrum(chs: Chs, from = 0, to = len(chs), size = 4096): Float64Array {
  const half = size / 2
  const acc = new Float64Array(half)
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  const win = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size))
  for (const a of chs) {
    for (let s = from; s + size <= to; s += half) {
      for (let i = 0; i < size; i++) {
        re[i] = a[s + i]! * win[i]!
        im[i] = 0
      }
      fft(re, im)
      for (let k = 0; k < half; k++) acc[k] = acc[k]! + re[k]! * re[k]! + im[k]! * im[k]!
    }
  }
  return acc
}

/** 频谱质心（Hz）：按幅度加权的平均频率，衡量明暗 */
export function centroidOf(p: Float64Array, sr: number, size: number): number {
  let num = 0
  let den = 0
  for (let k = 1; k < p.length; k++) {
    const m = Math.sqrt(p[k]!)
    num += ((k * sr) / size) * m
    den += m
  }
  return den > 0 ? num / den : 0
}

/** 功率谱里 [lo, hi) Hz 的能量（dB，相对值） */
export function bandOf(p: Float64Array, sr: number, size: number, lo: number, hi: number): number {
  let e = 0
  for (let k = 1; k < p.length; k++) {
    const f = (k * sr) / size
    if (f >= lo && f < hi) e += p[k]!
  }
  return 10 * Math.log10(e + 1e-30)
}

export function spectralCentroid(chs: Chs, sr: number, from = 0, to = len(chs), size = 4096): number {
  return centroidOf(powerSpectrum(chs, from, to, size), sr, size)
}

/** 频带 [lo, hi) Hz 里的能量（dB，相对值），用于比较不同频带 */
export function bandEnergyDb(chs: Chs, sr: number, lo: number, hi: number, from = 0, to = len(chs)): number {
  const size = 4096
  return bandOf(powerSpectrum(chs, from, to, size), sr, size, lo, hi)
}

/** 基频估计（YIN 累积均值归一差分函数 + 抛物线插值），用于检验拨弦音准 */
export function estimatePitch(x: Float32Array, sr: number, fLo: number, fHi: number, from = 0, size = 4096) {
  const tMin = Math.max(2, Math.floor(sr / fHi))
  const tMax = Math.ceil(sr / fLo)
  const d = new Float64Array(tMax + 2)
  for (let tau = 1; tau <= tMax + 1; tau++) {
    let s = 0
    for (let j = 0; j < size; j++) {
      const diff = (x[from + j] ?? 0) - (x[from + j + tau] ?? 0)
      s += diff * diff
    }
    d[tau] = s
  }
  const dp = new Float64Array(tMax + 2)
  dp[0] = 1
  let run = 0
  for (let tau = 1; tau <= tMax + 1; tau++) {
    run += d[tau]!
    dp[tau] = run > 0 ? (d[tau]! * tau) / run : 1
  }
  let best = -1
  for (let t = tMin; t <= tMax; t++) {
    if (dp[t]! < 0.1) {
      while (t + 1 <= tMax && dp[t + 1]! < dp[t]!) t++
      best = t
      break
    }
  }
  if (best < 0) {
    best = tMin
    for (let t = tMin; t <= tMax; t++) if (dp[t]! < dp[best]!) best = t
  }
  const a = dp[best - 1]!
  const b = dp[best]!
  const c = dp[best + 1]!
  const den = a - 2 * b + c
  const shift = den !== 0 ? (a - c) / (2 * den) : 0
  return sr / (best + shift)
}

export interface Metrics {
  rmsDb: number
  peakDb: number
  dc: number
  click: number
  jumpRatio: number
  lufs: number
  lra: number
  momentaryMax: number
  shortTermMax: number
  shortTermMin: number
  maxRise: number
  maxSwing: number
  truePeak: number
  centroid: number
  /** 4 kHz 以上的能量相对 200–800 Hz 频带（dB）：睡眠模式要求 ≤ −20 */
  highVsMid: number
}

/** 质检报告里的一整组测量，from/to 为采样序号 */
export function measure(chs: Chs, sr: number, from = 0, to = len(chs)): Metrics {
  const ls = loudnessStats(chs, sr, from, to)
  const size = 4096
  const spectrum = powerSpectrum(chs, from, to, size)
  return {
    rmsDb: rmsDb(chs, from, to),
    peakDb: peakDb(chs, from, to),
    dc: dcOffset(chs, from, to),
    click: clickScore(chs, sr, from, to),
    jumpRatio: maxJumpRatio(chs, from, to),
    lufs: ls.integrated,
    lra: ls.lra,
    momentaryMax: ls.momentaryMax,
    shortTermMax: ls.shortTermMax,
    shortTermMin: ls.shortTermMin,
    maxRise: ls.maxRise,
    maxSwing: ls.maxSwing,
    truePeak: ls.truePeak,
    centroid: centroidOf(spectrum, sr, size),
    highVsMid: bandOf(spectrum, sr, size, 4000, sr / 2) - bandOf(spectrum, sr, size, 200, 800),
  }
}
