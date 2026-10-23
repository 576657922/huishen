/**
 * 4 倍过采样的峰值检测（真峰值）。限幅器的 Worklet 和离线质检共用这一套，测出来的「真峰值」完全一致。
 *
 * 插值器是加 Kaiser 窗的 sinc 分数延迟，分成 4 相：第 0 相正好是原采样（只延迟 CENTER 个采样），
 * 另外 3 相落在两个采样之间的 1/4、1/2、3/4 处。每相系数各自归一到直流增益 1，低频信号不会读高或读低。
 * 采样之间的峰值（数模转换后才出现）主要来自高频，内容在 16 kHz 以下时误差远小于 0.3 dB。
 */

/** 每相的抽头数 */
export const TAPS = 16

/** 插值的位置比输入晚 CENTER 个采样：检测到的峰值对应 CENTER 个采样之前的信号 */
export const CENTER = TAPS / 2 - 1

const PHASES = 4
const BETA = 7

/** 第一类零阶修正贝塞尔函数，用于 Kaiser 窗 */
function besselI0(x: number): number {
  let sum = 1
  let term = 1
  for (let k = 1; k < 30; k++) {
    term *= (x / (2 * k)) ** 2
    sum += term
    if (term < 1e-12 * sum) break
  }
  return sum
}

const sinc = (x: number): number => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x))

/** 第 1–3 相的系数（第 0 相是原采样，不需要计算） */
function design(): Float64Array[] {
  const half = TAPS / 2
  const norm = besselI0(BETA)
  const out: Float64Array[] = []
  for (let p = 1; p < PHASES; p++) {
    const tau = CENTER + p / PHASES
    const h = new Float64Array(TAPS)
    let sum = 0
    for (let k = 0; k < TAPS; k++) {
      const x = k - tau
      const r = x / half
      const w = Math.abs(r) < 1 ? besselI0(BETA * Math.sqrt(1 - r * r)) / norm : 0
      h[k] = sinc(x) * w
      sum += h[k]!
    }
    for (let k = 0; k < TAPS; k++) h[k] = h[k]! / sum
    out.push(h)
  }
  return out
}

/** 第 1、2、3 相的系数，各 TAPS 个 */
export const PHASE_COEFS: readonly Float64Array[] = design()

/**
 * 单声道的逐采样峰值检测：输入一个采样，返回它与上一个采样之间（含 CENTER 个采样之前的那个采样）
 * 过采样后绝对值的最大值。内部是长度 2×TAPS 的环形缓冲，读写都不分配内存。
 */
export function createPeakDetector(): (x: number) => number {
  const buf = new Float64Array(2 * TAPS)
  const [h1, h2, h3] = PHASE_COEFS as [Float64Array, Float64Array, Float64Array]
  let w = 0
  return x => {
    // 同一个值写两份，读的时候总是一段连续的内存，不用取模
    buf[w] = x
    buf[w + TAPS] = x
    w = w + 1 === TAPS ? 0 : w + 1
    // buf[w + k] 是 k 个采样之前……的倒序：buf[w + TAPS − 1] 为最新，buf[w] 为最旧
    let y1 = 0
    let y2 = 0
    let y3 = 0
    for (let k = 0; k < TAPS; k++) {
      const v = buf[w + TAPS - 1 - k]!
      y1 += h1[k]! * v
      y2 += h2[k]! * v
      y3 += h3[k]! * v
    }
    const y0 = buf[w + TAPS - 1 - CENTER]!
    return Math.max(Math.abs(y0), Math.abs(y1), Math.abs(y2), Math.abs(y3))
  }
}

/**
 * 一组声道 [from, to) 范围里的真峰值（线性），各声道取最大。
 * 范围外如果还有采样，就用它们给插值器预热、收尾，测量段的边缘不会凭空多出一个突变；
 * 数组本身的首尾按静音处理。
 */
export function truePeak(chs: readonly Float32Array[], from = 0, to = chs[0]?.length ?? 0): number {
  let peak = 0
  for (const a of chs) {
    const detect = createPeakDetector()
    const start = Math.max(0, from - TAPS)
    const end = Math.min(a.length + CENTER + 1, to + CENTER + 1)
    for (let i = start; i < end; i++) {
      const p = detect(i < a.length ? a[i]! : 0)
      // 第 i 次检测对应 i − CENTER 处的采样及其前面那段插值
      if (i - CENTER >= from && p > peak) peak = p
    }
  }
  return peak
}
