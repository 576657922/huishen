/**
 * 练习结束以后：满 1 分钟就存记录；计划里的一天练完了就记下；「有点急」之后记住新的速度；
 * 再给小结准备好要显示和要问的东西。小结里的回答（练完感觉、练后自评、备注）随点随存。
 */
import type { CatalogPracticeId } from '@/content/practices'
import {
  type Feeling,
  isRecordable,
  PERSONAL_RATE,
  prefsStore,
  recentDistress,
  resultToRecord,
  type SessionRecord,
} from '@/data'
import type { SessionResult, SessionStatus } from '@/engine'
import { clamp } from '@/lib/math'
import { navigate } from '../navigation'
import { afterQuestions, SLOW_RATE } from '../plan'
import { getController, getRepo, getTimeScale } from '../services'
import { watchRecords } from './records'
import { cancelResume, watchResume } from './resume'
import {
  INITIAL_SESSION,
  type SessionSummary,
  type StartOptions,
  type SummaryAnswers,
  sessionStore,
} from './store'

/** 自然结束后，播放器停留 3 秒再打开小结（DESIGN.md §8.15.14） */
export const ENDING_HOLD_MS = 3000

/** 备注最多 200 字（DESIGN.md §8.8） */
export const NOTE_MAX = 200

/** 正在保存的记录；小结里的回答要等它存好再补上 */
let saving: Promise<void> = Promise.resolve()
/**
 * 这次结束不出小结：离开了播放器，或是为了马上开始落地练习。
 * 只在同步的 end() 调用期间为 true（会话控制器在 end() 里同步通知结束）
 */
let quiet = false

const isActive = (s: SessionStatus): boolean => s === 'lead' || s === 'running' || s === 'paused'

/** 启动时调用一次：跟踪记录、接住每一次练习的结束。返回停止 */
export function initFlows(): () => void {
  const offRecords = watchRecords()
  const offResume = watchResume()
  const offFinish = getController().onFinish(handleFinish)
  return () => {
    offFinish()
    offResume()
    offRecords()
  }
}

function handleFinish(result: SessionResult): void {
  const s = sessionStore.getState()
  const prefs = prefsStore.getState()
  const assessment = result.plan.kind === 'assessment'

  // 舒适节律探索的每一档不单独记录，由它自己的页面决定怎么记
  const record = !assessment && isRecordable(result) ? toRecord(result, s.pre) : null
  if (record) {
    saving = getRepo()
      .add(record)
      .catch((err: unknown) => {
        console.error(err)
      })
  }
  const day = s.start?.programDay
  const programDayDone = record && result.completed && day?.countsAsDay ? day : null
  if (programDayDone) prefs.completeProgramDay(programDayDone.programId, programDayDone.day)
  const rememberedRate = rememberRate(result, s.start)

  const summary: SessionSummary = {
    result,
    record,
    questions: questionsFor(result.plan.practiceId as CatalogPracticeId, record, s),
    answers: {},
    gentler: false,
    programDayDone,
    rememberedRate,
  }

  if (quiet) return
  if (assessment) {
    sessionStore.setState({ phase: 'idle', summary })
    return
  }
  // 倒数里就点了结束：练习没开始，不出小结，回到开始的地方
  if (!result.completed && result.practicedSec <= 0) {
    getController().reset()
    sessionStore.setState({ ...INITIAL_SESSION })
    navigate(s.origin, { replace: true })
    return
  }
  sessionStore.setState({ phase: 'ending', summary })
  const hold = result.completed ? ENDING_HOLD_MS / getTimeScale() : 0
  setTimeout(() => {
    const now = sessionStore.getState()
    if (now.phase === 'ending' && now.summary === summary) sessionStore.setState({ phase: 'summary' })
  }, hold)
}

function toRecord(result: SessionResult, pre: number | null): SessionRecord {
  return resultToRecord(result, pre === null ? {} : { checkin: { pre } })
}

/**
 * 小结里问什么：没记录的不问；睡前、测试之后不问；「不舒服？」之后只问练完感觉；
 * 练习前没问过自评的，练习后也不问（记录里只有一半没有用）
 */
function questionsFor(
  id: CatalogPracticeId,
  record: SessionRecord | null,
  s: { start: StartOptions | null; endedFromDistress: boolean; preAsked: boolean },
): SessionSummary['questions'] {
  if (!record) return { feeling: false, checkin: false }
  const asked = afterQuestions(id, prefsStore.getState())
  const distress = s.endedFromDistress || s.start?.from === 'distress'
  return { feeling: asked.feeling, checkin: asked.checkin && s.preAsked && !distress }
}

/**
 * 慢呼吸里点过「有点急」：记住最后的速度，下次从这个速度开始（PRODUCT.md §2）。
 * 计划规定的速度（四周呼吸的前三周、「现在有点难」里轻而慢的 6 次/分）不是这个人自己选的，不记
 */
function rememberRate(result: SessionResult, start: StartOptions | null): number | null {
  if (result.plan.practiceId !== 'slow' || result.rateSteps <= 0 || result.finalRate === null) return null
  if (typeof start?.overrides?.params?.rate === 'number') return null
  const rate = clamp(Math.round(result.finalRate * 2) / 2, SLOW_RATE.min, SLOW_RATE.max)
  const prefs = prefsStore.getState()
  prefs.setPractice('slow', { rate })
  prefs.set({ personalRate: clamp(rate, PERSONAL_RATE.min, PERSONAL_RATE.max) })
  return rate
}

/* ---------- 结束与离开 ---------- */

/** 结束这一次但不出小结（满 1 分钟照样记下）；还在等声音解锁的开始也一并取消 */
function endQuietly(): void {
  quiet = true
  try {
    getController().end()
  } finally {
    quiet = false
  }
}

/** 结束这一次，为了马上开始下一项（「不舒服？」里的落地练习）：满 1 分钟照样记下，不出小结 */
export function endForHandoff(): void {
  if (isActive(getController().getState().status)) endQuietly()
}

/**
 * 离开了播放器（返回键、导航）：正在练习就结束（满 1 分钟照样记下），不出小结；
 * 小结已经显示的，已答的都已存好，直接收起
 */
export function abandonPractice(): void {
  const ctrl = getController()
  cancelResume()
  endQuietly()
  if (ctrl.getState().status === 'done') ctrl.reset()
  sessionStore.setState({ ...INITIAL_SESSION, gated: sessionStore.getState().gated })
}

/* ---------- 小结里的回答 ---------- */

function patch(summary: SessionSummary, next: Partial<SessionSummary>): void {
  // 只改还在显示的那一份：异步存好时，人可能已经开始了下一次练习
  if (sessionStore.getState().summary === summary) sessionStore.setState({ summary: { ...summary, ...next } })
}

function answer(summary: SessionSummary, answers: Partial<SummaryAnswers>): SessionSummary {
  const next = { ...summary, answers: { ...summary.answers, ...answers } }
  if (sessionStore.getState().summary === summary) sessionStore.setState({ summary: next })
  return next
}

/**
 * 练完感觉，一点即存（null 为跳过）。存好后算一遍「最近 3 次里至少 2 次更紧张或很不舒服」，
 * 结果放在 summary.gentler
 */
export async function submitFeeling(feeling: Feeling | null): Promise<void> {
  const current = sessionStore.getState().summary
  if (!current?.record) return
  const summary = answer(current, { feeling })
  await saving
  const repo = getRepo()
  await repo.update(current.record.id, { feeling: feeling ?? undefined })
  patch(summary, { gentler: feeling === null ? false : recentDistress(await repo.all()) })
}

/** 练习后的「此刻有多紧张？」0–10，一点即存（null 为跳过）。练习前的分数照旧保留 */
export async function submitCheckin(post: number | null): Promise<void> {
  const current = sessionStore.getState().summary
  if (!current?.record) return
  answer(current, { post })
  await saving
  await getRepo().update(current.record.id, { checkin: { post: post ?? undefined } })
}

/** 备注，最多 200 字；空白等于删掉。失去焦点和点「完成」时各存一次 */
export async function submitNote(text: string): Promise<void> {
  const current = sessionStore.getState().summary
  if (!current?.record) return
  const note = text.trim().slice(0, NOTE_MAX)
  answer(current, { note })
  await saving
  await getRepo().update(current.record.id, { note: note || undefined })
}

/** 「完成」或右上角的关闭：收起小结，回到今日（DESIGN.md §13.6） */
export function closeSummary(): void {
  const ctrl = getController()
  if (ctrl.getState().status === 'done') ctrl.reset()
  sessionStore.setState({ ...INITIAL_SESSION })
  navigate('/', { replace: true })
}
