/**
 * 一次练习里实际走的节拍：开头放慢、练习中「有点急」之后的换速，都表示为首尾相接的几段节拍。
 * 每一段从某一轮的开头起按自己的节拍走，直到下一段开始；段与段的交界都在一轮的末尾（呼空），
 * 所以呼吸曲线是连续的。画面、调度、振动和轮数都从这里读，彼此对齐。
 */
import {
  atRate,
  type CycleSpan,
  completedCycles,
  cycleAt,
  cyclesOf,
  patternAt,
  SLOW_RATE_MAX,
  warmupSec,
} from './patterns'
import type { BreathPattern, PatternPoint } from './types'

/** 「有点急」每次加快多少（次/分） */
export const STEP_BACK_RATE = 0.5
/**
 * 「有点急」最多加快到每分钟几次：慢呼吸范围的上限 7.0（PRODUCT §2）。
 * 开头放慢的头几轮（8、7.5 次）比它快，这时点「有点急」不往慢里调，而是停止继续放慢，见 stepBack
 */
export const STEP_BACK_MAX_RATE = SLOW_RATE_MAX
/** 换速至少在这么多秒之后的一轮开头生效，免得刚点下去这一轮就被截断 */
export const STEP_BACK_LEAD_SEC = 0.3

/** 比较时刻、速度时容忍的浮点误差 */
const EPS = 1e-6

export interface PacePiece {
  /** 从练习第几秒起按这一段的节拍走（总在某一轮的开头） */
  t0: number
  pattern: BreathPattern
  /** 这一段第一轮的轮序号（从练习开始数） */
  firstCycle: number
}

/** 按 t0 从小到大，至少一段；第一段从 0 秒开始 */
export type Pace = readonly [PacePiece, ...PacePiece[]]

/** 一次练习开始时的节拍安排：只有一段 */
export const paceOf = (pattern: BreathPattern): Pace => [{ t0: 0, pattern, firstCycle: 0 }]

/** t 所在的那一段；逐帧调用，段数很少，从后往前找 */
function pieceAt(pace: Pace, t: number): PacePiece {
  for (let i = pace.length - 1; i > 0; i--) {
    const piece = pace[i]
    if (piece && piece.t0 <= t) return piece
  }
  return pace[0]
}

/** 练习第 t 秒在节拍里的位置；t < 0 表示还在倒数，与 patternAt 相同 */
export function paceAt(pace: Pace, t: number): PatternPoint {
  const piece = pieceAt(pace, t)
  if (!(t >= 0)) return patternAt(piece.pattern, t)
  const point = patternAt(piece.pattern, t - piece.t0)
  point.cycle += piece.firstCycle
  return point
}

/** 练习第 t 秒（t ≥ 0）所在的那一轮，起点和轮序号按整个练习计 */
export function paceCycleAt(pace: Pace, t: number): CycleSpan {
  const piece = pieceAt(pace, Math.max(0, t))
  const c = cycleAt(piece.pattern, Math.max(0, t - piece.t0))
  return { ...c, index: piece.firstCycle + c.index, start: piece.t0 + c.start }
}

/** 依次产出每一轮，跨段连续；最后一段无限循环 */
export function* paceCycles(pace: Pace): Generator<CycleSpan> {
  for (const [i, piece] of pace.entries()) {
    const until = pace[i + 1]?.t0 ?? Number.POSITIVE_INFINITY
    for (const c of cyclesOf(piece.pattern)) {
      const start = piece.t0 + c.start
      // 下一段从这一轮开头接管；浮点误差不能让旧节拍多出一轮
      if (start >= until - EPS) break
      yield { ...c, index: piece.firstCycle + c.index, start }
    }
  }
}

/** 到练习第 t 秒为止完成的整轮数，跨段累计 */
export function paceBreaths(pace: Pace, t: number): number {
  if (!(t > 0)) return 0
  const piece = pieceAt(pace, t)
  return piece.firstCycle + completedCycles(piece.pattern, t - piece.t0)
}

/** 第 t 秒起生效的那一段节拍最后稳定的速度（开头放慢之后的速度） */
export const paceTarget = (pace: Pace, t: number): number => pieceAt(pace, t).pattern.rate

/** 到第 t 秒为止已经生效的换速次数 */
export const paceSteps = (pace: Pace, t: number): number => pace.filter(p => p.t0 > 0 && p.t0 < t).length

/**
 * 带引导词的呼吸练习里节拍停下的时刻：结尾的话开始（closingT）以后不再开始新的一段，正在走的这一段走完就停，
 * 曲线、滑音和背景声的起伏都停在一段的转折处。closingT 正好落在两段之间时就停在那里。
 * 不晚于 end；closingT 不早于 end（没有结尾的话）时就是 end
 */
export function paceEndAt(pace: Pace, closingT: number, end: number): number {
  if (!(closingT < end)) return end
  const t = Math.max(0, closingT)
  const p = paceAt(pace, t)
  if (!p.seg) return Math.min(t, end)
  const into = p.seg.dur * p.progress
  return Math.min(into < EPS ? t : t + p.rem, end)
}

export interface StepBack {
  pace: Pace
  /** 新速度生效的练习秒数（一轮的开头） */
  at: number
  /** 新的每分钟次数 */
  rate: number
}

/**
 * 「有点急」：从至少 STEP_BACK_LEAD_SEC 秒之后的下一轮开头起，按当前这一轮的速度加快 STEP_BACK_RATE 次
 * （不超过 STEP_BACK_MAX_RATE），开头剩下的放慢不再走，保持到练习结束。
 * 开头放慢还快过上限时（从每分钟 8 次放慢，上限是 7 次），不往慢里调：节拍照常放慢到上限，
 * 从放慢到上限的那一轮起停在上限，不再继续放慢。
 * 上一次还没生效时再点不算：连点两下不会叠加，也不会把已经排好的那次推后一轮。
 * 这次点击改变不了什么（已在上限、节拍本来就比上限快）时返回 null
 */
export function stepBack(pace: Pace, t: number): StepBack | null {
  if (!(t >= 0) || pace.some(p => p.t0 > t)) return null
  const current = pieceAt(pace, t)
  let cycle = paceCycleAt(pace, t)
  const rate = Math.min(STEP_BACK_MAX_RATE, cycle.rate + STEP_BACK_RATE)
  const above = rate < cycle.rate - EPS
  // 「有点急」只会加快；稳定以后仍比上限快的节拍不往慢里调
  if (above && current.pattern.rate > rate + EPS) return null
  // 这一轮剩得太少，就从再下一轮起
  if (cycle.start + cycle.T < t + STEP_BACK_LEAD_SEC) cycle = paceCycleAt(pace, cycle.start + cycle.T + EPS)
  let at = cycle.start + cycle.T
  let firstCycle = cycle.index + 1
  if (above) {
    // 开头放慢还快过上限：从放慢到上限（或更慢）的那一轮起，停在上限
    const reach = firstCycleAtMost(pace, at, rate)
    if (!reach) return null
    at = reach.start
    firstCycle = reach.index
  }
  // 速度没变、后面也没有放慢可省：排了也没有分别
  const steadyFrom = current.t0 + warmupSec(current.pattern)
  if (Math.abs(current.pattern.rate - rate) < EPS && at >= steadyFrom - EPS) return null
  const piece: PacePiece = { t0: at, pattern: atRate(current.pattern, rate), firstCycle }
  return { pace: [...pace, piece], at, rate }
}

/**
 * 从 from 秒起（含）第一轮每分钟不超过 rate 次的轮；没有为 null。
 * 只在最后一段的开头放慢里找：调用前已确认它稳定后的速度不超过 rate，开头放慢只会越来越慢，一定找得到
 */
function firstCycleAtMost(pace: Pace, from: number, rate: number): CycleSpan | null {
  for (const c of paceCycles(pace)) {
    if (c.start < from - EPS) continue
    if (c.rate <= rate + EPS) return c
    // 防御：已经稳定下来仍比上限快（调用前排除过），不再往后找
    if (Math.abs(c.rate - pieceAt(pace, c.start).pattern.rate) < EPS) return null
  }
  return null
}
