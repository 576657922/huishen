/**
 * 模拟心率带：没有硬件时用于演示和测试，接口与真实设备相同。界面上须注明是模拟数据。
 *
 * 心率由三部分叠加：静息心率的缓慢漂移、与呼吸无关的逐搏波动、呼吸带来的起伏（呼吸性窦性心律不齐）。
 * 呼吸先经过一个以共振频率为中心的二阶带通，这是压力反射回路的简化模型（Vaschillo 等，2002）：
 * 在共振频率呼吸时起伏最大，且心率与呼吸同相；呼吸更快时心率滞后，更慢时超前；
 * 换了频率，起伏要过十几秒才稳定——测定时每段开头舍弃一段时间，正是为此。
 * 心搏按积分脉冲频率调制（IPFM）产生，R 波时刻按心率带的分辨率（1/1024 秒）取整，
 * 再掺入少量漏检、误检和早搏，用来检验伪迹剔除。
 */
import { clamp, mean } from '@/lib/math'
import { mulberry32 } from '@/lib/random'
import { createEmitter } from './emitter'
import type { Beat, DisconnectInfo, HeartRateDevice, HeartRateMeasurement } from './types'

export interface SimulatorOptions {
  /** 共振频率（次/分），默认 5.5 */
  resonance?: number
  /** 静息心率（次/分），默认 64 */
  baseHr?: number
  /** 随机种子；种子与呼吸相同，产生的心搏就相同 */
  seed?: number
  /** 在共振频率充分呼吸时心率的峰谷差（次/分），默认 16 */
  rsa?: number
  /** 共振的尖锐程度（带通的品质因数），默认 3：越大，偏离共振频率时起伏下降得越快 */
  sharpness?: number
  /** 每一搏出现伪迹（漏检、误检、早搏）的概率，默认 0.005 */
  artifacts?: number
  /** false：像只报心率的光学手环，测量里没有逐搏间期，用来演示「不能算心率变异」的提示。默认 true */
  rrIntervals?: boolean
  name?: string
  /** 实时模式的时钟（秒），如练习时钟；默认从创建时起算 */
  now?: () => number
  /** 模型从哪一刻开始（秒）；默认为创建时 now() 的值，没给 now 时为 0 */
  start?: number
  /** 实时模式下多久发一条测量（毫秒）；常见心率带为 1 秒 */
  intervalMs?: number
}

/** 返回 t 秒时的肺容量（0 呼空，1 吸满）；返回 null 表示按自己的节奏自然呼吸 */
export type VolumeFn = (t: number) => number | null

export interface SimulatedHeartRate extends HeartRateDevice {
  /**
   * 告诉模拟器怎么呼吸。t 用模拟器的时钟（实时模式下即 now()）。
   * 数字：每分钟次数，吸呼等长，第 0 秒开始吸气（见 steadyBreathing）；
   * 函数：跟随节拍用 t => patternAt(pattern, t).y，共振频率测定用 t => targetVolume(plan, t)；
   * null：自然呼吸，每分钟 14 次上下。数字不是正数时抛出 RangeError
   */
  setBreathing(breathing: VolumeFn | number | null): void
  /**
   * 不等实时，直接把模型推进到 t 秒，返回其间的心搏。用于测试和预先生成数据；
   * 不要和实时模式（有人收听 onReading）同时用，两边会分走同一串心搏
   */
  advance(t: number): Beat[]
  /** 模拟意外断开（走远了、没电了）：派发 { requested: false }，之后可以 reconnect() */
  drop(): void
  /** 模拟心率带没贴紧（false）与重新贴好（true）：没贴紧时的测量报告 not-detected，不带心率和 RR */
  setContact(on: boolean): void
}

/**
 * 以每分钟 rate 次、吸呼等长呼吸时 t 秒的肺容量。第 0 秒呼空、刚开始吸气，
 * 与引擎吸呼等长的节拍（两段半余弦）在同一时刻读数相同。rate 不是正数时抛出 RangeError
 */
export function steadyBreathing(rate: number): VolumeFn {
  if (!(Number.isFinite(rate) && rate > 0)) throw new RangeError(`呼吸频率不合理：${rate}`)
  const hz = rate / 60
  return t => (1 - Math.cos(2 * Math.PI * hz * t)) / 2
}

/** 模型的步长（秒） */
const DT = 0.05
/** R 波定位误差（秒），胸带一般在几毫秒 */
const JITTER = 0.003
/** 静息心率的缓慢漂移（次/分） */
const DRIFT = { tau: 40, sd: 1.5 }
/** 与呼吸无关的逐搏波动（次/分） */
const FLUTTER = { tau: 1.5, sd: 1.2 }
/** 自然呼吸的频率（次/分）及其缓慢变化 */
const SPONTANEOUS = { rate: 14, tau: 30, sd: 1.2 }
const HR_RANGE = [35, 190] as const
/**
 * 实时模式下调用方的时钟一下子往前跳了这么多秒以内时，补齐其间的心搏（页面在后台时计时器会被放慢，
 * 回来后测定的数据仍是连续的）；跳得更远多半是休眠或时钟换了，直接换基准接着跳，不补算
 */
const MAX_CATCH_UP_SEC = 600

const quantize = (t: number): number => Math.round(t * 1024) / 1024

function normal(rand: () => number): () => number {
  return () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
}

/** Ornstein–Uhlenbeck 过程走一步：围绕 0 波动，标准差 sd，相关时间 tau 秒 */
function ou(x: number, p: { tau: number; sd: number }, g: number): number {
  const k = Math.exp(-DT / p.tau)
  return x * k + p.sd * Math.sqrt(1 - k * k) * g
}

/** 二阶带通（RBJ，中心增益为 1，中心处相移为 0） */
function resonator(f0: number, q: number): (x: number) => number {
  const w0 = 2 * Math.PI * f0 * DT
  const alpha = Math.sin(w0) / (2 * q)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const a1 = (-2 * Math.cos(w0)) / a0
  const a2 = (1 - alpha) / a0
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  return x => {
    const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    return y
  }
}

interface ModelParams {
  resonance: number
  baseHr: number
  seed: number
  rsa: number
  sharpness: number
  artifacts: number
}

function createHeartModel(p: ModelParams, start: number) {
  const rand = mulberry32(p.seed)
  const gauss = normal(rand)
  const resonate = resonator(p.resonance / 60, p.sharpness)
  let origin = start
  let steps = 0
  let volume: VolumeFn | null = null
  let drift = 0
  let flutter = 0
  let breathRate = 0
  let breathPhase = rand()
  // phase 为当前这一搏已走过的比例；上一搏在开始前 phase 个心动周期
  let phase = rand()
  let lastReported = quantize(start - (phase * 60) / p.baseHr)

  const now = () => origin + steps * DT

  function lungs(t: number): number {
    const v = volume ? volume(t) : null
    if (v !== null && Number.isFinite(v)) return clamp(v, 0, 1)
    breathRate = ou(breathRate, SPONTANEOUS, gauss())
    breathPhase = (breathPhase + ((SPONTANEOUS.rate + breathRate) / 60) * DT) % 1
    return (1 - Math.cos(2 * Math.PI * breathPhase)) / 2
  }

  function emit(at: number, out: Beat[]): void {
    const t = quantize(at)
    out.push({ t, rr: (t - lastReported) * 1000 })
    lastReported = t
  }

  /** 心脏真正跳了一下；心率带看到的可能是漏掉、多出一搏，或提前出现的早搏 */
  function report(at: number, out: Beat[]): void {
    const t = at + JITTER * gauss()
    const u = rand()
    const a = p.artifacts
    if (u < a / 2) return
    if (u < a * 0.75) {
      emit(lastReported + (t - lastReported) * (0.35 + 0.3 * rand()), out)
    } else if (u < a) {
      // 早搏提前出现，下一搏仍按原来的节律来，于是一短一长
      emit(t - (t - lastReported) * (0.25 + 0.1 * rand()), out)
      return
    }
    emit(t, out)
  }

  function step(out: Beat[]): void {
    const t = now()
    const swing = p.rsa * resonate(lungs(t) - 0.5)
    drift = ou(drift, DRIFT, gauss())
    flutter = ou(flutter, FLUTTER, gauss())
    const hr = clamp(p.baseHr + drift + flutter + swing, HR_RANGE[0], HR_RANGE[1])
    const before = phase
    phase += (hr / 60) * DT
    steps++
    if (phase < 1) return
    // 在这一步里线性插出相位到 1 的时刻
    const at = t + (DT * (1 - before)) / (phase - before)
    phase -= 1
    report(at, out)
  }

  return {
    now,
    setVolume(v: VolumeFn | null) {
      volume = v
    },
    advance(until: number): Beat[] {
      const out: Beat[] = []
      while (now() + DT <= until + 1e-9) step(out)
      return out
    },
    /** 把模型的时钟整体挪到 t，心脏的状态不变：下一搏的间期照常，只是时刻换了基准 */
    rebase(t: number) {
      // 一次无效的时钟读数不能让模型从此停摆
      if (!Number.isFinite(t)) return
      const shift = t - now()
      origin += shift
      // 按心率带的分辨率挪，之后的间期仍是 1/1024 秒的整数倍
      lastReported += quantize(shift)
    },
  }
}

type NumericOptions = Pick<
  Required<SimulatorOptions>,
  'resonance' | 'baseHr' | 'rsa' | 'sharpness' | 'artifacts' | 'intervalMs'
>

/** 参数不合理时模型会算出 NaN，或计时器空转，不如一开始就报错 */
function checkOptions(o: NumericOptions): void {
  const rules: [keyof NumericOptions, boolean][] = [
    ['resonance', o.resonance > 0],
    ['baseHr', o.baseHr >= HR_RANGE[0] && o.baseHr <= HR_RANGE[1]],
    ['rsa', o.rsa >= 0],
    ['sharpness', o.sharpness > 0],
    ['artifacts', o.artifacts >= 0 && o.artifacts <= 1],
    ['intervalMs', o.intervalMs > 0],
  ]
  for (const [name, ok] of rules) {
    if (!(ok && Number.isFinite(o[name]))) throw new RangeError(`模拟心率带的参数 ${name} 不合理：${o[name]}`)
  }
}

export function createSimulatedHeartRate(options: SimulatorOptions = {}): SimulatedHeartRate {
  const {
    resonance = 5.5,
    baseHr = 64,
    seed = 1,
    rsa = 16,
    sharpness = 3,
    artifacts = 0.005,
    rrIntervals = true,
    name = '模拟心率带',
    intervalMs = 1000,
  } = options
  checkOptions({ resonance, baseHr, rsa, sharpness, artifacts, intervalMs })
  const born = performance.now()
  const clock = options.now ?? (() => (performance.now() - born) / 1000)
  const start = options.start ?? (options.now ? options.now() : 0)
  const model = createHeartModel({ resonance, baseHr, seed, rsa, sharpness, artifacts }, start)
  const readings = createEmitter<HeartRateMeasurement>()
  const disconnects = createEmitter<DisconnectInfo>()
  const recent: number[] = []
  let connected = true
  let contact = true
  let timer: ReturnType<typeof setInterval> | null = null

  /** 和真实心率带一样：心率取最近几搏的平均，RR 只带这一秒里新完成的；没贴紧时什么也量不到 */
  function measurement(beats: readonly Beat[]): HeartRateMeasurement {
    if (!contact) return { hr: 0, rr: [], contact: 'not-detected' }
    for (const b of beats) recent.push(b.rr)
    recent.splice(0, Math.max(0, recent.length - 4))
    const hr = recent.length ? 60000 / mean(recent) : baseHr
    return { hr: Math.round(hr), rr: rrIntervals ? beats.map(b => b.rr) : [], contact: 'detected' }
  }

  /**
   * 把模型推进到调用方的时钟。练习时钟在重新开始时会往回跳（结束时的秒数 → 0 → 倒数的负数），
   * 这时换个基准接着跳，不必等时钟追上来；往前跳得太远也一样，不补算
   */
  function follow(t: number): Beat[] {
    const lag = t - model.now()
    if (lag < 0 || lag > MAX_CATCH_UP_SEC) model.rebase(t)
    return model.advance(t)
  }

  /** 有人收听且处于连接状态时才走实时时钟，离线调用 advance() 的测试不会留下计时器 */
  function sync(): void {
    const wanted = connected && readings.size > 0
    if (wanted && !timer) {
      // 没人收听、断开着的那段时间直接跳过，免得第一条测量一下子带出一长串心搏
      model.rebase(clock())
      timer = setInterval(() => readings.emit(measurement(follow(clock()))), intervalMs)
    } else if (!wanted && timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function end(requested: boolean): void {
    if (!connected) return
    connected = false
    sync()
    disconnects.emit({ requested })
  }

  return {
    name,
    get connected() {
      return connected
    },
    onReading(listener) {
      const off = readings.on(listener)
      sync()
      return () => {
        off()
        sync()
      }
    },
    onDisconnect: disconnects.on,
    disconnect: () => end(true),
    reconnect() {
      connected = true
      sync()
      return Promise.resolve()
    },
    drop: () => end(false),
    setContact(on) {
      contact = on
      // 重新贴好后，显示的心率只按之后的心搏算
      if (!on) recent.length = 0
    },
    setBreathing(breathing) {
      model.setVolume(typeof breathing === 'number' ? steadyBreathing(breathing) : breathing)
    },
    advance: model.advance,
  }
}
