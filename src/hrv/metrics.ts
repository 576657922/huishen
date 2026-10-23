/**
 * 心率变异指标。输入是逐搏间期（毫秒），或带时刻的心搏（按时间排序）；算不出来时返回 NaN，由界面决定怎么显示。
 * 时域指标按 Task Force（1996）的定义；频域用 4 Hz 重采样、去线性趋势、Hann 窗周期图。
 */
import { cyclesOf } from '@/engine/patterns'
import type { BreathPattern } from '@/engine/types'
import { clamp, lerp, mean, median, sum } from '@/lib/math'
import type { Beat } from './types'

/** 合理的 RR 范围：200 次/分到 30 次/分 */
const RR_MIN = 300
const RR_MAX = 2000
/** 与前后各两搏（共五搏）的中位数相差超过两成，视为伪迹 */
const NEIGHBORS = 2
const MAX_DEVIATION = 0.2

/** 低频段（Hz）。6 次/分的呼吸正好是 0.1 Hz，共振呼吸的心率起伏全部落在这一段 */
export const LF_BAND = [0.04, 0.15] as const
const RESAMPLE_HZ = 4
/** 频率网格（Hz）比自然分辨率（1/时长）细，峰值频率才读得出 5.5 与 6 次/分的差别 */
const GRID_HZ = 0.001
/** lfPower 要求心搏跨越的最短秒数（50 秒）：至少覆盖低频段下限的两个周期，频谱才有意义 */
export const MIN_SPECTRUM_SEC = 2 / LF_BAND[0]

/** 一轮呼吸里最大的空档超过这一比例，峰或谷可能正好落在空档里，这一轮不算 */
const MAX_CYCLE_GAP = 0.3

/**
 * 一轮的峰谷差既超过各轮中位数的两倍、又高出 10 次/分以上，就不是呼吸带来的起伏。
 * 在模拟测定里，没有伪迹时一轮最多比中位数高 7 次/分左右；而扎堆的误检逃过剔除后，一轮能高出几十次/分
 */
const OUTLIER_RATIO = 2
const OUTLIER_EXCESS = 10

/* ---------- 伪迹 ---------- */

/**
 * 第 i 搏与它周围五搏的中位数相差是否超过两成。五搏是它自己加上前后各两个参照心搏（refs 为参照心搏的序号，
 * 递增）；refs 里的位置 p 是第一个不小于 i 的。两端不截短窗口而是往里挪：截短后只剩四搏时，两个伪迹就能把中位数拉偏
 */
function deviates(rr: readonly number[], refs: readonly number[], i: number, p: number): boolean {
  const self = refs[p] === i
  // 把第 i 搏放进参照序列后的长度，以及它在其中的位置 p
  const size = refs.length + (self ? 0 : 1)
  const span = 2 * NEIGHBORS + 1
  const lo = clamp(p - NEIGHBORS, 0, Math.max(0, size - span))
  const win: number[] = []
  for (let k = lo; k < Math.min(size, lo + span); k++) {
    const j = self || k < p ? refs[k]! : k === p ? i : refs[k - 1]!
    win.push(rr[j]!)
  }
  const med = median(win)
  return Math.abs(rr[i]! - med) > MAX_DEVIATION * med
}

/** 不超过这么多遍：通常两三遍就不再变化，个别情形会在两种结果之间来回 */
const MAX_PASSES = 5

/**
 * 每一搏是否保留：先按合理范围筛，再与周围五搏的中位数比较。
 * 漏检（间期翻倍）、误检（一搏拆成两搏）、早搏（短长成对）都会因此被剔除，而共振呼吸时平滑的大幅起伏不会。
 * 伪迹常常扎堆（身体一动、电极一松就是一串），五搏里有三个伪迹时中位数本身就偏了，会留下伪迹、反而剔掉正常的一搏。
 * 所以反复几遍：每一遍的「周围五搏」只取上一遍判为正常的心搏，被冤枉的心搏在下一遍得以恢复。
 */
export function artifactMask(rr: readonly number[]): boolean[] {
  const inRange = rr.map(x => Number.isFinite(x) && x >= RR_MIN && x <= RR_MAX)
  // 不到三搏时没有可比的邻居，只做范围筛选
  if (inRange.filter(Boolean).length < 3) return inRange
  let keep = inRange
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const refs = keep.flatMap((ok, i) => (ok ? [i] : []))
    let p = 0
    const next = rr.map((_, i) => {
      while (p < refs.length && refs[p]! < i) p++
      return inRange[i]! && !deviates(rr, refs, i, p)
    })
    if (next.every((x, i) => x === keep[i])) break
    keep = next
  }
  return keep
}

export function cleanRR(rr: readonly number[]): { clean: number[]; rejected: number } {
  const keep = artifactMask(rr)
  const clean = rr.filter((_, i) => keep[i])
  return { clean, rejected: rr.length - clean.length }
}

export function cleanBeats(beats: readonly Beat[]): { clean: Beat[]; rejected: number } {
  const keep = artifactMask(beats.map(b => b.rr))
  const clean = beats.filter((b, i) => keep[i] && Number.isFinite(b.t))
  return { clean, rejected: beats.length - clean.length }
}

/* ---------- 时域 ---------- */

/** 相邻间期之差的均方根（毫秒），主要反映迷走神经的调节；要求输入是连续的心搏 */
export function rmssd(rr: readonly number[]): number {
  if (rr.length < 2) return Number.NaN
  let acc = 0
  for (let i = 1; i < rr.length; i++) acc += (rr[i]! - rr[i - 1]!) ** 2
  return Math.sqrt(acc / (rr.length - 1))
}

/** 间期的样本标准差（毫秒） */
export function sdnn(rr: readonly number[]): number {
  if (rr.length < 2) return Number.NaN
  const m = mean(rr)
  return Math.sqrt(sum(rr.map(x => (x - m) ** 2)) / (rr.length - 1))
}

/** 平均心率（次/分）：搏数除以时长，而不是逐搏心率的平均，后者会被快的几搏抬高 */
export const meanHr = (rr: readonly number[]): number => 60000 / mean(rr)

/** 两搏之间没有漏掉或剔除的心搏：时刻之差与间期吻合 */
const adjacent = (a: Beat, b: Beat): boolean => Math.abs(b.t - a.t - b.rr / 1000) <= (0.25 * b.rr) / 1000

/** 剔除伪迹后的 RMSSD：只用真正相邻的两搏，跨过空缺的差值会把结果抬高 */
export function rmssdOfBeats(beats: readonly Beat[]): number {
  let acc = 0
  let n = 0
  for (let i = 1; i < beats.length; i++) {
    const a = beats[i - 1]!
    const b = beats[i]!
    if (!adjacent(a, b)) continue
    acc += (b.rr - a.rr) ** 2
    n++
  }
  return n ? Math.sqrt(acc / n) : Number.NaN
}

/* ---------- 心率随呼吸的起伏 ---------- */

export interface HrPoint {
  t: number
  /** 次/分 */
  hr: number
}

/** 逐搏心率：每个间期换算成心率，放在结束它的那一搏的时刻 */
export const hrSeries = (beats: readonly Beat[]): HrPoint[] => beats.map(b => ({ t: b.t, hr: 60000 / b.rr }))

/**
 * 每一轮呼吸里心率的最高减最低（次/分）。boundaries 是各轮的起点，相邻两个之间为一轮；
 * 点太少或中间有大空档的轮次为 NaN。series 与 boundaries 都须按时间排序。
 * 每个窗口恰好一整轮，所以不论心率比呼吸超前还是滞后，窗口里都有一个完整的峰和谷。
 */
export function cycleAmplitudes(series: readonly HrPoint[], boundaries: readonly number[]): number[] {
  const out: number[] = []
  let i = 0
  for (let k = 0; k + 1 < boundaries.length; k++) {
    const from = boundaries[k]!
    const to = boundaries[k + 1]!
    while (i < series.length && series[i]!.t < from) i++
    let hi = Number.NEGATIVE_INFINITY
    let lo = Number.POSITIVE_INFINITY
    let gap = 0
    let prev = from
    let j = i
    for (; j < series.length && series[j]!.t < to; j++) {
      const p = series[j]!
      hi = Math.max(hi, p.hr)
      lo = Math.min(lo, p.hr)
      gap = Math.max(gap, p.t - prev)
      prev = p.t
    }
    gap = Math.max(gap, to - prev)
    out.push(j - i >= 3 && gap <= MAX_CYCLE_GAP * (to - from) ? hi - lo : Number.NaN)
    i = j
  }
  return out
}

/**
 * 去掉算不出的轮次和明显离群的轮次（见 OUTLIER_RATIO），返回其余各轮的峰谷差。
 * 离群的一轮多半是没剔干净的伪迹（连着几次误检时，五搏中位数也会被带偏），或一次咳嗽、叹气，
 * 留着它，一轮就能把整段的平均值抬高好几次/分，测定会因此选错频率
 */
export function typicalAmplitudes(amplitudes: readonly number[]): number[] {
  const measured = amplitudes.filter(Number.isFinite)
  // 不到三轮时看不出哪一轮离群
  if (measured.length < 3) return measured
  const med = median(measured)
  return measured.filter(a => a - med <= Math.max((OUTLIER_RATIO - 1) * med, OUTLIER_EXCESS))
}

/** 每轮峰谷差的平均（次/分），即呼吸性窦性心律不齐的幅度（Lehrer 与 Vaschillo 的共振判据）；不计离群的轮次 */
export function peakToTrough(series: readonly HrPoint[], boundaries: readonly number[]): number {
  return mean(typicalAmplitudes(cycleAmplitudes(series, boundaries)))
}

/* ---------- 频域 ---------- */

/** 把不等间隔的间期序列线性插值成等间隔 */
function resample(beats: readonly Beat[]): number[] {
  const t0 = beats[0]!.t
  const n = Math.floor((beats.at(-1)!.t - t0) * RESAMPLE_HZ) + 1
  const out: number[] = []
  let j = 1
  for (let k = 0; k < n; k++) {
    const t = t0 + k / RESAMPLE_HZ
    while (j < beats.length - 1 && beats[j]!.t < t) j++
    const a = beats[j - 1]!
    const b = beats[j]!
    const span = b.t - a.t
    out.push(span > 0 ? lerp(a.rr, b.rr, clamp((t - a.t) / span, 0, 1)) : b.rr)
  }
  return out
}

/** 减去最小二乘直线：缓慢的漂移会泄漏进低频段 */
function detrend(x: readonly number[]): number[] {
  const n = x.length
  const mid = (n - 1) / 2
  const m = mean(x)
  let sxy = 0
  let sxx = 0
  x.forEach((v, k) => {
    sxy += (k - mid) * (v - m)
    sxx += (k - mid) ** 2
  })
  const slope = sxx ? sxy / sxx : 0
  return x.map((v, k) => v - m - slope * (k - mid))
}

/** 单边功率谱密度（ms²/Hz）在频率 f 处的值；w2 为窗函数的平方和 */
function density(y: readonly number[], f: number, w2: number): number {
  const step = (2 * Math.PI * f) / RESAMPLE_HZ
  let re = 0
  let im = 0
  for (let k = 0; k < y.length; k++) {
    re += y[k]! * Math.cos(step * k)
    im -= y[k]! * Math.sin(step * k)
  }
  return (2 * (re * re + im * im)) / (RESAMPLE_HZ * w2)
}

export interface LfResult {
  /** 低频段功率，ms² */
  power: number
  /** 低频段里功率最高处的频率，Hz */
  peakHz: number
}

/** 低频段（0.04–0.15 Hz）的功率和峰值频率；beats 应已剔除伪迹，时长不足 50 秒时为 NaN */
export function lfPower(beats: readonly Beat[]): LfResult {
  const first = beats[0]
  const last = beats.at(-1)
  if (!first || !last || beats.length < 3 || last.t - first.t < MIN_SPECTRUM_SEC) {
    return { power: Number.NaN, peakHz: Number.NaN }
  }
  const x = detrend(resample(beats))
  const n = x.length
  // 周期型 Hann 窗；按窗的能量归一，正弦波的带内功率才等于它的方差
  let w2 = 0
  const y = x.map((v, k) => {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / n)
    w2 += w * w
    return v * w
  })
  const [lo, hi] = LF_BAND
  const steps = Math.round((hi - lo) / GRID_HZ)
  let power = 0
  let peak = -1
  let peakHz = Number.NaN
  for (let s = 0; s <= steps; s++) {
    const f = lo + s * GRID_HZ
    const d = density(y, f, w2)
    // 梯形积分，两端各算半格
    power += d * GRID_HZ * (s === 0 || s === steps ? 0.5 : 1)
    if (d > peak) {
      peak = d
      peakHz = Math.round(f * 1e4) / 1e4
    }
  }
  return { power, peakHz }
}

/* ---------- 一次练习的摘要 ---------- */

export interface HrvSummary {
  /** 剔除伪迹后的心搏数 */
  beats: number
  /** 被剔除的比例 0–1 */
  artifactRate: number
  meanHr: number
  rmssd: number
  sdnn: number
  /** 跟随节拍时每轮心率峰谷差的平均（次/分）；没给节拍或数据不够时为 NaN */
  amplitude: number
}

/**
 * 跟随的节拍，三种给法：
 * pattern：练习用的节拍（SessionPlan.pattern），t0 为练习第 0 秒在心搏时钟上的时刻，默认 0；
 *   开头逐步放慢的几轮速度不同，不计入，不同练习的结果才能相比；
 * t0 与 period：固定节拍，t0 为某一轮的起点、period 为一轮的秒数；
 * boundaries：各轮的起点（按时间排序，相邻两个之间为一轮），供中途换过速度的练习使用。
 */
export type Pacing =
  | { pattern: BreathPattern; t0?: number }
  | { t0: number; period: number }
  | { boundaries: readonly number[] }

/** 固定节拍各轮的起点；只取完整落在心搏范围内的轮次 */
function periodBounds(beats: readonly Beat[], t0: number, period: number): number[] {
  const first = beats[0]
  const last = beats.at(-1)
  if (!first || !last || !(period > 0)) return []
  const k0 = Math.ceil((first.t - t0) / period)
  const k1 = Math.floor((last.t - t0) / period)
  const out: number[] = []
  for (let k = k0; k <= k1; k++) out.push(t0 + k * period)
  return out
}

/** 引擎节拍各轮的起点，与引擎的调度同一算法；跳过开头放慢的几轮，只取完整落在心搏范围内的轮次 */
function patternBounds(beats: readonly Beat[], pattern: BreathPattern, t0: number): number[] {
  const first = beats[0]
  const last = beats.at(-1)
  if (!first || !last || !(pattern.T > 0)) return []
  const skip = pattern.warmup?.length ?? 0
  const out: number[] = []
  for (const cycle of cyclesOf(pattern)) {
    const at = t0 + cycle.start
    if (at > last.t) break
    if (cycle.index >= skip && at >= first.t) out.push(at)
  }
  return out
}

function boundsOf(beats: readonly Beat[], pacing: Pacing): readonly number[] {
  if ('boundaries' in pacing) return pacing.boundaries
  if ('pattern' in pacing) return patternBounds(beats, pacing.pattern, pacing.t0 ?? 0)
  return periodBounds(beats, pacing.t0, pacing.period)
}

/** 一次练习的心率摘要，供记录保存（SessionRecord.hrv）；pacing 为跟随的节拍，不给则没有峰谷差 */
export function summarizeHrv(beats: readonly Beat[], pacing?: Pacing): HrvSummary {
  const { clean, rejected } = cleanBeats(beats)
  const rr = clean.map(b => b.rr)
  const amplitude = pacing ? peakToTrough(hrSeries(clean), boundsOf(clean, pacing)) : Number.NaN
  return {
    beats: clean.length,
    artifactRate: beats.length ? rejected / beats.length : 0,
    meanHr: meanHr(rr),
    rmssd: rmssdOfBeats(clean),
    sdnn: sdnn(rr),
    amplitude,
  }
}
