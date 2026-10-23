/**
 * 呼吸节拍：把练习参数换算成一轮里的各段，并能查询任一时刻在节拍里的位置。
 * 画面、提示音、背景声起伏和振动都从同一份节拍读数，保证彼此对齐。
 */
import type { PacedParams } from '@/content/types'
import { clamp, easeInOut, easeOut, round1 } from '@/lib/math'
import type { BreathCycle, BreathPattern, Easing, PatternPoint, Segment } from './types'

/** 共振呼吸每分钟次数的范围：再慢会憋气，再快就不算慢呼吸了。节拍能排的极限，不是可选的范围（见 SLOW_RATE_MIN） */
export const RATE_MIN = 3
export const RATE_MAX = 10

/**
 * 慢呼吸可选、可记住的频率（次/分）：4.5–7.0（PRODUCT §2）。详情页的滑块、偏好里记住的速度、
 * 舒适节律探索的结果、计划合成，以及「有点急」的上限（STEP_BACK_MAX_RATE）都用这个范围
 */
export const SLOW_RATE_MIN = 4.5
export const SLOW_RATE_MAX = 7

/** 箱式呼吸每一步可调的秒数：3–6（PRODUCT §2，默认 4-4-4-4） */
export const BOX_PHASE_MIN_SEC = 3
export const BOX_PHASE_MAX_SEC = 6

/** 周期性叹息一轮的秒数范围 */
export const SIGH_CYCLE_MIN = 6
export const SIGH_CYCLE_MAX = 20

/** 固定秒数节拍里每一段的上限；屏息可以为 0，吸和呼必须大于 0 */
export const PHASE_SEC_MAX = 20

/**
 * 周期性叹息的可选节拍：鼻吸 2.5 秒、鼻子再补吸 1 秒、嘴慢呼 7 秒。
 * 这是设计值，不是试验规定的（研究里由练习者自己掌握节奏），界面上标为「可选节拍」
 */
export const SIGH_IN_SEC = 2.5
export const SIGH_IN2_SEC = 1
export const SIGH_OUT_SEC = 7
/** 默认一轮 10.5 秒；轮长改了，三段按同样的比例分 */
export const SIGH_DEFAULT_CYCLE = SIGH_IN_SEC + SIGH_IN2_SEC + SIGH_OUT_SEC

/** 叹息第一口吸到的位置（示意值），留出余量给第二口补满 */
export const SIGH_IN_LEVEL = 0.78

/**
 * 慢呼吸（共振呼吸）里吸气占一轮的比例：等长为一半；呼气更长时为 4.5 : 6.5，
 * 即每分钟 5.5 次时吸 4.5 秒、呼 6.5 秒（PRODUCT §2）
 */
export const EQUAL_INHALE_FRACTION = 0.5
export const LONG_EXHALE_INHALE_FRACTION = 4.5 / 11

/** 说明慢呼吸时吸、呼秒数取到的精度：与设置里给出的半秒选项一致，免得显示 4.46 秒这样的数 */
export const DESCRIBE_STEP_SEC = 0.5

/** 开头放慢的起始速度（次/分）：没练过的人一开始跟不上每分钟 6 次左右的节拍 */
export const WARMUP_START_RATE = 8
/** 开头放慢时每一档慢多少（次/分） */
export const WARMUP_RATE_STEP = 0.5
/** 开头放慢时每一档走几轮 */
export const WARMUP_CYCLES_PER_STEP = 2

/** 恰好练满整轮时，浮点误差不该让完成的轮数少算一轮 */
const CYCLE_EPS = 1e-6
/** 比较速度时的浮点余量 */
const RATE_EPS = 1e-9

type SegmentSpec = Omit<Segment, 't0'>

const NO_CYCLES: readonly BreathCycle[] = []

/** 按缓动取 0–1 之间的进度；flat 用于屏息，读数保持在段首 */
export function ease(kind: Easing, q: number): number {
  switch (kind) {
    case 'inout':
      return easeInOut(q)
    case 'out':
      return easeOut(q)
    case 'linear':
      return clamp(q, 0, 1)
    case 'flat':
      return 0
  }
}

function checkRange(name: string, x: number, lo: number, hi: number): void {
  if (!Number.isFinite(x) || x < lo || x > hi) throw new RangeError(`${name} 应在 ${lo}–${hi} 之间：${x}`)
}

function checkPositive(name: string, x: number, hi: number): void {
  if (!Number.isFinite(x) || x <= 0 || x > hi) throw new RangeError(`${name} 应大于 0 且不超过 ${hi}：${x}`)
}

function withStarts(specs: readonly SegmentSpec[]): Segment[] {
  let t0 = 0
  return specs.map(spec => {
    const seg = { ...spec, t0 }
    t0 += spec.dur
    return seg
  })
}

function sighSegments(cycle: number): SegmentSpec[] {
  // 先乘后除：默认的 10.5 秒恰好分成 2.5、1、7，不带浮点误差
  const inDur = (cycle * SIGH_IN_SEC) / SIGH_DEFAULT_CYCLE
  const in2Dur = (cycle * SIGH_IN2_SEC) / SIGH_DEFAULT_CYCLE
  return [
    {
      key: 'in',
      dur: inDur,
      y0: 0,
      y1: SIGH_IN_LEVEL,
      ease: 'inout',
      label: '吸',
      hint: '用鼻子慢慢吸气，吸到舒服的满',
    },
    {
      key: 'in2',
      dur: in2Dur,
      y0: SIGH_IN_LEVEL,
      y1: 1,
      ease: 'out',
      label: '再吸',
      hint: '不呼气，鼻子再补一小口',
    },
    // 最后一段取余数，各段之和严格等于一轮
    {
      key: 'out',
      dur: cycle - inDur - in2Dur,
      y0: 1,
      y1: 0,
      ease: 'inout',
      label: '呼',
      hint: '用嘴慢慢呼，呼得长一些',
    },
  ]
}

function resonanceSegments(T: number, ratio: 'equal' | 'long'): SegmentSpec[] {
  const inDur = T * (ratio === 'long' ? LONG_EXHALE_INHALE_FRACTION : EQUAL_INHALE_FRACTION)
  return [
    // 「轻轻」：慢呼吸容易吸得过深，提示里不说「深吸」
    { key: 'in', dur: inDur, y0: 0, y1: 1, ease: 'inout', label: '吸', hint: '用鼻子轻轻吸气，腹部自然鼓起' },
    { key: 'out', dur: T - inDur, y0: 1, y1: 0, ease: 'inout', label: '呼', hint: '慢慢呼出，不用力' },
  ]
}

/** 屏息时最要紧的一句：憋着劲停住会让人紧张，觉得吃力就该缩短每一步 */
export const HOLD_HINT = '停顿时喉咙放松，不要憋劲'

function phaseSegments(p: Extract<PacedParams, { type: 'phases' }>): SegmentSpec[] {
  const all: SegmentSpec[] = [
    { key: 'in', dur: p.inhale, y0: 0, y1: 1, ease: 'inout', label: '吸', hint: '用鼻子吸气' },
    { key: 'hold', dur: p.holdIn, y0: 1, y1: 1, ease: 'flat', label: '停', hint: HOLD_HINT },
    { key: 'out', dur: p.exhale, y0: 1, y1: 0, ease: 'inout', label: '呼', hint: '慢慢呼出' },
    { key: 'rest', dur: p.holdOut, y0: 0, y1: 0, ease: 'flat', label: '停', hint: HOLD_HINT },
  ]
  return all.filter(s => s.dur > 0)
}

/** 把节拍参数换算成一轮的各段；参数超出范围时抛出 RangeError */
export function buildPattern(params: PacedParams): BreathPattern {
  switch (params.type) {
    case 'sigh': {
      checkRange('一轮秒数', params.cycle, SIGH_CYCLE_MIN, SIGH_CYCLE_MAX)
      const segs = withStarts(sighSegments(params.cycle))
      return { T: params.cycle, rate: 60 / params.cycle, segs, type: 'sigh' }
    }
    case 'resonance': {
      checkRange('每分钟次数', params.rate, RATE_MIN, RATE_MAX)
      const T = 60 / params.rate
      return { T, rate: params.rate, segs: withStarts(resonanceSegments(T, params.ratio)), type: 'resonance' }
    }
    case 'phases': {
      checkPositive('吸气秒数', params.inhale, PHASE_SEC_MAX)
      checkRange('吸满后停的秒数', params.holdIn, 0, PHASE_SEC_MAX)
      checkPositive('呼气秒数', params.exhale, PHASE_SEC_MAX)
      checkRange('呼空后停的秒数', params.holdOut, 0, PHASE_SEC_MAX)
      const segs = withStarts(phaseSegments(params))
      const T = params.inhale + params.holdIn + params.exhale + params.holdOut
      return { T, rate: 60 / T, segs, type: 'phases' }
    }
  }
}

/** 去掉开头放慢，只按 segs 循环；保留节拍的来历 */
function steady(p: BreathPattern): BreathPattern {
  const { T, rate, segs, type } = p
  return type === undefined ? { T, rate, segs } : { T, rate, segs, type }
}

/** 按目标节拍的比例缩放成每分钟 rate 次的一轮；rate 原样保存，免得从秒数反算带进浮点误差 */
function scaledCycle(p: BreathPattern, rate: number): BreathCycle {
  const T = 60 / rate
  const k = T / p.T
  return { T, rate, segs: p.segs.map(s => ({ ...s, dur: s.dur * k, t0: s.t0 * k })) }
}

/** 同样比例、每分钟 rate 次、没有开头放慢的节拍；练习中「有点急」换速度时用 */
export function atRate(p: BreathPattern, rate: number): BreathPattern {
  checkRange('每分钟次数', rate, RATE_MIN, RATE_MAX)
  return steady({ ...scaledCycle(p, rate), type: p.type })
}

/**
 * 给节拍加上开头的逐步放慢：从 startRate 起，每 WARMUP_CYCLES_PER_STEP 轮慢 WARMUP_RATE_STEP 次，
 * 直到目标速度；各段比例不变，放慢的时间算在练习时长里。目标不比起始速度慢时没有放慢。
 * 只有慢呼吸（resonance）放慢：叹息和箱式呼吸的节拍本来就是按轮设计的，原样返回（去掉旧的放慢）
 */
export function withWarmup(p: BreathPattern, startRate: number = WARMUP_START_RATE): BreathPattern {
  checkRange('起始速度', startRate, RATE_MIN, RATE_MAX)
  const base = steady(p)
  if (p.type !== undefined && p.type !== 'resonance') return base
  const warmup: BreathCycle[] = []
  for (let rate = startRate; rate > p.rate + RATE_EPS; rate -= WARMUP_RATE_STEP) {
    const cycle = scaledCycle(p, rate)
    for (let k = 0; k < WARMUP_CYCLES_PER_STEP; k++) warmup.push(cycle)
  }
  return warmup.length > 0 ? { ...base, warmup } : base
}

/** 开头放慢一共占用的秒数 */
export function warmupSec(p: BreathPattern): number {
  let sec = 0
  for (const c of p.warmup ?? NO_CYCLES) sec += c.T
  return sec
}

/** 一轮里 tc 秒处的位置 */
function pointIn(segs: readonly Segment[], tc: number, cycle: number): PatternPoint {
  const last = segs.length - 1
  let idx = 0
  for (const seg of segs) {
    const end = seg.t0 + seg.dur
    // 浮点误差可能让 tc 略微越过一轮的末尾，归到最后一段
    if (tc < end || idx === last) {
      const progress = seg.dur > 0 ? clamp((tc - seg.t0) / seg.dur, 0, 1) : 1
      const y = seg.y0 + (seg.y1 - seg.y0) * ease(seg.ease, progress)
      return { y, seg, idx, rem: Math.max(0, end - tc), progress, cycle }
    }
    idx++
  }
  return { y: 0, seg: null, idx: -1, rem: 0, progress: 0, cycle }
}

/**
 * 放慢之后的第几轮：起点按 start + n·T 计算，与 cyclesOf 产出的起点是同一个式子，
 * 恰好落在起点上的时刻不会因为除法的浮点误差被算进上一轮
 */
function steadyIndex(t: number, start: number, T: number): number {
  const n = Math.max(0, Math.floor((t - start) / T))
  if (start + (n + 1) * T <= t) return n + 1
  if (n > 0 && start + n * T > t) return n - 1
  return n
}

/**
 * 某一时刻（练习秒数）在节拍里的位置；t < 0 表示还在倒数，rem 为距开始的秒数。
 * 逐帧调用：不建临时数组，开头放慢的轮数很少，逐轮查找即可
 */
export function patternAt(p: BreathPattern, t: number): PatternPoint {
  if (!(t >= 0)) return { y: 0, seg: null, idx: -1, rem: Number.isFinite(t) ? -t : 0, progress: 0, cycle: -1 }
  let start = 0
  let cycle = 0
  for (const c of p.warmup ?? NO_CYCLES) {
    if (t < start + c.T) return pointIn(c.segs, t - start, cycle)
    start += c.T
    cycle++
  }
  const n = steadyIndex(t, start, p.T)
  return pointIn(p.segs, t - (start + n * p.T), cycle + n)
}

export interface CycleSpan {
  /** 第几轮，从 0 开始 */
  index: number
  /** 这一轮开始的练习秒数 */
  start: number
  /** 这一轮的秒数 */
  T: number
  /** 这一轮的每分钟次数 */
  rate: number
  segs: readonly Segment[]
}

/** 依次产出每一轮：先是开头放慢的各轮，再按 segs 无限循环。起点的算法与 patternAt 相同，两边读数严格一致 */
export function* cyclesOf(p: BreathPattern): Generator<CycleSpan, never> {
  let start = 0
  let index = 0
  for (const c of p.warmup ?? NO_CYCLES) {
    yield { index, start, T: c.T, rate: c.rate, segs: c.segs }
    start += c.T
    index++
  }
  for (let n = 0; ; n++)
    yield { index: index + n, start: start + n * p.T, T: p.T, rate: p.rate, segs: p.segs }
}

/** 第 t 秒（t ≥ 0）所在的那一轮；与 patternAt、cyclesOf 的算法相同 */
export function cycleAt(p: BreathPattern, t: number): CycleSpan {
  let start = 0
  let index = 0
  for (const c of p.warmup ?? NO_CYCLES) {
    if (t < start + c.T) return { index, start, T: c.T, rate: c.rate, segs: c.segs }
    start += c.T
    index++
  }
  const n = steadyIndex(t, start, p.T)
  return { index: index + n, start: start + n * p.T, T: p.T, rate: p.rate, segs: p.segs }
}

/** 到练习第 t 秒为止完成的整轮数 */
export function completedCycles(p: BreathPattern, t: number): number {
  if (!(t > 0)) return 0
  let start = 0
  let done = 0
  for (const c of p.warmup ?? NO_CYCLES) {
    if (t - start + CYCLE_EPS * c.T < c.T) return done
    start += c.T
    done++
  }
  return done + Math.floor((t - start) / p.T + CYCLE_EPS)
}

const num = (x: number): string => String(round1(x))
const half = (x: number): string => String(Math.round(x / DESCRIBE_STEP_SEC) * DESCRIBE_STEP_SEC)

/**
 * 一句话说明节拍，如「吸 4.5 秒，呼 6.5 秒 · 每分钟 5.5 次」。
 * 慢呼吸的秒数取到半秒；叹息和固定秒数的节拍取到 0.1 秒
 */
export function describePattern(params: PacedParams): string {
  const p = buildPattern(params)
  const durs = p.segs.map(s => num(s.dur))
  switch (params.type) {
    case 'sigh':
      return `鼻吸 ${durs[0]} 秒 → 再吸 ${durs[1]} 秒 → 嘴呼 ${durs[2]} 秒 · 每分钟 ${num(p.rate)} 轮`
    case 'resonance': {
      const [inhale, exhale] = p.segs.map(s => half(s.dur))
      return `吸 ${inhale} 秒，呼 ${exhale} 秒 · 每分钟 ${num(p.rate)} 次`
    }
    case 'phases':
      return p.segs.map(s => `${s.label} ${num(s.dur)}`).join(' · ')
  }
}
