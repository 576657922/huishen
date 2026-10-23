/**
 * 开始一次练习。必须在点击（或按键）处理里同步调用：会话控制器的 start() 会同步地解锁声音，
 * 浏览器只在用户手势里允许 AudioContext 出声。
 */
import { prefsStore } from '@/data'
import { dayKey } from '@/lib/date'
import { currentPath, navigate } from '../navigation'
import { afterQuestions, buildPlan, defaultMinutes, isOffered } from '../plan'
import { getAudio, getController } from '../services'
import { latestRecords, unwellJustBefore } from './records'
import { INITIAL_SESSION, type StartOptions, type StartSource, sessionStore } from './store'

/**
 * started：已开始并去了播放器；gated：首次使用，先去 /welcome 读「开始之前」；checkin：练习前自评的面板打开了；
 * busy：正在练习；unavailable：v1 不提供这项练习（plan.ts 的 isOffered）
 */
export type StartOutcome = 'started' | 'gated' | 'checkin' | 'busy' | 'unavailable'

/** 练习前自评点了分数之后，过 300 ms 再进播放器，让人看见自己选中的格子（DESIGN.md §13.5.13） */
export const CHECKIN_SEEN_MS = 300

/** 从这些地方开始的人正难受，或者是在做测试：直接给练习，不先填表（DESIGN.md §13.5.13） */
const NO_PRE_CHECKIN: ReadonlySet<StartSource> = new Set<StartSource>([
  'hard-moment',
  'distress',
  'pace-finder',
])

const PLAYER_PREFIX = '/play/'

/**
 * 开始一项练习：首次使用先读「开始之前」→ 需要时先问练习前自评 → 排计划 → 会话开始 → 进播放器。
 * 舒适节律探索留在自己的页面上跑，不进播放器
 */
export function startPractice(opts: StartOptions): StartOutcome {
  if (!isOffered(opts.practiceId)) return 'unavailable'
  const status = getController().getState().status
  if (status === 'lead' || status === 'running' || status === 'paused') return 'busy'
  if (!prefsStore.getState().safety.ackOn) {
    sessionStore.setState({ gated: opts, origin: currentPath() })
    navigate('/welcome')
    return 'gated'
  }
  if (needsPreCheckin(opts)) {
    sessionStore.setState({ ...INITIAL_SESSION, phase: 'checkin', start: opts })
    return 'checkin'
  }
  launch(opts, null, false)
  return 'started'
}

/**
 * 这次开始前要不要问「此刻有多紧张？」：设置里开着，而且不是睡前、测试、难受时的出口，
 * 今天上一次练完也没有选「很不舒服」
 */
export function needsPreCheckin(opts: StartOptions, now: Date = new Date()): boolean {
  if (!afterQuestions(opts.practiceId, prefsStore.getState()).checkin) return false
  if (NO_PRE_CHECKIN.has(opts.from) || opts.practiceId === 'grounding') return false
  return !unwellJustBefore(latestRecords(), now)
}

/**
 * 练习前自评的回答，在点选的处理里调用：分数 0–10，或 null（跳过、Esc、点遮罩、下拉面板）。
 * 无论哪种都开始练习。点了分数时面板再留 300 ms，让人看见选中的格子：声音在这次点击里先解锁，之后再开始
 */
export function answerPreCheckin(score: number | null): void {
  const s = sessionStore.getState()
  const start = s.start
  if (s.phase !== 'checkin' || !start || s.preAsked) return
  if (score === null) {
    launch(start, null, true)
    return
  }
  sessionStore.setState({ pre: score, preAsked: true })
  void getAudio().unlock()
  setTimeout(() => {
    const now = sessionStore.getState()
    if (now.phase === 'checkin' && now.start === start) launch(start, score, true)
  }, CHECKIN_SEEN_MS)
}

/**
 * 小结里的「再来一次」（在点击里调用）：同一项练习、同样的时长和这一次的设置，从小结开始。
 * 计划里的那一天已经记过，再练一次不再算一天
 */
export function practiceAgain(): StartOutcome | null {
  const { start, plan } = sessionStore.getState()
  if (!start) return null
  const { programDay: _counted, ...rest } = start
  const minutes = rest.minutes ?? (plan && plan.plannedSec > 0 ? plan.plannedSec / 60 : undefined)
  return startPractice({ ...rest, ...(minutes === undefined ? {} : { minutes }), from: 'summary' })
}

/**
 * 首次使用：「开始之前」读到最后、点了确认（在确认按钮的点击里调用）。记下已读、已看过引导，
 * 然后开始被拦下的那次练习；直接从 /welcome 来的，开始一分钟停一停
 */
export function confirmSafetyNotice(now: Date = new Date()): StartOutcome {
  const prefs = prefsStore.getState()
  prefs.set({ onboarded: true, safety: { ackOn: dayKey(now) } })
  const { gated, origin } = sessionStore.getState()
  sessionStore.setState({ gated: null })
  const outcome = startPractice(gated ?? { practiceId: 'pause', minutes: 1, from: 'welcome' })
  if (gated?.from === 'pace-finder' && outcome === 'started') navigate(origin)
  return outcome
}

/** 排好计划、开始会话、进播放器。必须在用户手势里（或手势里已经解锁过声音之后）调用 */
export function launch(opts: StartOptions, pre: number | null, preAsked: boolean): void {
  const prefs = prefsStore.getState()
  const screening = prefs.safety.screening
  const minutes = opts.minutes ?? defaultMinutes(opts.practiceId, prefs, screening)
  const plan = buildPlan(opts.practiceId, minutes, prefs, screening, opts.overrides)
  if (opts.programDay) {
    plan.params.program = opts.programDay.programId
    plan.params.programDay = opts.programDay.day
  }
  const ctrl = getController()
  if (ctrl.getState().status === 'done') ctrl.reset()
  const here = currentPath()
  const origin = here.startsWith(PLAYER_PREFIX) ? sessionStore.getState().origin : here
  sessionStore.setState({ ...INITIAL_SESSION, phase: 'playing', start: opts, plan, origin, pre, preAsked })
  ctrl.start(plan).catch((err: unknown) => {
    console.error(err)
  })
  if (opts.from === 'pace-finder') return
  navigate(`${PLAYER_PREFIX}${opts.practiceId}`, { replace: here.startsWith(PLAYER_PREFIX) })
}
