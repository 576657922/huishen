/**
 * 今日页的规则（PRODUCT.md §4）：主推荐与「换一个」、「只有几分钟」、「现在有点难」、欢迎回来、日期行。
 * 全是纯函数，「现在」由调用方传入：同一屏基于同一时刻，测试也不用改系统时间。界面上的字都在 copy.ts。
 *
 * 取舍与依据：
 * - 按时段推荐是我们的安排，不是研究结论：练习时间对效果有没有影响，没有找到研究（meditation.notes §7）。
 *   时长只取默认值或更短：经常练比每次练很久重要（meditation-strohmaier-2020、meditation-bowles-2025）。
 * - 有计划时先给计划的这一天。进度只看完成了哪几天，不看日历：漏了几天，打开仍是下一天，
 *   不重排、不补练、不提落后（PRODUCT.md §3；ux-lally-2010、ux-silverman-2023）。
 * - 距上次练习满 3 天，先给一个 1 分钟的练习，只说「欢迎回来」，不数隔了几天（ux-buyalskaya-2023）。
 * - 健康情况检查的规则都来自 practices.ts，这里只照用（见 rulesFor）：隐藏的（isHidden）和不推荐的（isDiscouraged）
 *   都不出现；时长被调短的不超过调短后的默认；节拍被调整的带上调整后的节拍。
 * - v1 不提供的练习（practices.ts 的 V1_UNAVAILABLE：正念行走、睡前身体扫描）哪里都不推荐，规则同样在 rulesFor 里。
 *   时段的列表里原来放它们的位置，换成了 v1 能练的练习（见 TIME_SLOTS）。
 * - 开放觉察不进按时段的推荐：新手先练有固定对象的练习（safety.notes §2），八周计划第 5 周起才安排。
 *   箱式呼吸也不进：练完做事反而不如延长呼气（breathing-rottger-2021），安全检查还常把它隐藏。
 * - 深夜不推荐自我关怀：它要人一个人在床上想起烦心事，勾起的旧难过最难消化，也容易转成反复想 [J]。
 *   另有一条线索：一项 42 人的试验里，冥想组 8 周后睡得反而更差，他们晚上 8 点以后练的比例也更高
 *   （meditation-basso-2019，证据很低）。
 */
import { type DayPart, dayKey, dayPart, daysBetween, fmtDate, parseDayKey } from '@/lib/date'
import { termLabel } from '@/lib/solar-terms'
import { TODAY } from './copy'
import {
  adjustedDefaults,
  copingOptions,
  isCatalogPracticeId,
  isDiscouraged,
  isHidden,
  isOffered,
  PRACTICE_BY_ID,
  type PracticeLaunch,
  type ScreeningAnswers,
} from './practices'
import { breathing4wProgram } from './programs/breathing-4w'
import { mindfulness8wProgram } from './programs/mindfulness-8w'
import type { PacedParams, PracticeId, Program, ProgramId, ProgramItem, ProgramWeek } from './types'

/** 距上次练习满这么多天，第一行改说「欢迎回来」。与 data/stats.ts 的同名常量相同（内容层不依赖数据层） */
export const WELCOME_BACK_DAYS = 3

/**
 * 可选练习不少于这么多分钟才算完成一天（mindfulness-8w.ts 文件头的约定）。
 * 主练习被隐藏时也只让够时长的练习顶替，免得 3 分钟的可选练习被当成「这一天」
 */
const DAY_MIN_MINUTES = 5

const DAYS_PER_WEEK = 7

const PROGRAMS: Readonly<Record<ProgramId, Program>> = {
  'mindfulness-8w': mindfulness8wProgram,
  'breathing-4w': breathing4wProgram,
}

/* ---------- 类型 ---------- */

/** 一项练习和时长（分钟） */
export interface PracticeChoice {
  practiceId: PracticeId
  minutes: number
}

/**
 * 覆盖练习默认参数，与 ProgramItem.params、记录里的 params 同形：如四周呼吸的 { rate: 6.5 }，
 * 轻而慢的慢呼吸 { rate: 6, ratio: 'long' }。rate 为 'personal' 时由应用换成存下的个人速度
 */
export type PickParams = Readonly<Record<string, number | string>>

/** 这一项在计划里的角色：day 为这一天要做的，short 为保底日的短版，extra 为可选练习 */
export type ProgramRole = 'day' | 'short' | 'extra'

/** 今日页上的一项推荐 */
export interface TodayPick extends PracticeChoice {
  params?: PickParams
  /** 练习名上方的一行：「晚上」「八周正念 · 第 3 周第 2 天」「欢迎回来。先做 1 分钟？」 */
  reason: string
  /**
   * 来自计划时才有。day 为这一天的键，如 'w3d2'；countsAsDay 为 true 的，练完后把 day 交给 data 层的
   * completeProgramDay。主练习和保底日都算完成这一天，可选练习不少于 5 分钟才算（mindfulness-8w.ts 文件头）
   */
  plan?: { programId: ProgramId; day: string; role: ProgramRole; countsAsDay: boolean }
}

/**
 * 进行中的计划。done、lastDoneOn 与 data/types.ts 的 ProgramProgress 同形，
 * 可以直接传 { programId, ...prefs.programs[programId] }
 */
export interface ProgramState {
  programId: ProgramId
  /** 完成了的天，如 'w3d2'；顺序不限，不认识的键忽略 */
  done: readonly string[]
  /** 最近完成一天的本地日期 YYYY-MM-DD。今天已经完成一天时，主推荐回到按时段，不接着推下一天 */
  lastDoneOn?: string | null
}

export interface RecommendInput {
  now: Date
  /** 进行中的计划；没有为 null */
  program: ProgramState | null
  /** 最近一次练习：记录里的 date（YYYY-MM-DD，与 data/stats.ts 同口径）、ISO 时间或 Date；从没练过为 null */
  lastPracticeAt: Date | string | null
  /** 健康情况检查的回答（data/types.ts 的 Screening 可以直接传）；没做过为 null */
  screening: ScreeningAnswers | null
}

/** 计划里接下来要练的那一天 */
export interface ProgramDay {
  programId: ProgramId
  /** 计划名，如「八周正念」 */
  title: string
  /** 'w3d2'：第 3 周第 2 天 */
  key: string
  /** 第几周、这一周的第几天，都从 1 开始 */
  week: number
  day: number
  /** 从计划开始数的第几天，从 1 开始 */
  dayNumber: number
  totalDays: number
  weekTitle: string
  /** 这一天的提示 */
  tip: string
  /** 一周的第一天：界面先请用户读本周说明 */
  firstDayOfWeek: boolean
  /** 今天已经完成了一天，这里给的是下一次的那一天 */
  doneToday: boolean
}

/** 主推荐从哪里来：计划、欢迎回来、按时段 */
export type RecommendSource = 'program' | 'welcome-back' | 'time'

export interface Recommendation extends TodayPick {
  source: RecommendSource
  slot: DayPart
  /** 「换一个」依次给出的练习：不含主推荐，同一练习同一时长只出现一次，没有不该推荐的练习 */
  alternatives: TodayPick[]
  /** 进行中的计划接下来那一天；没有计划或已经全部练完时为 null */
  programDay: ProgramDay | null
}

const choice = (practiceId: PracticeId, minutes: number): PracticeChoice => ({ practiceId, minutes })

/* ---------- 时段 ---------- */

/**
 * 各时段的推荐：第一项是主推荐（PRODUCT.md §4），其余依次给「换一个」。
 * 「换一个」换的是做法（呼吸、身体、善意、声音），而不是同一项练习换个时长；时长都不超过练习的默认时长。
 * v1 不提供正念行走和睡前身体扫描（practices.ts 的 V1_UNAVAILABLE），白天原来给正念行走的位置换成 5 分钟的身体扫描，
 * 夜里换成静坐计时；有了真人录音、重新提供时再放回来。即使写进列表，rulesFor 也会挡住
 */
export const TIME_SLOTS: Readonly<Record<DayPart, readonly PracticeChoice[]>> = {
  // 早上 5–11 点
  morning: [
    choice('focus', 10),
    choice('slow', 5),
    choice('breath-count', 10),
    choice('body-scan', 5),
    choice('loving-kindness', 10),
  ],
  // 午间 11–14 点：短一些，坐在工位上也能做
  midday: [
    choice('slow', 5),
    choice('breathing-space', 3),
    choice('cyclic-sigh', 5),
    choice('body-scan', 5),
    choice('focus', 5),
  ],
  // 下午 14–18 点
  afternoon: [
    choice('breath-count', 10),
    choice('focus', 10),
    choice('slow', 5),
    choice('breathing-space', 3),
    choice('body-scan', 5),
  ],
  // 晚上 18–22 点
  evening: [
    choice('body-scan', 10),
    choice('slow', 5),
    choice('loving-kindness', 10),
    choice('self-compassion', 5),
    choice('listen', 20),
  ],
  // 深夜 22–5 点：躺下就能做、不用一直看着屏幕的；睡前声音用默认的 45 分钟。
  // 静坐计时只有钟声，闭着眼也能做。不放自我关怀（见文件头）
  night: [choice('sleep', 45), choice('slow', 5), choice('listen', 20), choice('timer', 5)],
}

/** 欢迎回来时先给的 1 分钟练习，取第一个可以推荐的 */
const WELCOME_CHOICES: readonly PracticeChoice[] = [
  choice('pause', 1),
  choice('cyclic-sigh', 1),
  choice('timer', 1),
]

/* ---------- 健康情况检查 ---------- */

interface Rules {
  /** 可以推荐：v1 提供（在目录里，不在 V1_UNAVAILABLE 里），没被隐藏、不是不推荐的，也不是这个人不该做的周期性叹息 */
  allows(id: PracticeId): boolean
  /** 推荐的时长 */
  minutes(id: PracticeId, minutes: number): number
  /** 健康情况检查改了这项练习的节拍时（惊恐发作时的慢呼吸），推荐带上改后的节拍；没改时为 undefined */
  params(id: PracticeId): PickParams | undefined
  /** 周期性叹息不推荐时，代替它的轻而慢的慢呼吸；不需要代替时为 null */
  light: PracticeLaunch | null
}

/**
 * 健康情况检查对这一页的影响。规则都来自 practices.ts，这里不另立：
 * - v1 不提供的练习（isOffered 为 false）、隐藏的练习（isHidden）在这一页哪里都不出现；不推荐的（isDiscouraged，
 *   如常有创伤闪回时的开放觉察）也不出现，计划里由这一周的可选练习顶替；不在目录里的旧 id 也不推荐。
 * - 「现在有点难」不给周期性叹息时（惊恐发作，以及癫痫、怀孕、心脑血管或肺部疾病，见 copingOptions），
 *   这一页也不推荐它：目录对这几种情况都提示「更建议先做轻柔的慢呼吸」，同一页的两个面板也不该互相矛盾。
 * - 时长被调短时（有创伤经历、幻觉妄想或双相，adjustedDefaults 的 shortened），推荐和计划都不超过调短后的默认。
 * - 节拍被调整时（惊恐发作时慢呼吸改为每分钟 6 次），主推荐和两个快捷面板带同样的节拍。
 */
function rulesFor(screening: ScreeningAnswers | null): Rules {
  const coping = copingOptions(screening)
  const sighOk = coping.some(o => o.id === 'cyclic-sigh')
  return {
    allows: id =>
      isOffered(id) &&
      !isHidden(id, screening) &&
      !isDiscouraged(id, screening) &&
      (sighOk || id !== 'cyclic-sigh'),
    minutes: (id, minutes) => {
      if (!isCatalogPracticeId(id)) return minutes
      const adjusted = adjustedDefaults(id, screening)
      const m = adjusted.shortened ? Math.min(minutes, adjusted.defaultMinutes) : minutes
      return adjusted.durations.includes(m) ? m : adjusted.defaultMinutes
    },
    params: id => {
      if (!isCatalogPracticeId(id)) return undefined
      const { paced } = adjustedDefaults(id, screening)
      return paced && paced !== PRACTICE_BY_ID[id].paced ? pacedParams(paced) : undefined
    },
    light: sighOk ? null : (coping.find(o => o.id === 'slow') ?? null),
  }
}

/** 节拍参数写成 params 的形状，与记录里的 params 一致 */
function pacedParams(p: PacedParams): PickParams {
  switch (p.type) {
    case 'resonance':
      return { rate: p.rate, ratio: p.ratio }
    case 'sigh':
      return { cycle: p.cycle }
    case 'phases':
      return { inhale: p.inhale, holdIn: p.holdIn, exhale: p.exhale, holdOut: p.holdOut }
  }
}

/** 按规则写成一项推荐；不能推荐时为 null */
function toPick(rules: Rules, c: PracticeChoice, reason: string): TodayPick | null {
  if (!rules.allows(c.practiceId)) return null
  const params = rules.params(c.practiceId)
  return {
    practiceId: c.practiceId,
    minutes: rules.minutes(c.practiceId, c.minutes),
    ...(params ? { params } : {}),
    reason,
  }
}

const keyOf = (p: PracticeChoice): string => `${p.practiceId}:${p.minutes}`

/**
 * 同一练习、同一时长只留一项，留在先出现的位置；其中有来自计划的，用计划那一项（带着计划的参数和这一天的键）
 */
function distinct(picks: readonly TodayPick[]): TodayPick[] {
  const out: TodayPick[] = []
  const at = new Map<string, number>()
  for (const p of picks) {
    const i = at.get(keyOf(p))
    if (i === undefined) {
      at.set(keyOf(p), out.length)
      out.push(p)
    } else if (!out[i]?.plan && p.plan) {
      out[i] = p
    }
  }
  return out
}

/* ---------- 主推荐 ---------- */

/**
 * 今日页的主推荐和「换一个」的顺序：欢迎回来的 1 分钟 → 计划的这一天（保底日、可选练习）→ 当前时段的练习。
 * 这一天的主练习被隐藏、又没有够时长的练习能顶替时，计划里剩下的练习排到时段推荐后面
 */
export function recommend(input: RecommendInput): Recommendation {
  const { now } = input
  const rules = rulesFor(input.screening)
  const slot = dayPart(now)
  const day = input.program ? programDay(input.program, now) : null
  const planned = day && !day.doneToday ? programPicks(day, rules) : []
  const timed = TIME_SLOTS[slot].flatMap(c => toPick(rules, c, TODAY.slots[slot]) ?? [])
  const hasDay = planned.some(p => p.plan?.role === 'day')
  const list = distinct(hasDay ? [...planned, ...timed] : [...timed, ...planned])

  if (welcomeBack(input.lastPracticeAt, now)) {
    const back = WELCOME_CHOICES.map(c => toPick(rules, c, TODAY.welcomeBack)).find(p => p !== null)
    if (back) {
      const alternatives = list.filter(p => keyOf(p) !== keyOf(back))
      return { ...back, source: 'welcome-back', slot, alternatives, programDay: day }
    }
  }

  // 每个时段都有健康情况检查隐藏不了的练习（测试逐一核对过），这个后备实际用不到
  const [first = { ...choice('pause', 1), reason: TODAY.slots[slot] }, ...alternatives] = list
  return { ...first, source: first.plan ? 'program' : 'time', slot, alternatives, programDay: day }
}

/* ---------- 计划 ---------- */

const dayKeyOf = (week: number, day: number): string => `w${week}d${day}`

/**
 * 计划接下来的那一天：按周、天的先后，第一个还没完成的（与 data/program.ts 的 nextProgramDay 相同）。
 * 漏了几天不影响；全部练完或计划不存在时为 null
 */
export function programDay(state: ProgramState, now: Date): ProgramDay | null {
  const program: Program | undefined = PROGRAMS[state.programId]
  if (!program) return null
  const done = new Set(state.done)
  const totalDays = program.weeks.length * DAYS_PER_WEEK
  for (let i = 0; i < totalDays; i++) {
    const week = Math.floor(i / DAYS_PER_WEEK) + 1
    const day = (i % DAYS_PER_WEEK) + 1
    const key = dayKeyOf(week, day)
    if (done.has(key)) continue
    const w = program.weeks.find(x => x.week === week)
    if (!w) return null
    return {
      programId: program.id,
      title: program.title,
      key,
      week,
      day,
      dayNumber: i + 1,
      totalDays,
      weekTitle: w.title,
      tip: w.tips[day - 1] ?? '',
      firstDayOfWeek: day === 1,
      doneToday: done.size > 0 && state.lastDoneOn === dayKey(now),
    }
  }
  return null
}

interface Planned {
  item: ProgramItem
  role: ProgramRole
}

const planned = (item: ProgramItem, role: ProgramRole): Planned => ({ item, role })

/** 这一天计划里的各项，按推荐的顺序 */
function plannedItems(week: ProgramWeek, day: number): Planned[] {
  const extra = week.extra ?? []
  const short = week.short ? [week.short] : []
  // 四周呼吸第 4 周第 1 天：先做舒适节律探索，之后只做 3 分钟短版，免得连着练近 17 分钟（breathing-4w.ts）
  const finder = day === 1 ? extra.find(x => x.practiceId === 'pace-finder') : undefined
  if (finder) {
    return [
      planned(finder, 'day'),
      ...short.map(x => planned(x, 'day')),
      planned(week.daily, 'day'),
      ...extra.filter(x => x !== finder).map(x => planned(x, 'extra')),
    ]
  }
  return [
    planned(week.daily, 'day'),
    ...short.map(x => planned(x, 'short')),
    ...extra.map(x => planned(x, 'extra')),
  ]
}

function programPicks(day: ProgramDay, rules: Rules): TodayPick[] {
  const program = PROGRAMS[day.programId]
  const week = program.weeks.find(w => w.week === day.week)
  if (!week) return []
  const items = plannedItems(week, day.day).filter(x => rules.allows(x.item.practiceId))
  // 主练习被隐藏或不推荐时（如有幻觉妄想、双相，或常有创伤闪回时的开放觉察），由这一周第一项够时长的练习顶替这一天。
  // 八周正念第 5 周的可选练习里放了专注呼吸，就是给这种情况的
  if (!items.some(x => x.role === 'day')) {
    const i = items.findIndex(x => x.item.minutes >= DAY_MIN_MINUTES)
    const sub = i < 0 ? undefined : items.splice(i, 1)[0]
    if (sub) items.unshift(planned(sub.item, 'day'))
  }
  const reason: Record<ProgramRole, string> = {
    day: TODAY.program.day(program.title, day.week, day.day),
    short: TODAY.program.short(program.title),
    extra: TODAY.program.extra(program.title),
  }
  return items.map(({ item, role }) => {
    const minutes = rules.minutes(item.practiceId, item.minutes)
    // 计划自己的参数优先（四周呼吸每周的速度），健康情况调整的节拍补上其余的项（如呼长吸短）。
    // 复制一份，界面改参数时不会改到计划本身
    const adjusted = rules.params(item.practiceId)
    const params = adjusted || item.params ? { ...adjusted, ...item.params } : undefined
    return {
      practiceId: item.practiceId,
      minutes,
      ...(params ? { params } : {}),
      reason: reason[role],
      plan: {
        programId: program.id,
        day: day.key,
        role,
        countsAsDay: role !== 'extra' || minutes >= DAY_MIN_MINUTES,
      },
    }
  })
}

/* ---------- 欢迎回来 ---------- */

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/**
 * 距上次练习是否已满 WELCOME_BACK_DAYS 天（按本地日历日算，与 data/stats.ts 一致）。
 * 只给是或否：界面上绝不出现「已经 X 天没练习」。从没练过、时间无效或在将来时为 false
 */
export function welcomeBack(lastPracticeAt: Date | string | null, now: Date): boolean {
  const last = toDate(lastPracticeAt)
  return last !== null && daysBetween(last, now) >= WELCOME_BACK_DAYS
}

function toDate(x: Date | string | null): Date | null {
  if (x === null) return null
  // 日期键按本地零点解析：new Date('2026-10-20') 会当成 UTC 零点，在西半球会退到前一天
  const d = typeof x === 'string' ? (DAY_KEY.test(x) ? parseDayKey(x) : new Date(x)) : x
  return Number.isNaN(d.getTime()) ? null : d
}

/* ---------- 日期行 ---------- */

/** 「10月22日 星期四 · 霜降前一日」；不在节气当天或前一天时只有日期 */
export function dateLine(now: Date): string {
  const term = termLabel(now)
  return term ? `${fmtDate(now)} · ${term}` : fmtDate(now)
}

/* ---------- 快捷面板 ---------- */

/** 「只有几分钟」「现在有点难」里的一项练习 */
export interface Shortcut extends PracticeChoice {
  params?: PickParams
  label: string
  /** 显示的时长，如「1 分钟」「60 秒」 */
  duration: string
  hint: string
}

interface ShortcutCopy {
  label: string
  hint: string
  /** 不写时按分钟数显示 */
  duration?: string
}

/** 「只有几分钟」的文字多一行结构 */
interface QuickCopy extends ShortcutCopy {
  structure: string
}

/**
 * 「只有几分钟」里的一项（DESIGN.md §13.2）：行里显示 structure，如「停 · 吸 · 观 · 行」；
 * 长一点的 hint 给读屏（aria-describedby）
 */
export interface QuickPick extends Shortcut {
  structure: string
}

function shortcut(
  practiceId: PracticeId,
  minutes: number,
  copy: ShortcutCopy,
  params?: PickParams,
): Shortcut {
  return {
    practiceId,
    minutes,
    ...(params ? { params } : {}),
    label: copy.label,
    duration: copy.duration ?? TODAY.minutes(minutes),
    hint: copy.hint,
  }
}

/** 「只有几分钟」（PRODUCT.md §4.3） */
const QUICK: readonly (PracticeChoice & { copy: QuickCopy })[] = [
  { ...choice('pause', 1), copy: TODAY.quick.pause },
  { ...choice('breathing-space', 3), copy: TODAY.quick.breathingSpace },
  { ...choice('cyclic-sigh', 5), copy: TODAY.quick.cyclicSigh },
]

/**
 * 按健康情况检查调整后的「只有几分钟」：不推荐周期性叹息时，换成同样时长的轻而慢的慢呼吸，
 * 与「现在有点难」的换法一致（practices.ts 的 copingOptions）
 */
export function quickPicks(screening: ScreeningAnswers | null): QuickPick[] {
  const rules = rulesFor(screening)
  const quick = (
    practiceId: PracticeId,
    minutes: number,
    copy: QuickCopy,
    params?: PickParams,
  ): QuickPick => ({
    ...shortcut(practiceId, minutes, copy, params),
    structure: copy.structure,
  })
  return QUICK.flatMap(({ practiceId, minutes, copy }): QuickPick[] => {
    if (rules.allows(practiceId)) {
      return [quick(practiceId, rules.minutes(practiceId, minutes), copy, rules.params(practiceId))]
    }
    if (practiceId === 'cyclic-sigh' && rules.light && rules.allows('slow')) {
      const params = rules.light.paced ? pacedParams(rules.light.paced) : undefined
      return [quick('slow', rules.minutes('slow', minutes), TODAY.quick.lightSlow, params)]
    }
    return []
  })
}

/** 「只有几分钟」：一分钟停一停、三分钟呼吸空间、周期性叹息 5 分钟 */
export const QUICK_PICKS: readonly QuickPick[] = quickPicks(null)

export type HardMomentItem =
  | ({ kind: 'practice' } & Shortcut)
  | { kind: 'link'; to: '/help'; label: string; hint: string }

export interface HardMomentPanel {
  title: string
  /**
   * 今日页上「现在有点难」那一行的提示：面板里的呼吸练习和落地练习（按面板里的顺序），再加「求助电话」。
   * 默认就是 TODAY.hard.rowHint：「周期性叹息 · 落地练习 · 求助电话」
   */
  rowHint: string
  intro: string
  items: readonly HardMomentItem[]
}

/** 「现在有点难」里各项的文字；copingOptions 以后换了别的练习，就用目录里的名字和一句话说明 */
const HARD_COPY: Partial<Record<PracticeId, ShortcutCopy>> = {
  'cyclic-sigh': TODAY.hard.sigh,
  slow: TODAY.hard.lightSlow,
  'breathing-space-coping': TODAY.hard.coping,
  grounding: TODAY.hard.grounding,
}

/**
 * 「现在有点难」（PRODUCT.md §4.4）：练习和顺序由 practices.ts 的 copingOptions 决定（有惊恐发作等情况时，
 * 周期性叹息换成轻而慢的慢呼吸），最后是求助方式，离线可用、始终保留。
 * 应对版和落地练习的引导词在任何档位都完整地说，难受时不会遇到长时间的安静
 */
export function hardMoment(screening: ScreeningAnswers | null): HardMomentPanel {
  const practices = copingOptions(screening)
    .filter(o => isOffered(o.id) && !isHidden(o.id, screening))
    .map((o): HardMomentItem => {
      const p = PRACTICE_BY_ID[o.id]
      const copy = HARD_COPY[o.id] ?? { label: p.name, hint: p.short }
      return {
        kind: 'practice',
        ...shortcut(o.id, o.minutes, copy, o.paced ? pacedParams(o.paced) : undefined),
      }
    })
  // 应对版的名字太长，一行放不下，提示里不列它
  const named = practices.flatMap(i =>
    i.kind === 'practice' && i.practiceId !== 'breathing-space-coping' ? [i.label] : [],
  )
  return {
    title: TODAY.hard.title,
    rowHint: [...named, TODAY.hard.phones].join(' · '),
    intro: TODAY.hard.intro,
    items: [...practices, { kind: 'link', to: '/help', ...TODAY.hard.help }],
  }
}

/** 「现在有点难」：周期性叹息 1 分钟、三分钟呼吸空间 · 应对版、落地练习 60 秒、求助方式 */
export const HARD_MOMENT: HardMomentPanel = hardMoment(null)
