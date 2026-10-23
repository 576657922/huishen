/**
 * 练习计划：把练习目录、偏好、健康情况检查和这一次的覆盖项，合成会话引擎要的 SessionPlan。
 * 纯函数：不读存储、不碰声音。startPractice 在用户手势里调用它，紧接着交给会话控制器。
 * v1 没有语音引导（PRODUCT.md §0）：引导词是屏幕上的文字，计划的 voice 总是 false
 */
import type { SoundMix } from '@/audio/types'
import {
  adjustedDefaults,
  type CatalogPracticeId,
  isOffered,
  PRACTICE_BY_ID,
  type PracticeDefaults,
  type ScreeningAnswers,
  scriptIdFor,
  soundModeOf,
  V1_UNAVAILABLE,
} from '@/content/practices'
import { getScript } from '@/content/scripts'
import { fitMix } from '@/content/sounds'
import type { GuidanceLevel, PacedParams } from '@/content/types'
import type { IntervalBell, Prefs } from '@/data'
import {
  BOX_PHASE_MAX_SEC,
  BOX_PHASE_MIN_SEC,
  type BreathPattern,
  buildPattern,
  buildTimeline,
  DEFAULT_FADE_IN_SEC,
  type Prosody,
  type SessionPlan,
  SIGH_CYCLE_MAX,
  SIGH_CYCLE_MIN,
  SLOW_RATE_MAX,
  SLOW_RATE_MIN,
  type Timeline,
  type TimelineOptions,
  withWarmup,
} from '@/engine'
import { PACE_FINDER_ASSESSMENT } from '@/hrv'
import { clamp } from '@/lib/math'

/* ---------- 常量 ---------- */

/**
 * 舒适节律探索的五档（次/分），从快到慢，每档 1 分钟（PRODUCT.md §2）。
 * 就是心率模块的 PACE_FINDER_ASSESSMENT.rates（[6.5, 6, 5.5, 5, 4.5]），只有这一份
 */
export const PACE_FINDER_RATES = PACE_FINDER_ASSESSMENT.rates

/** 舒适节律探索每一档的秒数 */
export const PACE_STEP_SEC = 60

/** 一分钟的引导（一分钟停一停、落地练习、1 分钟的周期性叹息）结尾只留 5 秒：默认的 10 秒占了一分钟的六分之一 */
export const SHORT_END_BUFFER_SEC = 5

/** 箱式呼吸每一步的秒数（PRODUCT.md §2：每步 3–6 秒，默认 4；范围取自引擎） */
export const BOX_PHASE_SEC = { min: BOX_PHASE_MIN_SEC, max: BOX_PHASE_MAX_SEC, default: 4 } as const

/**
 * 慢呼吸可选的节律（详情页的滑块）：4.5–7.0，与引擎的 SLOW_RATE_MIN、SLOW_RATE_MAX 一致（PRODUCT.md §2）。
 * 计划给的、记住的、个人的速度，舒适节律探索的档位，和「有点急」之后记住的速度都收在这个范围里
 */
export const SLOW_RATE = { min: SLOW_RATE_MIN, max: SLOW_RATE_MAX, step: 0.5 } as const

/** 计划里写 rate: 'personal'、还没有个人速度时用的速度（content/programs/breathing-4w.ts） */
export const DEFAULT_PERSONAL_RATE = 5.5

/** 睡前的背景声淡入更慢（engine/types.ts 的 fadeInSec） */
export const BEDTIME_FADE_IN_SEC = 20

/** 开头倒数的上限，与偏好的校验一致 */
const MAX_LEAD_SEC = 30

/* ---------- 类型 ---------- */

/**
 * 覆盖节拍参数，与 TodayPick.params、ProgramItem.params、记录里的 params 同形：
 * 慢呼吸 { rate, ratio }（rate 可以是 'personal'），周期性叹息 { cycle }，
 * 箱式呼吸 { phase }（四步同为几秒）或 { inhale, holdIn, exhale, holdOut }，舒适节律探索 { rate, step }
 */
export type PlanParams = Readonly<Record<string, number | string>>

/** 这一次与偏好不同的地方；不填的项都按偏好和练习的默认 */
export interface PlanOverrides {
  params?: PlanParams
  /** 这一次的背景声：声景、音乐和各自音量（模式由练习决定，不能覆盖） */
  sound?: Partial<SoundMix>
  guidance?: GuidanceLevel
  /** 慢呼吸开头 90 秒从每分钟 8 次逐步放慢，默认开 */
  warmup?: boolean
  /** 静坐计时的间隔钟声（分钟），0 为不响 */
  intervalBell?: IntervalBell
  /** 开头倒数秒数（舒适节律探索第二档起用较短的倒数） */
  leadSec?: number
}

/** 练完问什么 */
export interface AfterQuestions {
  /** 练完感觉：更平静 / 差不多 / 更紧张 / 很不舒服 */
  feeling: boolean
  /** 此刻有多紧张？0–10（练习前、后各一次） */
  checkin: boolean
}

/* ---------- 查询 ---------- */

/**
 * v1 暂不提供的练习（PRODUCT.md §2）：正念行走和睡前身体扫描，都要有真人录音。名单和判断都在内容层
 * （content/practices 的 V1_UNAVAILABLE、isOffered；不认识的 id 也为 false），这里转出，开始练习和播放器的深链接用它挡住
 */
export { isOffered, V1_UNAVAILABLE }

/** 睡前的练习：睡前身体扫描和听声音 · 睡前。语气越来越轻，不敲提示音和结束钟，练完不问 */
export const isBedtime = (id: CatalogPracticeId): boolean => soundModeOf(id) === 'sleep'

/**
 * 练完问什么。睡前之后都不问（PRODUCT.md §6），舒适节律探索是测试也不问。
 * 练完感觉没有开关（DESIGN.md §13.9）：关掉它会悄悄关掉「最近 3 次里 2 次」的安全提醒
 */
export function afterQuestions(id: CatalogPracticeId, prefs: Pick<Prefs, 'checkin'>): AfterQuestions {
  const asked = !isBedtime(id) && PRACTICE_BY_ID[id].kind !== 'assessment'
  return { feeling: asked, checkin: asked && prefs.checkin.prePost }
}

/**
 * 实际练多久（分钟）：在可选时长里就照办；不在时取不超过它的最长一档，再没有就用默认。
 * 健康情况检查缩短了可选时长时，计划或旧设置里更长的时长由此收回来
 */
export function fitMinutes(
  requested: number,
  d: Pick<PracticeDefaults, 'durations' | 'defaultMinutes'>,
): number {
  if (d.durations.includes(requested)) return requested
  const shorter = d.durations.filter(m => m > 0 && m <= requested)
  return shorter.length > 0 ? Math.max(...shorter) : d.defaultMinutes
}

/** 打开练习时默认选中的时长：上次在详情页选的，否则按健康情况检查调整后的默认 */
export function defaultMinutes(
  id: CatalogPracticeId,
  prefs: Pick<Prefs, 'practice'>,
  screening: ScreeningAnswers | null,
): number {
  const d = adjustedDefaults(id, screening)
  const saved = prefs.practice[id]?.minutes
  return saved !== undefined && d.durations.includes(saved) ? saved : d.defaultMinutes
}

/* ---------- 合成计划 ---------- */

/**
 * 一次练习的完整计划。minutes 不在可选时长里时按 fitMinutes 收回；舒适节律探索每次只排一档（60 秒），
 * 档位的速度由 overrides.params.rate 给出。
 */
export function buildPlan(
  practiceId: CatalogPracticeId,
  minutes: number,
  prefs: Prefs,
  screening: ScreeningAnswers | null,
  overrides: PlanOverrides = {},
): SessionPlan {
  const practice = PRACTICE_BY_ID[practiceId]
  const adjusted = adjustedDefaults(practiceId, screening)
  const bedtime = isBedtime(practiceId)
  const assessment = practice.kind === 'assessment'
  const mins = assessment ? PACE_STEP_SEC / 60 : fitMinutes(minutes, adjusted)
  const plannedSec = Math.round(mins * 60)

  const paced = pacedFor(practiceId, prefs, adjusted, overrides)
  const pattern = paced ? patternOf(practiceId, paced, prefs, overrides) : null
  const level = overrides.guidance ?? adjusted.guidance ?? prefs.guidance
  const timeline = assessment ? null : timelineFor(practiceId, mins, level)
  const sound = soundFor(practiceId, prefs, overrides)
  const bell = overrides.intervalBell ?? prefs.intervalBell
  const intervalSec = practice.kind === 'timer' && bell > 0 && bell * 60 < plannedSec ? bell * 60 : null

  const params: Record<string, number | string> = {}
  if (paced) Object.assign(params, pacedRecord(paced))
  if (assessment) {
    const step = numberOf(overrides.params?.step)
    if (step !== undefined) params.step = step
  }
  if (timeline) params.level = level
  if (practice.kind === 'timer') params.interval = bell
  if (practice.kind === 'sound') params.mode = soundModeOf(practiceId)

  return {
    practiceId,
    kind: practice.kind,
    title: practice.name,
    plannedSec,
    leadSec: clamp(overrides.leadSec ?? prefs.leadIn, 0, MAX_LEAD_SEC),
    pattern,
    timeline,
    intervalSec,
    sound,
    // 一分钟停一停的四段在 60 秒里各响一声提示音太密；睡前不响任何提示音
    cues: prefs.cues && !bedtime && practiceId !== 'pause',
    // 文字引导里安静了 20 秒以上再出现新的一句时轻响一声（PRODUCT.md §5）；睡前不响
    captionCue: prefs.captionCue && timeline !== null && !bedtime && practice.kind !== 'sound',
    // v1 没有语音引导（PRODUCT.md §0）
    voice: false,
    haptics: prefs.haptics,
    silentEnd: prefs.silentEnd,
    params,
    ...(pattern ? { cueStyle: prefs.cueStyle } : {}),
    // 舒适节律探索一档接一档，档与档之间是评分，不敲结束钟
    endBell: !bedtime && !assessment,
    // 设置 › 钟声：关掉时开始、结束都不敲，结尾照常淡出
    bells: prefs.bells,
    fadeInSec: bedtime ? BEDTIME_FADE_IN_SEC : DEFAULT_FADE_IN_SEC,
    prosody: prosodyOf(practiceId),
  }
}

/* ---------- 节拍 ---------- */

const numberOf = (x: unknown): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? x : undefined

const ratioOf = (x: unknown): 'equal' | 'long' | undefined => (x === 'equal' || x === 'long' ? x : undefined)

/** 慢呼吸可选的范围：4.5–7.0（PRODUCT.md §2） */
const slowRate = (rate: number): number => clamp(rate, SLOW_RATE_MIN, SLOW_RATE_MAX)

/** 节拍参数：这一次的覆盖 → 这项练习记住的设置 → 个人速度 → 练习（或健康情况检查调整后）的默认 */
function pacedFor(
  id: CatalogPracticeId,
  prefs: Prefs,
  adjusted: PracticeDefaults,
  o: PlanOverrides,
): PacedParams | null {
  const over = o.params ?? {}
  const own = prefs.practice[id] ?? {}
  if (PRACTICE_BY_ID[id].kind === 'assessment') {
    // 舒适节律探索按这个人之后真正要练的慢呼吸比例呼吸：记住的比例，没有就用慢呼吸的默认（呼气更长），
    // 也就是心率模块排测定用的比例（PACE_FINDER_ASSESSMENT.ratio）。心率带的评分只看每轮的起点，与比例无关
    const rate = numberOf(over.rate) ?? PACE_FINDER_RATES[0]
    return {
      type: 'resonance',
      rate: slowRate(rate),
      ratio: ratioOf(over.ratio) ?? prefs.practice.slow?.ratio ?? PACE_FINDER_ASSESSMENT.ratio,
    }
  }
  const base = adjusted.paced
  if (!base) return null
  switch (base.type) {
    case 'resonance': {
      // 'personal'：四周呼吸第 4 周用个人速度（舒适节律探索的结果或「有点急」之后记住的速度）
      const rate =
        over.rate === 'personal'
          ? (prefs.personalRate ?? DEFAULT_PERSONAL_RATE)
          : (numberOf(over.rate) ?? own.rate ?? prefs.personalRate ?? base.rate)
      return {
        type: 'resonance',
        rate: slowRate(rate),
        ratio: ratioOf(over.ratio) ?? own.ratio ?? base.ratio,
      }
    }
    case 'sigh': {
      const cycle = numberOf(over.cycle) ?? own.cycle ?? base.cycle
      return { type: 'sigh', cycle: clamp(cycle, SIGH_CYCLE_MIN, SIGH_CYCLE_MAX) }
    }
    case 'phases': {
      const phases = [over.inhale, over.holdIn, over.exhale, over.holdOut].map(numberOf)
      const [inhale, holdIn, exhale, holdOut] = phases
      if (inhale !== undefined && holdIn !== undefined && exhale !== undefined && holdOut !== undefined) {
        const box = (s: number): number => clamp(s, BOX_PHASE_SEC.min, BOX_PHASE_SEC.max)
        // 屏息可以为 0（没有这一步），吸和呼不能
        const hold = (s: number): number => (s <= 0 ? 0 : box(s))
        return {
          type: 'phases',
          inhale: box(inhale),
          holdIn: hold(holdIn),
          exhale: box(exhale),
          holdOut: hold(holdOut),
        }
      }
      const s = clamp(
        numberOf(over.phase) ?? own.phaseSec ?? base.inhale,
        BOX_PHASE_SEC.min,
        BOX_PHASE_SEC.max,
      )
      return { type: 'phases', inhale: s, holdIn: s, exhale: s, holdOut: s }
    }
  }
}

/**
 * 慢呼吸默认开头从每分钟 8 次逐步放慢（PRODUCT.md §2）：这一次的覆盖 → 详情页的开关（prefs.practice.slow.warmup）→ 开。
 * 其他节拍原样
 */
function patternOf(id: CatalogPracticeId, paced: PacedParams, prefs: Prefs, o: PlanOverrides): BreathPattern {
  const pattern = buildPattern(paced)
  if (id !== 'slow') return pattern
  return (o.warmup ?? prefs.practice.slow?.warmup ?? true) ? withWarmup(pattern) : pattern
}

/** 记录里的节拍参数：慢呼吸记计划的速度，实际（「有点急」之后）的速度另记在 rate 字段 */
function pacedRecord(p: PacedParams): Record<string, number | string> {
  switch (p.type) {
    case 'resonance':
      return { rate: p.rate, ratio: p.ratio }
    case 'sigh':
      return { cycle: p.cycle }
    case 'phases':
      return { inhale: p.inhale, holdIn: p.holdIn, exhale: p.exhale, holdOut: p.holdOut }
  }
}

/* ---------- 引导 ---------- */

/** 睡前的引导越往后越慢、越轻（content/scripts/body-scan-sleep.ts 的约定） */
const prosodyOf = (id: CatalogPracticeId): Prosody => (isBedtime(id) ? 'settle' : 'steady')

/**
 * 引导时间线。总是传入引导详细程度（不传时引擎按「详细」排）；字速用引擎默认的每秒 3.6 字
 * （冥想引导的语速：引导词按它写好了时间，以后的真人录音也按它）。一分钟的练习结尾留白缩短到 5 秒
 */
function timelineFor(id: CatalogPracticeId, minutes: number, level: GuidanceLevel): Timeline | null {
  const scriptId = scriptIdFor(id, minutes)
  if (!scriptId) return null
  const opts: TimelineOptions = { level, prosody: prosodyOf(id) }
  if (minutes <= 1) opts.endBufferSec = SHORT_END_BUFFER_SEC
  return buildTimeline(getScript(scriptId), minutes, opts)
}

/* ---------- 声音 ---------- */

/**
 * 背景声：听声音用设置里这个模式的默认组合和音量；其他练习用这项练习记住的声景、音乐（没有就用练习的默认）
 * 和设置里的音量。最后按模式筛掉不能用的声音（睡前没有鸟鸣）。
 * 只有听声音和睡前的练习写明模式：其余按放松播放，记录里也就不多一项没有信息的「放松」
 */
function soundFor(id: CatalogPracticeId, prefs: Prefs, o: PlanOverrides): SoundMix {
  const practice = PRACTICE_BY_ID[id]
  const mode = soundModeOf(id)
  const own = prefs.practice[id] ?? {}
  const base: SoundMix =
    practice.kind === 'sound'
      ? { ...prefs.sounds[mode] }
      : {
          ambience: own.ambience ?? practice.sound.ambience,
          music: own.music ?? practice.sound.music,
          ambienceVolume: prefs.volume.ambience,
          musicVolume: prefs.volume.music,
        }
  const merged = { ...base, ...o.sound }
  const ids = fitMix(merged, mode)
  const mix: SoundMix = {
    ambience: ids.ambience,
    music: ids.music,
    ambienceVolume: clamp(merged.ambienceVolume, 0, 100),
    musicVolume: clamp(merged.musicVolume, 0, 100),
  }
  if (practice.kind === 'sound' || mode === 'sleep') mix.mode = mode
  return mix
}
