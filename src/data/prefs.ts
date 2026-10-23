/**
 * 偏好设置：存在 localStorage（启动时要同步读出主题等设置），读取时逐项校验，非法值回退。
 * 旧版本存下的形状在读取时迁移成当前版本（见 migrate），下次保存时才写成新格式。
 * 这里不依赖 React；组件里用 hooks.ts 的 usePrefs。
 */
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Bus, SoundMode } from '@/audio/types'
import type { PracticeId, ProgramId } from '@/content/types'
import {
  BOX_PHASE_MAX_SEC,
  BOX_PHASE_MIN_SEC,
  RATE_MAX,
  RATE_MIN,
  SLOW_RATE_MAX,
  SLOW_RATE_MIN,
} from '@/engine/patterns'
import { dayKey } from '@/lib/date'
import { round1 } from '@/lib/math'
import {
  bool,
  cleanText,
  finite,
  intIn,
  isAmbienceId,
  isClockTime,
  isCueStyle,
  isDayKey,
  isGuidanceLevel,
  isInstant,
  isMusicId,
  isPlainObject,
  isPracticeId,
  isProgramId,
  isTheme,
  realIn,
  within,
} from './guards'
import { parseProgramDay, programDayIndex, programDayKey } from './program'
import { getLocalStorage, readJSON, readText, writeText } from './storage'
import {
  type CheckinPrefs,
  type IntervalBell,
  PREFS_VERSION,
  type PracticePrefs,
  type Prefs,
  type ProgramProgress,
  type Reminders,
  type SafetyPrefs,
  type Screening,
  type SoundDefault,
  type StressRating,
} from './types'

/** 键名里的 v1 是历史原因：格式版本记在值里的 v，换键名反而要多迁移一次 */
export const PREFS_KEY = 'huishen.prefs.v1'

/**
 * 个人呼吸速度的范围（次/分）：慢呼吸的 4.5–7.0（engine 的 SLOW_RATE_MIN、SLOW_RATE_MAX，PRODUCT §2）。
 * 舒适节律探索从 6.5 测到 4.5，「有点急」之后记住的速度最多到 7
 */
export const PERSONAL_RATE = { min: SLOW_RATE_MIN, max: SLOW_RATE_MAX } as const

/** 静坐计时的间隔钟声可选的分钟数，0 为不响 */
export const INTERVAL_BELLS: readonly IntervalBell[] = [0, 5, 10]

/** 每周压力自评最多保留的次数：每周一次也够用将近四年 */
export const MAX_STRESS_RATINGS = 200

const MAX_LEAD_IN = 30
const MAX_TEXT = 60
const MAX_MINUTES = 240

export const DEFAULT_PREFS: Prefs = deepFreeze({
  v: PREFS_VERSION,
  theme: 'system',
  volume: { master: 80, ambience: 55, music: 45, cues: 70 },
  guidance: 'standard',
  // 安静了 20 秒以上再出现新的一句时轻响一声（PRODUCT §5、§8）
  captionCue: true,
  cueStyle: 'glide',
  cues: true,
  bells: true,
  intervalBell: 0,
  haptics: true,
  leadIn: 5,
  silentEnd: true,
  // 练习前后自评要用户自己打开（PRODUCT.md §6）；练完感觉只点一下，默认就问
  checkin: { prePost: false, feeling: true },
  weeklyStress: false,
  stressRatings: [],
  // 都用水声：水声的证据最多（sound-buxton-2021）；棕噪声只能遮蔽环境噪音，证据很弱，不作默认
  sounds: {
    relax: { ambience: 'stream', music: 'none', ambienceVolume: 55, musicVolume: 45, mode: 'relax' },
    sleep: { ambience: 'rain', music: 'none', ambienceVolume: 55, musicVolume: 45, mode: 'sleep' },
  },
  practice: {},
  personalRate: null,
  onboarded: false,
  safety: { ackOn: null, screening: null, monthlyCheck: false },
  reminders: null,
  programs: {},
})

/** 嵌套的设置可以只改其中几项 */
export type PrefsPatch = Partial<Omit<Prefs, 'v' | 'volume' | 'checkin' | 'safety' | 'sounds'>> & {
  volume?: Partial<Prefs['volume']>
  checkin?: Partial<CheckinPrefs>
  safety?: Partial<SafetyPrefs>
  sounds?: { [M in SoundMode]?: Partial<Omit<SoundDefault, 'mode'>> }
}

export interface PrefsActions {
  /** 合并修改；非法的值保持原样 */
  set(patch: PrefsPatch): void
  /** 0–100 */
  setVolume(bus: Bus, value: number): void
  /** 合并某个练习的设置；值为 undefined 的项会被删除 */
  setPractice(id: PracticeId, patch: PracticePrefs): void
  /** 记一次每周压力自评，默认记在今天；同一天再做时替换那天的分数。分数或日期不合法时什么也不做 */
  addStressRating(score: number, on?: Date | string): void
  /** 加入计划，默认从今天开始；已经加入的从头再来，进度清零 */
  startProgram(id: ProgramId, on?: Date | string): void
  /**
   * 记下计划里做完的一天，如 'w3d2'，on 为完成的日期（默认今天），记进 lastDoneOn。
   * 还没加入时先以那天加入；那一天已经做完过时什么也不改。键或日期不合法时什么也不做
   */
  completeProgramDay(id: ProgramId, day: string, on?: Date | string): void
  /** 退出计划，进度一并删除 */
  leaveProgram(id: ProgramId): void
  /** 全部恢复默认，包括引导、安全、提醒、计划和自评结果。用于「删除全部数据」 */
  reset(): void
  /**
   * 只恢复设置项。保留用户的数据和经历：是否看过引导、安全须知与健康情况检查、提醒计划、
   * 计划进度、压力自评结果和个人呼吸速度
   */
  resetSettings(): void
}

export type PrefsState = Prefs & PrefsActions

export type PrefsStore = StoreApi<PrefsState> & {
  /** 停止监听其他标签页（测试用） */
  destroy(): void
}

export interface PrefsStoreOptions {
  /** 默认 localStorage；null 表示只存在内存里 */
  storage?: Storage | null
  key?: string
}

/* ---------- 迁移 ---------- */

/**
 * v1 → v2：练习前后自评从一个开关变成两项；安全须知的日期并入 safety；「何时何地练什么」的计划
 * 改成执行意图式的提醒；八周计划的开始日期改成按计划分开的进度；静坐计时的间隔钟声从练习设置挪到外面。
 * 新字段已经有值时不覆盖。没有 v 的也按旧版本处理：迁移只认旧字段，别的数据原样留给逐项校验
 */
function migrate(o: Record<string, unknown>): Record<string, unknown> {
  if (typeof o.v === 'number' && o.v >= PREFS_VERSION) return o
  const out: Record<string, unknown> = { ...o }
  if (typeof o.checkin === 'boolean') out.checkin = { prePost: o.checkin }
  if (o.safety === undefined && o.safetyAck !== undefined) out.safety = { ackOn: o.safetyAck }
  if (o.reminders === undefined && isPlainObject(o.plan)) out.reminders = planToReminders(o.plan)
  if (o.programs === undefined && isPlainObject(o.program)) out.programs = { 'mindfulness-8w': o.program }
  if (o.intervalBell === undefined) out.intervalBell = timerInterval(o.practice)
  return out
}

/** v1 的计划只存了练习 id，练习的名字在内容层；「我会做」先只写时长，用户在设置里补全 */
function planToReminders(plan: Record<string, unknown>): Record<string, unknown> {
  return {
    cue: plan.place,
    action: minutesText(plan.minutes),
    fallback: minutesText(plan.fallbackMinutes),
    weekday: plan.time,
    // v1 的 time 在没设周末时刻时每天都用
    weekend: plan.weekendTime ?? plan.time,
  }
}

function minutesText(x: unknown): string {
  const n = finite(x)
  return n !== null && n > 0 ? `${round1(n)} 分钟` : ''
}

function timerInterval(practice: unknown): unknown {
  return isPlainObject(practice) && isPlainObject(practice.timer) ? practice.timer.interval : undefined
}

/* ---------- 校验 ---------- */

/** 先迁移旧格式，再逐项校验；某一项不合法时用 base 里的对应值（默认是出厂设置）。永不抛错 */
export function sanitizePrefs(raw: unknown, base: Prefs = DEFAULT_PREFS): Prefs {
  try {
    return parsePrefs(isPlainObject(raw) ? migrate(raw) : {}, base)
  } catch {
    return parsePrefs({}, base)
  }
}

function parsePrefs(o: Record<string, unknown>, base: Prefs): Prefs {
  return {
    v: PREFS_VERSION,
    theme: isTheme(o.theme) ? o.theme : base.theme,
    volume: parseVolume(o.volume, base.volume),
    // 旧版本存的 voice（语音朗读、语音、语速）不再读：v1 没有语音引导
    guidance: isGuidanceLevel(o.guidance) ? o.guidance : base.guidance,
    captionCue: bool(o.captionCue, base.captionCue),
    cueStyle: isCueStyle(o.cueStyle) ? o.cueStyle : base.cueStyle,
    cues: bool(o.cues, base.cues),
    bells: bool(o.bells, base.bells),
    intervalBell: isIntervalBell(o.intervalBell) ? o.intervalBell : base.intervalBell,
    haptics: bool(o.haptics, base.haptics),
    leadIn: intIn(o.leadIn, 0, MAX_LEAD_IN) ?? base.leadIn,
    silentEnd: bool(o.silentEnd, base.silentEnd),
    checkin: parseCheckin(o.checkin, base.checkin),
    weeklyStress: bool(o.weeklyStress, base.weeklyStress),
    stressRatings: parseRatings(o.stressRatings, base.stressRatings),
    sounds: parseSounds(o.sounds, base.sounds),
    practice: parsePracticeMap(o.practice, base.practice),
    personalRate: nullable(o.personalRate, parseRate, base.personalRate),
    onboarded: bool(o.onboarded, base.onboarded),
    safety: parseSafety(o.safety, base.safety),
    reminders: nullable(o.reminders, x => parseReminders(x, base.reminders), base.reminders),
    programs: parsePrograms(o.programs, base.programs),
  }
}

/** null 是合法值（表示没有）；缺失或不合法时用 fallback */
function nullable<T>(x: unknown, parse: (x: unknown) => T | null, fallback: T | null): T | null {
  if (x === null) return null
  return parse(x) ?? (fallback === null ? null : structuredClone(fallback))
}

const isIntervalBell = (x: unknown): x is IntervalBell => INTERVAL_BELLS.some(m => m === x)

function parseVolume(x: unknown, base: Prefs['volume']): Prefs['volume'] {
  const o = isPlainObject(x) ? x : {}
  return {
    master: intIn(o.master, 0, 100) ?? base.master,
    ambience: intIn(o.ambience, 0, 100) ?? base.ambience,
    music: intIn(o.music, 0, 100) ?? base.music,
    cues: intIn(o.cues, 0, 100) ?? base.cues,
  }
}

function parseCheckin(x: unknown, base: CheckinPrefs): CheckinPrefs {
  const o = isPlainObject(x) ? x : {}
  return { prePost: bool(o.prePost, base.prePost), feeling: bool(o.feeling, base.feeling) }
}

/** 按日期先后排好；同一天只留后记下的那次；超过上限时丢掉最早的 */
function parseRatings(x: unknown, base: readonly StressRating[]): StressRating[] {
  if (!Array.isArray(x)) return base.map(r => ({ ...r }))
  const byDate = new Map<string, StressRating>()
  for (const item of x) {
    const rating = parseRating(item)
    if (rating) byDate.set(rating.date, rating)
  }
  return [...byDate.values()]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(-MAX_STRESS_RATINGS)
}

/** 分数是测量值：超出 0–100 说明存坏了，丢掉而不是截断 */
function parseRating(x: unknown): StressRating | null {
  if (!isPlainObject(x) || !isDayKey(x.date)) return null
  const score = within(x.score, 0, 100)
  return score === null ? null : { date: x.date, score: Math.round(score * 100) / 100 }
}

function parseSounds(x: unknown, base: Prefs['sounds']): Prefs['sounds'] {
  const o = isPlainObject(x) ? x : {}
  return {
    relax: parseSoundDefault(o.relax, base.relax, 'relax'),
    sleep: parseSoundDefault(o.sleep, base.sleep, 'sleep'),
  }
}

function parseSoundDefault(x: unknown, base: SoundDefault, mode: SoundMode): SoundDefault {
  const o = isPlainObject(x) ? x : {}
  // 睡前隐藏鸟鸣（PRODUCT.md §2），声音层在睡前模式也不出鸟声：存成默认值就只剩一片安静
  const ambience =
    isAmbienceId(o.ambience) && !(mode === 'sleep' && o.ambience === 'birds') ? o.ambience : null
  return {
    ambience: ambience ?? base.ambience,
    music: isMusicId(o.music) ? o.music : base.music,
    ambienceVolume: intIn(o.ambienceVolume, 0, 100) ?? base.ambienceVolume,
    musicVolume: intIn(o.musicVolume, 0, 100) ?? base.musicVolume,
    // 模式跟着所在的键走，存坏了也不会把放松的声音当成睡前的
    mode,
  }
}

function parsePracticeMap(x: unknown, base: Prefs['practice']): Prefs['practice'] {
  if (!isPlainObject(x)) return structuredClone(base)
  const out: Prefs['practice'] = {}
  for (const [id, value] of Object.entries(x)) {
    if (!isPracticeId(id)) continue
    const prefs = sanitizePracticePrefs(value)
    if (prefs) out[id] = prefs
  }
  return out
}

/**
 * 只保护取值范围，不吸附到界面上的选项：选项以后可能调整，存下的值不该因此失效。
 * 慢呼吸的速度和个人速度一样收进 4.5–7.0（parseRate），箱式呼吸每步收进 3–6 秒
 */
export function sanitizePracticePrefs(x: unknown): PracticePrefs | null {
  if (!isPlainObject(x)) return null
  const out: PracticePrefs = {}
  const minutes = realIn(x.minutes, 0, MAX_MINUTES)
  const rate = parseRate(x.rate)
  const cycle = realIn(x.cycle, 4, 30)
  const phaseSec = realIn(x.phaseSec, BOX_PHASE_MIN_SEC, BOX_PHASE_MAX_SEC)
  const interval = realIn(x.interval, 0, 120)
  if (minutes !== null) out.minutes = minutes
  if (isAmbienceId(x.ambience)) out.ambience = x.ambience
  if (isMusicId(x.music)) out.music = x.music
  if (rate !== null) out.rate = rate
  if (x.ratio === 'equal' || x.ratio === 'long') out.ratio = x.ratio
  if (typeof x.warmup === 'boolean') out.warmup = x.warmup
  if (cycle !== null) out.cycle = cycle
  if (phaseSec !== null) out.phaseSec = phaseSec
  if (interval !== null) out.interval = interval
  return Object.keys(out).length ? out : null
}

/**
 * 引擎能排的 3–10 次/分（RATE_MIN–RATE_MAX）以外不可能是测出来或调出来的，当作坏数据，宁可让用户重测；
 * 范围内的收进慢呼吸的 4.5–7.0（SLOW_RATE_MIN–SLOW_RATE_MAX）：「有点急」最多到 7，记住的速度也不超过 7
 */
function parseRate(x: unknown): number | null {
  const n = within(x, RATE_MIN, RATE_MAX)
  return n === null ? null : realIn(n, PERSONAL_RATE.min, PERSONAL_RATE.max)
}

function parseSafety(x: unknown, base: SafetyPrefs): SafetyPrefs {
  const o = isPlainObject(x) ? x : {}
  const safety: SafetyPrefs = {
    ackOn: nullable(o.ackOn, parseAck, base.ackOn),
    screening: nullable(o.screening, parseScreening, base.screening),
    monthlyCheck: bool(o.monthlyCheck, base.monthlyCheck),
  }
  const checkedOn = optionalDay(o.monthlyCheckedOn, base.monthlyCheckedOn)
  if (checkedOn) safety.monthlyCheckedOn = checkedOn
  return safety
}

/**
 * 也接受带时刻的 ISO 时间，旧数据或其他入口可能存的是时刻。其他写法一律不认：
 * 坏数据不能让人跳过「开始之前」须知
 */
function parseAck(x: unknown): string | null {
  return isDayKey(x) || isInstant(x) ? x : null
}

/** 可以没有的日期：undefined 或 null 表示没有；存坏了时沿用 base 里的 */
function optionalDay(x: unknown, base: string | undefined): string | undefined {
  if (x === undefined || x === null) return undefined
  return isDayKey(x) ? x : base
}

/**
 * 缺了的一项按「没有」：做检查时还没有这一问（以后加了新问题）。某一项存了别的东西则整份不认：
 * 宁可让用户重做一次，也不凭坏数据把一种需要避开某些练习的情况当成没有
 */
function parseScreening(x: unknown): Screening | null {
  if (!isPlainObject(x)) return null
  const screening: Screening = {
    pregnancy: x.pregnancy === true,
    heart: x.heart === true,
    respiratory: x.respiratory === true,
    psychosis: x.psychosis === true,
    bipolar: x.bipolar === true,
    epilepsy: x.epilepsy === true,
    trauma: x.trauma === true,
    panic: x.panic === true,
  }
  const corrupted = Object.keys(screening).some(key => x[key] !== undefined && typeof x[key] !== 'boolean')
  return corrupted ? null : screening
}

/** 句子里的几项可以留空；某一项存坏了时沿用 base 里的那一项 */
function parseReminders(x: unknown, base: Reminders | null): Reminders | null {
  if (!isPlainObject(x)) return null
  const text = (value: unknown, fallback = ''): string =>
    typeof value === 'string' ? (cleanText(value, MAX_TEXT) ?? '') : fallback
  const clock = (value: unknown, fallback: string | null = null): string | null =>
    value === null || isClockTime(value) ? value : fallback
  return {
    cue: text(x.cue, base?.cue),
    action: text(x.action, base?.action),
    fallback: text(x.fallback, base?.fallback),
    weekday: clock(x.weekday, base?.weekday),
    weekend: clock(x.weekend, base?.weekend),
  }
}

/** 值为 undefined 的计划算作退出；某个计划存坏了时沿用 base 里的那份进度 */
function parsePrograms(x: unknown, base: Prefs['programs']): Prefs['programs'] {
  if (!isPlainObject(x)) return structuredClone(base)
  const out: Prefs['programs'] = {}
  for (const [id, value] of Object.entries(x)) {
    if (!isProgramId(id) || value === undefined) continue
    const progress = parseProgress(value) ?? base[id]
    if (progress) out[id] = structuredClone(progress)
  }
  return out
}

function parseProgress(x: unknown): ProgramProgress | null {
  if (!isPlainObject(x) || !isDayKey(x.startedOn)) return null
  const progress: ProgramProgress = { startedOn: x.startedOn, done: parseDone(x.done) }
  // 一天都没做完时谈不上最近完成的日期
  if (progress.done.length > 0 && isDayKey(x.lastDoneOn)) progress.lastDoneOn = x.lastDoneOn
  return progress
}

/** 完成的天去重，按周、天先后排列；认不出的键丢掉 */
function parseDone(x: unknown): string[] {
  if (!Array.isArray(x)) return []
  const days = new Map<string, number>()
  for (const item of x) {
    const day = parseProgramDay(item)
    if (day) days.set(programDayKey(day.week, day.day), programDayIndex(day))
  }
  return [...days].sort((a, b) => a[1] - b[1]).map(([key]) => key)
}

/* ---------- 存储 ---------- */

/** 从状态里只取偏好字段（去掉动作），键的顺序固定，序列化结果可以直接比较 */
export function pickPrefs(state: Prefs): Prefs {
  return {
    v: PREFS_VERSION,
    theme: state.theme,
    volume: state.volume,
    guidance: state.guidance,
    captionCue: state.captionCue,
    cueStyle: state.cueStyle,
    cues: state.cues,
    bells: state.bells,
    intervalBell: state.intervalBell,
    haptics: state.haptics,
    leadIn: state.leadIn,
    silentEnd: state.silentEnd,
    checkin: state.checkin,
    weeklyStress: state.weeklyStress,
    stressRatings: state.stressRatings,
    sounds: state.sounds,
    practice: state.practice,
    personalRate: state.personalRate,
    onboarded: state.onboarded,
    safety: state.safety,
    reminders: state.reminders,
    programs: state.programs,
  }
}

export function createPrefsStore(options: PrefsStoreOptions = {}): PrefsStore {
  const storage = options.storage === undefined ? getLocalStorage() : options.storage
  const key = options.key ?? PREFS_KEY
  const load = (): Prefs => sanitizePrefs(readJSON(storage, key))
  let saved = readText(storage, key)
  let fromOtherTab = false

  const store = createStore<PrefsState>()(setState => {
    const update = (next: (prev: Prefs) => Prefs): void =>
      setState(state => {
        const shared = share(state, next(state))
        // 没有变化时返回原状态，订阅者不会被通知
        return shared ?? state
      })
    return {
      ...load(),
      set: patch => update(prev => applyPatch(prev, patch)),
      setVolume: (bus, value) => update(prev => applyPatch(prev, { volume: { [bus]: value } })),
      setPractice: (id, patch) =>
        update(prev => {
          const merged = sanitizePracticePrefs({ ...prev.practice[id], ...patch })
          const practice = { ...prev.practice }
          if (merged) practice[id] = merged
          else delete practice[id]
          return { ...prev, practice }
        }),
      addStressRating: (score, on = new Date()) => update(prev => withRating(prev, score, on)),
      startProgram: (id, on = new Date()) =>
        update(prev => {
          const startedOn = dayOf(on)
          if (!startedOn) return prev
          return applyPatch(prev, { programs: { ...prev.programs, [id]: { startedOn, done: [] } } })
        }),
      completeProgramDay: (id, day, on = new Date()) => update(prev => withProgramDay(prev, id, day, on)),
      leaveProgram: id =>
        update(prev => applyPatch(prev, { programs: { ...prev.programs, [id]: undefined } })),
      reset: () => update(() => sanitizePrefs(undefined)),
      resetSettings: () =>
        update(prev => ({
          ...sanitizePrefs(undefined),
          personalRate: prev.personalRate,
          onboarded: prev.onboarded,
          // 每月自查是一个开关，属于设置；须知和健康情况检查是用户的回答，保留
          safety: { ...prev.safety, monthlyCheck: DEFAULT_PREFS.safety.monthlyCheck },
          stressRatings: prev.stressRatings,
          reminders: prev.reminders,
          programs: prev.programs,
        })),
    }
  })

  store.subscribe(state => {
    // 其他标签页写入的值已经在存储里了，再写一遍只会来回触发 storage 事件
    if (fromOtherTab) return
    const text = JSON.stringify(pickPrefs(state))
    if (text === saved) return
    // 写不进去（隐私模式、空间满）时本次会话照常使用，只是下次打开不会记得
    if (writeText(storage, key, text)) saved = text
  })

  const onStorage = (event: StorageEvent): void => {
    // key 为 null 表示其他标签页清空了整个 localStorage
    if (event.key !== null && event.key !== key) return
    const next = load()
    saved = readText(storage, key)
    fromOtherTab = true
    try {
      store.setState(state => share(state, next) ?? state)
    } finally {
      fromOtherTab = false
    }
  }
  const win = typeof window === 'undefined' ? null : window
  win?.addEventListener('storage', onStorage)

  return { ...store, destroy: () => win?.removeEventListener('storage', onStorage) }
}

function applyPatch(prev: Prefs, patch: PrefsPatch): Prefs {
  const { volume, checkin, safety, sounds, ...rest } = patch
  return sanitizePrefs(
    {
      ...prev,
      ...rest,
      volume: { ...prev.volume, ...volume },
      checkin: { ...prev.checkin, ...checkin },
      safety: { ...prev.safety, ...safety },
      sounds: {
        relax: { ...prev.sounds.relax, ...sounds?.relax },
        sleep: { ...prev.sounds.sleep, ...sounds?.sleep },
      },
    },
    prev,
  )
}

/** 先单独校验这一次，不合法时什么也不做：不能先删掉那天原有的分数，再因为新分数无效而什么也没记上 */
function withRating(prev: Prefs, score: number, on: Date | string): Prefs {
  const rating = parseRating({ date: dayOf(on), score })
  if (!rating) return prev
  const others = prev.stressRatings.filter(r => r.date !== rating.date)
  return applyPatch(prev, { stressRatings: [...others, rating] })
}

function withProgramDay(prev: Prefs, id: ProgramId, day: string, on: Date | string): Prefs {
  const doneOn = dayOf(on)
  if (!doneOn || !parseProgramDay(day)) return prev
  const progress = prev.programs[id] ?? { startedOn: doneOn, done: [] }
  if (progress.done.includes(day)) return prev
  // 补记以前的某一天时，最近完成的日期不往回退
  const last = progress.lastDoneOn
  const lastDoneOn = last !== undefined && last > doneOn ? last : doneOn
  const next: ProgramProgress = { ...progress, done: [...progress.done, day], lastDoneOn }
  return applyPatch(prev, { programs: { ...prev.programs, [id]: next } })
}

/** 本地日期键；无效的日期为 null */
function dayOf(on: Date | string): string | null {
  if (typeof on === 'string') return isDayKey(on) ? on : null
  return Number.isNaN(on.getTime()) ? null : dayKey(on)
}

/**
 * 与当前状态比较：完全相同时返回 null；否则沿用没变的嵌套对象，
 * 只选取了 volume 之类子对象的组件就不会因为无关的修改而重新渲染。
 */
function share(prev: Prefs, next: Prefs): Prefs | null {
  const clean = pickPrefs(next)
  if (JSON.stringify(pickPrefs(prev)) === JSON.stringify(clean)) return null
  return {
    ...clean,
    volume: same(prev.volume, clean.volume),
    checkin: same(prev.checkin, clean.checkin),
    stressRatings: same(prev.stressRatings, clean.stressRatings),
    sounds: same(prev.sounds, clean.sounds),
    practice: same(prev.practice, clean.practice),
    safety: same(prev.safety, clean.safety),
    reminders: same(prev.reminders, clean.reminders),
    programs: same(prev.programs, clean.programs),
  }
}

const same = <T>(a: T, b: T): T => (JSON.stringify(a) === JSON.stringify(b) ? a : b)

/* ---------- 共用的实例 ---------- */

/** 全应用共用的偏好；模块加载时同步读出，首屏就能用上主题 */
export const prefsStore: PrefsStore = createPrefsStore()

export const getPrefs = (): Prefs => prefsStore.getState()

/* ---------- 工具 ---------- */

function deepFreeze<T extends object>(x: T): T {
  for (const value of Object.values(x)) {
    if (typeof value === 'object' && value !== null) deepFreeze(value)
  }
  return Object.freeze(x)
}
