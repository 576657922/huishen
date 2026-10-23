/**
 * 输出端的动态处理：柔和的安全压缩 → 预读的真峰值限幅。纯计算，不依赖 Web Audio：
 * AudioWorklet 里逐块调用，Node 里可以直接测。
 *
 * 压缩：先求 10 ms 的均方（左右联动），再按起控 30 ms、释放 500 ms 跟随，2:1、6 dB 软拐点。平时音量下不动作，
 * 只在用户把音量开得很大时温和地收一点，不会「抽吸」。
 *
 * 限幅：对压缩后的信号做 4 倍过采样峰值检测，求出每个采样需要的增益；
 * 取预读窗口里的最小值并保持，再按释放时间回升，最后用同样长度的滑动平均把增益曲线磨圆。
 * 声音本身延迟同样的长度，所以增益总在峰值到来之前就已经降好：
 * 输出采样 m 的增益是 r[m+D−W+1 … m+D] 的平均，其中每一个 r 都不大于检测到的 m 附近所需的增益，
 * 平均值也就不会大于它，峰值不会越过上限。
 */
import { CENTER, createPeakDetector } from './oversample'

export interface DynamicsParams {
  /** 压缩阈值（dBFS，按 RMS） */
  threshold: number
  ratio: number
  /** 软拐点宽度（dB） */
  knee: number
  /** 秒 */
  attack: number
  release: number
  /** 真峰值上限（dBTP） */
  ceiling: number
  /** 限幅预读（秒） */
  lookahead: number
  /** 限幅释放（秒） */
  limitRelease: number
}

export interface DynamicsStats {
  /** 自上次读取以来压缩的最大衰减（dB，正数） */
  compDb: number
  /** 自上次读取以来限幅的最大衰减（dB，正数） */
  limitDb: number
}

export interface Dynamics {
  /** 处理 frames 个采样。input 的声道少于 output 时：单声道复制到各声道，没有输入按静音 */
  process(input: readonly Float32Array[], output: Float32Array[], frames: number): void
  /** 输出相对输入的延迟（采样数） */
  readonly latency: number
  takeStats(): DynamicsStats
}

/** 检测到的峰值在信号里的位置要多留的余量（采样），覆盖相邻两个采样之间的插值 */
const SLACK = 2

/** 限幅时比上限再低这么多 dB：增益在采样之间变化也会让插值峰值略有出入 */
const MARGIN_DB = 0.3

/** 均方检测的平均时间（秒）：磨平波形本身的起伏，起控与释放再在它上面计时 */
const RMS_TIME = 0.01

/** 单调队列：滑动窗口里的最小值，均摊 O(1)，不分配内存 */
function createMinWindow(size: number): { push(n: number, v: number): number } {
  const cap = size + 2
  const idx = new Float64Array(cap)
  const val = new Float64Array(cap)
  let head = 0
  let count = 0
  return {
    push(n, v) {
      while (count > 0) {
        const last = (head + count - 1) % cap
        if (val[last]! < v) break
        count--
      }
      const at = (head + count) % cap
      idx[at] = n
      val[at] = v
      count++
      while (idx[head]! <= n - size) {
        head = (head + 1) % cap
        count--
      }
      return val[head]!
    },
  }
}

export function createDynamics(sr: number, channels: number, p: DynamicsParams): Dynamics {
  const W = Math.max(1, Math.round(p.lookahead * sr))
  const H = W + 2 * SLACK
  const D = W + CENTER + SLACK - 1
  const ceiling = 10 ** ((p.ceiling - MARGIN_DB) / 20)
  const aRms = 1 - Math.exp(-1 / (RMS_TIME * sr))
  const aAtk = 1 - Math.exp(-1 / (Math.max(1e-4, p.attack) * sr))
  const aRel = 1 - Math.exp(-1 / (Math.max(1e-4, p.release) * sr))
  const aLim = 1 - Math.exp(-1 / (Math.max(1e-4, p.limitRelease) * sr))
  const slope = 1 - 1 / Math.max(1, p.ratio)
  const halfKnee = Math.max(0, p.knee) / 2

  const detectors = Array.from({ length: channels }, createPeakDetector)
  // 延迟线：每声道 D + 1 个采样的环形缓冲
  const delay = Array.from({ length: channels }, () => new Float32Array(D + 1))
  const box = new Float64Array(W).fill(1)
  const minWin = createMinWindow(H)
  let boxSum = W
  let boxAt = 0
  let delayAt = 0
  let n = 0
  let ms = 1e-12
  let env = 1e-12
  let r = 1
  let statComp = 1
  let statLimit = 1

  /** 压缩的增益（线性）：软拐点，拐点以上按比率 */
  function compGain(levelDb: number): number {
    const over = levelDb - p.threshold
    if (over <= -halfKnee) return 1
    const gr = over >= halfKnee ? slope * over : (slope * (over + halfKnee) ** 2) / (4 * halfKnee || 1)
    return 10 ** (-gr / 20)
  }

  function step(xs: Float64Array, out: Float32Array[], i: number): void {
    // 压缩：联动检测，两个声道用同一个增益，声像不漂
    let pw = 0
    for (let c = 0; c < channels; c++) pw = Math.max(pw, xs[c]! * xs[c]!)
    ms += aRms * (pw - ms)
    env += (ms > env ? aAtk : aRel) * (ms - env)
    // 静音时不让状态掉进非规格化浮点数，那会让音频线程突然变慢
    if (env < 1e-12) env = 1e-12
    if (ms < 1e-12) ms = 1e-12
    const gc = compGain(10 * Math.log10(env))
    if (gc < statComp) statComp = gc

    // 限幅：检测压缩之后的信号
    let peak = 0
    for (let c = 0; c < channels; c++) {
      const y = xs[c]! * gc
      const pk = detectors[c]!(y)
      if (pk > peak) peak = pk
      delay[c]![delayAt] = y
    }
    const need = peak > ceiling ? ceiling / peak : 1
    const h = minWin.push(n, need)
    r = h < r ? h : r + aLim * (h - r)
    boxSum += r - box[boxAt]!
    box[boxAt] = r
    boxAt = boxAt + 1 === W ? 0 : boxAt + 1
    // 浮点累加会慢慢漂移：每隔一段重新求和
    if ((n & 0xffff) === 0xffff) boxSum = box.reduce((a, b) => a + b, 0)
    const g = Math.min(1, boxSum / W)
    if (g < statLimit) statLimit = g

    const readAt = delayAt + 1 === D + 1 ? 0 : delayAt + 1
    for (let c = 0; c < out.length; c++) {
      const line = delay[Math.min(c, channels - 1)]!
      out[c]![i] = line[readAt]! * g
    }
    delayAt = readAt
    n++
  }

  const xs = new Float64Array(channels)

  return {
    latency: D,
    process(input, output, frames) {
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channels; c++) {
          const src = input[c] ?? input[0]
          xs[c] = src ? src[i]! : 0
        }
        step(xs, output, i)
      }
    },
    takeStats() {
      const s = {
        compDb: Math.max(0, -20 * Math.log10(statComp)),
        limitDb: Math.max(0, -20 * Math.log10(statLimit)),
      }
      statComp = 1
      statLimit = 1
      return s
    },
  }
}
