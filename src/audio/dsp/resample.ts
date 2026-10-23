/**
 * 带限重采样：把一段信号从一个采样率换到另一个，保持它在连续时间里的波形（Kaiser 窗的 sinc 插值）。
 * 用在混响的冲激响应上：ConvolverNode 要求它与音频环境同一采样率，而它只在一个固定的采样率上生成、校准过，
 * 其他采样率都由那一份换过去，湿声的频响才处处一样。
 */
import type { Task } from './task'

/** 阻带衰减（dB）：混响尾巴里的高频折回听得见的频段之前，先压到听不见 */
const STOP_DB = 90
/** 过渡带宽占较低采样率的比例：通带平直到 0.42 倍较低采样率（44.1 kHz 时 18.5 kHz），0.5 倍处已衰减 STOP_DB */
const TRANSITION = 0.08
/** 核函数表在每个输入采样间隔里分多少格；格间线性插值，误差约 −100 dB，比每个抽头都算三角函数快得多 */
const TABLE_RES = 512
/** 每算这么多个输出采样让出一次：每片几十万次乘加，最慢的手机上也在几毫秒内 */
const YIELD_EVERY = 2048

/** 第一类零阶修正贝塞尔函数（Kaiser 窗用），级数收敛很快 */
function besselI0(x: number): number {
  let sum = 1
  let term = 1
  const q = (x * x) / 4
  for (let k = 1; k < 100 && term > sum * 1e-15; k++) {
    term *= q / (k * k)
    sum += term
  }
  return sum
}

/**
 * 按输入采样计的低通核函数（直流增益 1），从 0 到半宽每隔 1/TABLE_RES 取一个点。
 * 截止频率放在过渡带正中：阻带从较低的那个奈奎斯特频率开始，降采样时不混叠，升采样时不留镜像
 */
function kernel(from: number, to: number): { table: Float64Array; half: number } {
  const low = Math.min(from, to)
  const fc = ((0.5 - TRANSITION / 2) * low) / from
  const dw = (2 * Math.PI * TRANSITION * low) / from
  // Kaiser 的设计公式：阻带衰减定 β，过渡带宽定长度
  const beta = 0.1102 * (STOP_DB - 8.7)
  const half = Math.ceil((STOP_DB - 8) / (2.285 * dw) / 2)
  const n = half * TABLE_RES
  const table = new Float64Array(n + 2)
  const norm = besselI0(beta)
  for (let k = 0; k <= n; k++) {
    const d = k / TABLE_RES
    const r = d / half
    const w = besselI0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / norm
    const a = 2 * Math.PI * fc * d
    table[k] = 2 * fc * (d === 0 ? 1 : Math.sin(a) / a) * w
  }
  return { table, half }
}

/** 把 from Hz 的 x 换成 to Hz；长度按时长折算。连续时间里的幅度不变 */
export function* resample(x: Float32Array, from: number, to: number): Task<Float32Array> {
  if (from === to) return x.slice()
  const { table, half } = kernel(from, to)
  const out = new Float32Array(Math.floor((x.length * to) / from))
  const step = from / to
  const last = x.length - 1
  for (let j = 0; j < out.length; j++) {
    const p = j * step
    const lo = Math.max(0, Math.ceil(p - half))
    const hi = Math.min(last, Math.floor(p + half))
    let acc = 0
    for (let i = lo; i <= hi; i++) {
      const pos = Math.abs(p - i) * TABLE_RES
      const k = Math.floor(pos)
      const a = table[k]!
      acc += x[i]! * (a + (table[k + 1]! - a) * (pos - k))
    }
    out[j] = acc
    if (j % YIELD_EVERY === YIELD_EVERY - 1) yield
  }
  return out
}
