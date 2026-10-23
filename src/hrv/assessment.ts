/**
 * 共振频率测定（Lehrer、Vaschillo 与 Vaschillo，2000；Shaffer 与 Meehan，2020）。
 * 依次以几个频率各呼吸约两分钟，比较每个频率下心率随呼吸起伏的幅度（每轮峰谷差），起伏最大的就是共振频率；
 * 幅度相差不到一成时，再比低频段功率。没有心率带时，按每个频率呼吸时是否舒适、轻松来选。
 *
 * 舒适节律探索（PRODUCT §2）用同一套方案，每档 1 分钟（PACE_FINDER_ASSESSMENT），按每档之后自评的轻松度来选
 * （pickByComfort）；连接心率带时的评分只作参考。评分的门槛随每段的长短换算，两种时长用同一套标准。
 *
 * 舒适节律探索按慢呼吸的默认吸呼比例呼吸（呼气更长，吸 4.5 : 呼 6.5，SLOW_RATIO）：测的是这个人之后真正要练的呼吸；
 * 两分钟一段的标准测定沿用吸呼等长。评分不看比例：只用每一轮的起点（start + k × period）切出各轮，
 * 峰谷差、低频功率、节奏偏离都与吸呼各占多少无关，所以等长或呼气更长的测定都用同一套评分。
 *
 * 全部是纯函数。各段的节拍用引擎的 buildPattern 生成，界面、提示音和模拟器读的是同一份节拍；
 * 每一段都要从 trial.start 开始新的一轮吸气，各轮的起点才是 start + k × period，与这里的计算对得上。
 */
import { PRACTICE_BY_ID } from '@/content/practices'
import type { PacedParams } from '@/content/types'
import { buildPattern, patternAt, RATE_MAX, RATE_MIN } from '@/engine/patterns'
import type { BreathPattern } from '@/engine/types'
import { clamp, mean, sum } from '@/lib/math'
import {
  artifactMask,
  cycleAmplitudes,
  hrSeries,
  lfPower,
  MIN_SPECTRUM_SEC,
  meanHr,
  rmssdOfBeats,
  typicalAmplitudes,
} from './metrics'
import type { Beat } from './types'

export type ResonanceParams = Extract<PacedParams, { type: 'resonance' }>

/** 内容目录里慢呼吸的默认吸呼比例 */
function slowRatio(): ResonanceParams['ratio'] {
  const paced = PRACTICE_BY_ID.slow.paced
  return paced?.type === 'resonance' ? paced.ratio : 'long'
}

/**
 * 慢呼吸的默认吸呼比例（'long'：呼气更长，吸 4.5 : 呼 6.5）。舒适节律探索按它呼吸，测的是之后真正要练的呼吸；
 * 评分与比例无关
 */
export const SLOW_RATIO: ResonanceParams['ratio'] = slowRatio()

/** 测定的五档（次/分），从快到慢：6.5 → 4.5（PRODUCT §2）。应用层的舒适节律探索也从这里取 */
const FIVE_RATES = Object.freeze([6.5, 6, 5.5, 5, 4.5] as const)

/* ---------- 方案 ---------- */

export interface AssessmentConfig {
  /** 依次测试的频率（次/分） */
  rates: readonly number[]
  /** 每个频率呼吸的秒数；会取整到整轮（正好半轮时多呼吸一轮），让每一段都在呼完气时切换 */
  trialSec: number
  /**
   * 每段开头不计入分析的秒数：换了频率，心率要过一会儿才跟上。
   * 传给 planAssessment 时可以不给：按每段时长的六分之一，最多 20 秒（两分钟一段为 20 秒，一分钟一段为 10 秒）
   */
  settleSec: number
  /** 吸呼比例：标准测定为等长，舒适节律探索为慢呼吸的默认比例（SLOW_RATIO）。只影响节拍的形状，不影响评分 */
  ratio: 'equal' | 'long'
  /** 两段之间自然呼吸的秒数；0 为一段接一段 */
  restSec: number
}

/** 用心率带测定共振频率的标准做法：5 个频率，每个 2 分钟，开头 20 秒不计入分析，吸呼等长 */
export const DEFAULT_ASSESSMENT: Readonly<AssessmentConfig> = Object.freeze({
  rates: FIVE_RATES,
  trialSec: 120,
  settleSec: 20,
  ratio: 'equal',
  restSec: 0,
})

/**
 * 舒适节律探索（PRODUCT §2）：同样 5 档（rates 是 [6.5, 6, 5.5, 5, 4.5] 这个元组，应用层的 PACE_FINDER_RATES 就是它），
 * 每档 1 分钟，开头 10 秒不计入分析；按慢呼吸的默认比例呼吸，测的是之后真正要练的呼吸。
 * 每档之后自评轻松度，按 pickByComfort 选；心率带可选，只作参考。
 * 每档之后要停下来打分，界面通常一档一档分开练：心搏时刻用 trial.start 加上这一档自己的计时（见 scoreTrial）
 */
export const PACE_FINDER_ASSESSMENT = Object.freeze({
  rates: FIVE_RATES,
  trialSec: 60,
  settleSec: 10,
  ratio: SLOW_RATIO,
  restSec: 0,
}) satisfies Readonly<AssessmentConfig>

/**
 * 心率换了频率后要 20 秒左右才跟上；一段很短时舍弃不起这么多，按段长的这一比例。
 * 一分钟一段只舍弃 10 秒，计入分析的头一两轮还带着上一段（或打分时自然呼吸）的影响，好在各档受的影响相近
 */
const SETTLE_SHARE = 1 / 6

const settleFor = (trialSec: number): number =>
  Math.min(DEFAULT_ASSESSMENT.settleSec, trialSec * SETTLE_SHARE)

export interface AssessmentTrial {
  index: number
  /** 次/分 */
  rate: number
  /** 这一段的节拍参数，可直接放进练习参数或记录 */
  paced: ResonanceParams
  /** 由 paced 生成的节拍，可直接交给引擎（SessionPlan.pattern） */
  pattern: BreathPattern
  /** 一轮的秒数 */
  period: number
  /** 这一段的整轮数 */
  cycles: number
  /** 距测定开始的秒数 */
  start: number
  end: number
  /** 从这里开始计入分析 */
  analysisStart: number
}

export interface AssessmentPlan {
  config: AssessmentConfig
  trials: AssessmentTrial[]
  /** 总秒数 */
  duration: number
}

function validate(c: AssessmentConfig): void {
  if (!c.rates.length) throw new RangeError('至少要有一个测试频率')
  for (const r of c.rates) {
    if (!(Number.isFinite(r) && r >= RATE_MIN && r <= RATE_MAX)) {
      throw new RangeError(`测试频率应在 ${RATE_MIN}–${RATE_MAX} 次/分之间：${r}`)
    }
  }
  if (!(Number.isFinite(c.trialSec) && c.trialSec > 0)) throw new RangeError(`每段时长不合理：${c.trialSec}`)
  if (!(c.settleSec >= 0 && c.settleSec < c.trialSec)) throw new RangeError(`适应时长不合理：${c.settleSec}`)
  if (!(c.restSec >= 0 && Number.isFinite(c.restSec))) throw new RangeError(`休息时长不合理：${c.restSec}`)
}

/**
 * 排出测定的各段；配置不合理时抛出 RangeError。没给的项（含显式的 undefined）取 DEFAULT_ASSESSMENT，
 * 只有 settleSec 随 trialSec 换算（见 AssessmentConfig.settleSec）：planAssessment({ trialSec: 60, ratio: SLOW_RATIO })
 * 与 planAssessment(PACE_FINDER_ASSESSMENT) 相同
 */
export function planAssessment(config: Partial<AssessmentConfig> = {}): AssessmentPlan {
  const d = DEFAULT_ASSESSMENT
  const trialSec = config.trialSec ?? d.trialSec
  const cfg: AssessmentConfig = {
    rates: config.rates ?? d.rates,
    trialSec,
    settleSec: config.settleSec ?? settleFor(trialSec),
    ratio: config.ratio ?? d.ratio,
    restSec: config.restSec ?? d.restSec,
  }
  validate(cfg)
  const trials: AssessmentTrial[] = []
  let at = 0
  cfg.rates.forEach((rate, index) => {
    const paced: ResonanceParams = { type: 'resonance', rate, ratio: cfg.ratio }
    const period = 60 / rate
    // 正好半轮时多呼吸一轮（一分钟 6.5 次为 7 轮）；留一点余量，免得浮点误差把 100 秒 × 5.1 次的 8.5 轮舍成 8 轮
    const cycles = Math.max(1, Math.round((cfg.trialSec * rate) / 60 + 1e-9))
    // 先乘后除，避免 13 × (60 / 6.5) 这类累积误差
    const end = at + (cycles * 60) / rate
    trials.push({
      index,
      rate,
      paced,
      pattern: buildPattern(paced),
      period,
      cycles,
      start: at,
      end,
      analysisStart: Math.min(at + cfg.settleSec, end),
    })
    at = end + cfg.restSec
  })
  return { config: cfg, trials, duration: trials.at(-1)?.end ?? 0 }
}

export interface TrialPosition {
  trial: AssessmentTrial
  /** settle：刚换频率，不计入分析；measure：计入分析 */
  phase: 'settle' | 'measure'
  /** 这一段已进行、还剩的秒数 */
  elapsed: number
  remaining: number
}

/** 测定进行到 t 秒时在哪一段；在段与段之间的休息里或测定之外为 null */
export function trialAt(plan: AssessmentPlan, t: number): TrialPosition | null {
  const trial = plan.trials.find(x => t >= x.start && t < x.end)
  if (!trial) return null
  return {
    trial,
    phase: t < trial.analysisStart ? 'settle' : 'measure',
    elapsed: t - trial.start,
    remaining: trial.end - t,
  }
}

/** 测定进行到 t 秒时节拍要求的肺容量（0 呼空，1 吸满）；休息或测定之外为 null。供模拟器演示和测试使用 */
export function targetVolume(plan: AssessmentPlan, t: number): number | null {
  const pos = trialAt(plan, t)
  return pos ? patternAt(pos.trial.pattern, pos.elapsed).y : null
}

/* ---------- 每一段的评分 ---------- */

/*
 * 评分的门槛随这一段的长短换算，两分钟一段与一分钟一段（舒适节律探索）用同一套标准：
 * 覆盖率、量得出的轮次占比、伪迹率本来就是比例，心搏数按分析窗口的秒数折算；
 * 窗口短、心搏少时比例太粗，另外容得下一次早搏；频谱窗口不够长时往前借适应期。
 * 不随长短变的只有两项：至少 3 轮（少于 3 轮算不出可信的平均和标准误，也看不出哪一轮离群），
 * 以及节奏偏离的容差（在模拟测定里，心率起伏中等、跟上节拍时，峰值频率的偏差两种时长都不超过 0.3 次/分）。
 */

/** 有效轮次少于 3 轮，幅度不可靠 */
const MIN_CYCLES = 3
/**
 * 分析窗口里平均每分钟至少这么多搏（两分钟一段的 100 秒窗口里为 20 搏）。远低于任何人的心率，
 * 只防止寥寥几搏也算出指标；数据够不够主要看覆盖率
 */
const MIN_BEATS_PER_MIN = 12
/** 数据覆盖不到六成，多半是接触不良或连接中断 */
const MIN_COVERAGE = 0.6
const GOOD_COVERAGE = 0.85
/** 剔除超过 5% 的心搏时指标仍可算，但要打折扣，这是心率变异分析里常用的经验界限 */
const MAX_GOOD_ARTIFACTS = 0.05
/**
 * 一次早搏或误检最多剔除两搏（一短一长，或拆成的两个短间期）。一分钟一段而心率又慢时不到 40 搏，
 * 一次早搏就超过 5%，但一次早搏不影响峰谷差，不该因此算作有瑕疵
 */
const ARTIFACT_ALLOWANCE = 2
/** 有效轮次占比低于这个数，说明中间断断续续 */
const GOOD_CYCLE_SHARE = 0.75
/**
 * 算低频功率和峰值频率的最短窗口。lfPower 要求心搏跨越 50 秒，窗口两端的心搏不会恰好落在边上，留 5 秒余量。
 * 一分钟一段的分析窗口只有 50–57 秒，不够时往前借适应期的最后几秒：这时心率已基本跟上新的节拍，
 * 每一段都能查是否跟上了节拍，低频功率也都有值；两分钟一段的分析窗口足够长，不受影响
 */
const SPECTRUM_SEC = MIN_SPECTRUM_SEC + 5
/**
 * 跟着节拍呼吸时，心率起伏的主频就是呼吸频率。偏离超过这么多（次/分），说明没跟上节拍，
 * 或心率起伏太弱、被别的波动盖过；这时的峰谷差量的已不是这个频率。
 */
const MAX_PACE_OFFSET = 0.75

export type TrialQuality = 'good' | 'noisy' | 'insufficient'

/**
 * 这一段数据的问题，供界面说明原因：
 * gaps：信号中断或接触不良，覆盖不全；artifacts：伪迹偏多，或有一轮的起伏大得不合常理（心率带松动、身体在动）；
 * off-pace：心率起伏的节奏与节拍不符（没跟上节拍，或起伏太弱）
 */
export type TrialIssue = 'gaps' | 'artifacts' | 'off-pace'

export interface TrialScore {
  rate: number
  /** 每轮心率峰谷差的平均（次/分） */
  amplitude: number
  /** 上面这个平均值的标准误（次/分），反映各轮之间的出入；不到两轮时为 NaN */
  amplitudeSe: number
  /**
   * 低频段功率，ms²。按分析窗口算；窗口不到 55 秒时（一分钟一段）用这一段最后 55 秒，含适应期末尾的几秒。
   * 心搏跨度不足 50 秒（数据缺得多，或一段本身太短）时为 NaN
   */
  lfPower: number
  /** 低频段峰值频率，Hz，与 lfPower 同一窗口；跟上节拍时约等于 rate / 60 */
  lfPeakHz: number
  rmssd: number
  meanHr: number
  quality: TrialQuality
  /** 发现的问题；good 时为空 */
  issues: TrialIssue[]
  /** 分析窗口内收到的心搏数（剔除前） */
  beats: number
  /** 被剔除的比例 0–1 */
  artifactRate: number
  /** 有效心搏覆盖分析窗口的比例 0–1 */
  coverage: number
  /** 计入平均的轮数：不含有空档而算不出的，也不含离群的 */
  cycles: number
}

function standardError(xs: readonly number[]): number {
  if (xs.length < 2) return Number.NaN
  const m = mean(xs)
  return Math.sqrt(sum(xs.map(x => (x - m) ** 2)) / (xs.length - 1) / xs.length)
}

interface Evidence {
  rate: number
  /** 分析窗口的秒数 */
  span: number
  /** 窗口里收到的心搏；其中被剔除的；剩下的 */
  received: number
  rejected: number
  clean: number
  coverage: number
  /** 应有的轮数；其中算得出峰谷差的；又其中因离群而不计的 */
  total: number
  measured: number
  outliers: number
  lfPeakHz: number
}

function issuesOf(e: Evidence): TrialIssue[] {
  const issues: TrialIssue[] = []
  if (e.coverage < GOOD_COVERAGE || e.measured < GOOD_CYCLE_SHARE * e.total) issues.push('gaps')
  const tolerated = Math.max(MAX_GOOD_ARTIFACTS * e.received, ARTIFACT_ALLOWANCE)
  // 离群的一轮说明有伪迹逃过了剔除，同一段里可能还有没那么显眼的
  if (e.rejected > tolerated || e.outliers > 0) issues.push('artifacts')
  if (Number.isFinite(e.lfPeakHz) && Math.abs(e.lfPeakHz * 60 - e.rate) > MAX_PACE_OFFSET)
    issues.push('off-pace')
  return issues
}

function judge(e: Evidence, issues: readonly TrialIssue[]): TrialQuality {
  const counted = e.measured - e.outliers
  const minBeats = (MIN_BEATS_PER_MIN * e.span) / 60
  if (e.clean < minBeats || e.coverage < MIN_COVERAGE || counted < MIN_CYCLES) return 'insufficient'
  return issues.length ? 'noisy' : 'good'
}

/**
 * 给一段打分。beats 为测定期间的心搏（按时间排序，未剔除伪迹），时刻与方案同一时钟：距测定开始的秒数。
 * 一段一段分开练时（舒适节律探索每档之后要停下来打分），心搏时刻用 trial.start 加上这一段自己的计时，
 * 每一段只用这一段收到的心搏打分：分开练时各段的计时会重叠（下一段开头倒数的负数时刻落在上一段里）。
 * 数据缺得多（不到六成）时 quality 为 insufficient，所以要等这一段练完再打分。
 */
export function scoreTrial(beats: readonly Beat[], trial: AssessmentTrial): TrialScore {
  const from = trial.analysisStart
  const to = trial.end
  const spectrumFrom = Math.max(trial.start, Math.min(from, to - SPECTRUM_SEC))
  const after = (t: number) => {
    const i = beats.findIndex(b => b.t > t)
    return i < 0 ? beats.length : i
  }
  const s0 = after(spectrumFrom)
  const i0 = after(from)
  const i1 = after(to)
  // 窗口两侧各多看两搏，边上的心搏也能和完整的五搏比较
  const c0 = Math.max(0, s0 - 2)
  const mask = artifactMask(beats.slice(c0, Math.min(beats.length, i1 + 2)).map(b => b.rr))
  const cleanFrom = (i: number) => beats.slice(i, i1).filter((_, k) => mask[i - c0 + k])
  const received = i1 - i0
  const clean = cleanFrom(i0)

  const k0 = Math.ceil((from - trial.start) / trial.period - 1e-9)
  const bounds: number[] = []
  for (let k = k0; k <= trial.cycles; k++) bounds.push(trial.start + k * trial.period)
  const measured = cycleAmplitudes(hrSeries(clean), bounds).filter(Number.isFinite)
  const amps = typicalAmplitudes(measured)

  const rr = clean.map(b => b.rr)
  const lf = lfPower(s0 < i0 ? cleanFrom(s0) : clean)
  const evidence: Evidence = {
    rate: trial.rate,
    span: Math.max(0, to - from),
    received,
    rejected: received - clean.length,
    clean: clean.length,
    // 第一搏的间期有一部分在 from 之前，最后一搏到 to 之间又没算，两头大致抵消，不必裁边
    coverage: to > from ? clamp(sum(rr) / 1000 / (to - from), 0, 1) : 0,
    total: Math.max(0, bounds.length - 1),
    measured: measured.length,
    outliers: measured.length - amps.length,
    lfPeakHz: lf.peakHz,
  }
  const issues = issuesOf(evidence)
  return {
    rate: trial.rate,
    amplitude: mean(amps),
    amplitudeSe: standardError(amps),
    lfPower: lf.power,
    lfPeakHz: lf.peakHz,
    rmssd: rmssdOfBeats(clean),
    meanHr: meanHr(rr),
    quality: judge(evidence, issues),
    issues,
    beats: received,
    artifactRate: received ? evidence.rejected / received : 0,
    coverage: evidence.coverage,
    cycles: amps.length,
  }
}

/* ---------- 选出共振频率 ---------- */

/** 峰谷差相差不到一成，视为不分高下 */
const TIE = 0.1
/** 功率是幅度的平方：与幅度差一成相当的功率差约为两成 */
const POWER_TIE = 1 - (1 - TIE) ** 2
/**
 * 有把握的领先：既要超过差值标准误的这么多倍（从几段里挑最大的，本身会高估领先，所以比常用的 1.96 略严），
 * 也要超过 MIN_LEAD 次/分。按心搏取样的峰谷差有约 1 次/分的误差，缓慢的心率漂移还会让同一段里各轮一起偏高或偏低，
 * 这部分标准误看不出来。在模拟测定里，按这两条标为「有把握」的结论，心率起伏中等以上时全部正确（一分钟一段时也是），
 * 起伏很弱（共振时峰谷差约 6 次/分）时约九成正确。
 */
const CONFIDENT_Z = 2
const MIN_LEAD = 1.5
/** 主观感受相同时，取最接近成人共振频率平均值的那个 */
const TYPICAL_RATE = 5.5

/**
 * 换算成心率单位（(次/分)²）的低频功率。同样的心率起伏，心率越低，RR 的起伏越大（RR = 60000 / HR），
 * 直接按 ms² 比较，会偏向恰好心率偏低的那一段。
 */
const lfInHr = (s: TrialScore): number => s.lfPower * (s.meanHr ** 2 / 60000) ** 2

/** 一档的主观评分，两项都可选；舒适节律探索只问轻松度 */
export interface ComfortRating {
  rate: number
  /** 1–5：舒适 */
  comfort?: number
  /** 1–5：轻松，不费力、不憋气（舒适节律探索每档之后问的就是这一项） */
  ease?: number
}

/** 一条评分的得分：给了几项就取几项的平均，只问「轻松吗」的流程也能和两项都问的比较 */
function ratingScore(r: ComfortRating): number | null {
  const parts = [r.comfort, r.ease].filter((x): x is number => x !== undefined && Number.isFinite(x))
  return parts.length ? mean(parts.map(x => clamp(x, 1, 5))) : null
}

/** 比较前取到百万分之一：取平均会带进浮点误差（1.1 与 1.3 的平均算出来是 1.2000000000000002），不该因此分出高下 */
const tidy = (x: number): number => Math.round(x * 1e6) / 1e6

/**
 * 按主观评分选：得分最高的频率。只评了轻松度（舒适节律探索）、只评了舒适、两项都评都可以，
 * 两项都评时取平均；同一频率评过几次（重做了某一档）取平均；没打分的档不参与。
 * 平分时取最接近 5.5 的，这是成人共振频率的平均值；仍然平分（如 5 与 6）取较快的，慢呼吸更容易憋气。
 * 没有有效评分时为 null。
 */
export function pickByComfort(ratings: readonly ComfortRating[]): number | null {
  const byRate = new Map<number, number[]>()
  for (const r of ratings) {
    const score = ratingScore(r)
    if (score === null || !(Number.isFinite(r.rate) && r.rate > 0)) continue
    byRate.set(r.rate, [...(byRate.get(r.rate) ?? []), score])
  }
  const ranked = [...byRate].map(([rate, scores]) => ({
    rate,
    score: tidy(mean(scores)),
    distance: tidy(Math.abs(rate - TYPICAL_RATE)),
  }))
  ranked.sort((a, b) => b.score - a.score || a.distance - b.distance || b.rate - a.rate)
  return ranked[0]?.rate ?? null
}

export interface ResonancePick {
  rate: number
  /** amplitude：峰谷差明显最大；lf：峰谷差接近，按低频功率；comfort：按主观感受 */
  basis: 'amplitude' | 'lf' | 'comfort'
  /** low：数据有瑕疵，或几个频率不分高下；建议改天再测一次 */
  confidence: 'high' | 'low'
}

function byComfort(ratings: readonly ComfortRating[]): ResonancePick | null {
  const rate = pickByComfort(ratings)
  return rate === null ? null : { rate, basis: 'comfort', confidence: 'low' }
}

/** 测过的频率里与 rate 紧挨着的：较慢、较快各一个，在两端时只有一个 */
function adjacentRates(rate: number, scores: readonly TrialScore[]): number[] {
  const rates = scores.map(s => s.rate)
  const slower = Math.max(...rates.filter(r => r < rate))
  const faster = Math.min(...rates.filter(r => r > rate))
  return [slower, faster].filter(Number.isFinite)
}

/**
 * 各段轮与轮之间峰谷差的标准差，合在一起估计（按自由度加权）。一段只有三四轮时（一分钟一段的测定），
 * 单独估出的标准差可能小得离谱，几段合起来才稳；各段起伏的离散程度本来就相近
 */
function pooledSd(pool: readonly TrialScore[]): number {
  let ss = 0
  let dof = 0
  for (const s of pool) {
    if (s.cycles < 2 || !Number.isFinite(s.amplitudeSe)) continue
    // 标准误乘以 √n 还原成这一段的标准差
    ss += (s.cycles - 1) * s.cycles * s.amplitudeSe ** 2
    dof += s.cycles - 1
  }
  return dof ? Math.sqrt(ss / dof) : Number.NaN
}

/**
 * 有把握的条件：选中的一段本身质量好，且至少有三段质量好的参与比较；它比其他每一段的峰谷差都明显更高（见 CONFIDENT_Z），
 * 每段的标准误取它自己的与按合并标准差算的两者中较大的；
 * 紧挨着它的两个频率都量成了——共振曲线只有一个峰，两侧都更低才说明峰就在这里，否则峰可能正落在没量成的那一段。
 */
function confident(pick: TrialScore, pool: readonly TrialScore[], scores: readonly TrialScore[]): boolean {
  const sd = pooledSd(pool)
  const se = (s: TrialScore) => Math.max(s.amplitudeSe, sd / Math.sqrt(s.cycles))
  const clearly = (o: TrialScore) =>
    pick.amplitude - o.amplitude > Math.max(MIN_LEAD, CONFIDENT_Z * Math.hypot(se(pick), se(o)))
  const good = pool.filter(s => s.quality === 'good').length
  const ahead = pool.every(o => o === pick || clearly(o))
  const flanked = adjacentRates(pick.rate, scores).every(r => pool.some(s => s.rate === r))
  return pick.quality === 'good' && good >= 3 && ahead && flanked
}

/**
 * 选出共振频率：峰谷差最大的；相差不到一成的几个里，取低频功率明显最高的；
 * 两项都分不出高下时参考主观评分，没有评分就取峰谷差最大的，并标为把握不大。
 *
 * 有瑕疵（noisy）的段也参与比较：伪迹已经剔除、有空档的轮次不计，剩下的峰谷差仍是有效的测量，
 * 只是误差大一些，所以选中它时把握一定标为不大。把它排除在外，共振那一段恰好多了几个伪迹时就一定选错；
 * 在模拟测定里，伪迹率 2% 时这样做把命中率从约九成提高到九成七。
 * 只有心率起伏不随节拍的段（off-pace）不参与：那里量到的已不是这个频率的起伏。
 * 能比较的段不到两段时只能按主观评分，没有评分则返回 null。
 */
export function pickResonance(
  scores: readonly TrialScore[],
  ratings: readonly ComfortRating[] = [],
): ResonancePick | null {
  const pool = scores.filter(
    s => s.quality !== 'insufficient' && Number.isFinite(s.amplitude) && !s.issues.includes('off-pace'),
  )
  if (pool.length < 2) return byComfort(ratings)
  const level = (pick: TrialScore) => (confident(pick, pool, scores) ? 'high' : 'low')
  const ratingsFor = (xs: readonly TrialScore[]) => ratings.filter(r => xs.some(s => s.rate === r.rate))

  // 以下各步都保持按峰谷差从大到小的顺序
  const ranked = [...pool].sort((a, b) => b.amplitude - a.amplitude)
  const top = ranked[0]!
  const close = ranked.filter(s => s.amplitude >= top.amplitude * (1 - TIE))
  if (close.length === 1) return { rate: top.rate, basis: 'amplitude', confidence: level(top) }

  const known = close.filter(s => Number.isFinite(lfInHr(s)))
  const lead = [...known].sort((a, b) => lfInHr(b) - lfInHr(a))[0]
  // 低频功率也接近、或算不出来（段太短）的，都算并列
  const tied = lead
    ? close.filter(s => !known.includes(s) || lfInHr(s) >= lfInHr(lead) * (1 - POWER_TIE))
    : close
  if (lead && tied.length === 1) return { rate: lead.rate, basis: 'lf', confidence: level(lead) }
  return byComfort(ratingsFor(tied)) ?? { rate: tied[0]!.rate, basis: 'amplitude', confidence: 'low' }
}
