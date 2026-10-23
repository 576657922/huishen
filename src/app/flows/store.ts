/**
 * 这一次练习的上下文：从哪里开始、用的什么计划、练习前的自评，结束后小结要显示和要问的东西。
 * 会话控制器只管练习本身；播放器、小结、练习前自评的面板和更新提示都读这里。React 之外也能读写（Zustand vanilla）。
 */
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { CatalogPracticeId } from '@/content/practices'
import type { TodayPick } from '@/content/today'
import type { Feeling, SessionRecord } from '@/data'
import type { SessionPlan, SessionResult } from '@/engine'
import type { AfterQuestions, PlanOverrides } from '../plan'

/** 从哪里开始的：决定练习前要不要自评、练完怎么问，也写进记录的 params */
export type StartSource =
  | 'today'
  | 'catalogue'
  | 'program'
  | 'hard-moment'
  | 'distress'
  | 'summary'
  | 'welcome'
  | 'player'
  | 'pace-finder'

/** 计划里的一天：今日页的 TodayPick.plan，计划页照同样的形状给 */
export type ProgramDayRef = NonNullable<TodayPick['plan']>

export interface StartOptions {
  practiceId: CatalogPracticeId
  /** 不填时用 defaultMinutes()：上次选的，否则按健康情况检查调整后的默认 */
  minutes?: number
  overrides?: PlanOverrides
  from: StartSource
  /** 来自计划时才有；练完（completed）且记下了，就把这一天记为完成 */
  programDay?: ProgramDayRef
}

/**
 * idle：没有练习；checkin：练习前自评的面板开着；playing：练习中（倒数、进行、暂停）；
 * ending：刚结束，播放器停留片刻；summary：小结
 */
export type SessionPhase = 'idle' | 'checkin' | 'playing' | 'ending' | 'summary'

/** 小结里已经回答的 */
export interface SummaryAnswers {
  /** null 为跳过 */
  feeling?: Feeling | null
  post?: number | null
  note?: string
}

export interface SessionSummary {
  result: SessionResult
  /** 存下的记录；不足 1 分钟时为 null，小结只显示「不记录」和「完成」 */
  record: SessionRecord | null
  /** 小结里问什么（已按睡前、「不舒服？」之后、练习前有没有问过调整好） */
  questions: AfterQuestions
  answers: SummaryAnswers
  /** 最近 3 次记下的练完感觉里至少 2 次更紧张或很不舒服（含这一次）：显示更温和的练法 */
  gentler: boolean
  /** 计划里因此完成的一天 */
  programDayDone: ProgramDayRef | null
  /** 「有点急」之后记住的慢呼吸速度 */
  rememberedRate: number | null
}

export interface PendingSession {
  phase: SessionPhase
  /** 正在进行或刚结束的这一次 */
  start: StartOptions | null
  plan: SessionPlan | null
  /** 开始练习时所在的页面；倒数里就结束时回到这里 */
  origin: string
  /** 练习前的自评 0–10；跳过或没问时为 null */
  pre: number | null
  /** 这一次问过练习前自评（回答或跳过都算）：练习后才问，免得记录里只有一半 */
  preAsked: boolean
  /** 在「不舒服？」里结束的：小结只问练完感觉 */
  endedFromDistress: boolean
  summary: SessionSummary | null
  /** 首次使用时被「开始之前」拦下的那次开始；/welcome 确认后接着开始 */
  gated: StartOptions | null
  /**
   * 暂停之后先倒数再接着练（resumeAfterLeadIn）：恢复的时刻，performance.now() 的毫秒数；没有在倒数时为 null。
   * 倒数期间练习仍是暂停的，播放器照倒数的样子显示（useResumeCountdown）
   */
  resumeAt: number | null
}

export const INITIAL_SESSION: PendingSession = Object.freeze({
  phase: 'idle',
  start: null,
  plan: null,
  origin: '/',
  pre: null,
  preAsked: false,
  endedFromDistress: false,
  summary: null,
  gated: null,
  resumeAt: null,
})

export const sessionStore = createStore<PendingSession>(() => ({ ...INITIAL_SESSION }))

const selectAll = (s: PendingSession): PendingSession => s

/** 读这一次练习的上下文。选择器请返回状态里已有的值，不要每次新建对象 */
export function usePendingSession(): PendingSession
export function usePendingSession<T>(selector: (s: PendingSession) => T): T
export function usePendingSession(selector: (s: PendingSession) => unknown = selectAll): unknown {
  return useStore(sessionStore, selector)
}
