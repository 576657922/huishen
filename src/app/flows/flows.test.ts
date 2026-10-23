import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMemorySessionRepo,
  type LocalSessionRepo,
  prefsStore,
  type SessionRecord,
  setSessionRepo,
} from '@/data'
import { dayKey } from '@/lib/date'
import { setNavigate } from '../navigation'
import { PACE_FINDER_RATES } from '../plan'
import { getController, resetServices } from '../services'
import {
  abandonPractice,
  answerPreCheckin,
  CHECKIN_SEEN_MS,
  closeSummary,
  confirmSafetyNotice,
  continueAfterDistress,
  ENDING_HOLD_MS,
  endFromDistress,
  INITIAL_SESSION,
  initFlows,
  needsPreCheckin,
  pauseForDistress,
  practiceAgain,
  type StartOptions,
  savePaceFinderRun,
  sessionStore,
  startGroundingFromDistress,
  startPractice,
  submitCheckin,
  submitFeeling,
  submitNote,
} from './index'

let repo: LocalSessionRepo
let stopFlows: () => void
const navigate = vi.fn()

/** 推进假计时器，期间的定时器和微任务都跑完 */
const advance = async (ms: number): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms)
}
/** 推进到练习的第 sec 秒（先让声音解锁的承诺落定，会话才真正开始） */
async function practiceUntil(sec: number): Promise<void> {
  await advance(0)
  const ms = (sec - getController().time()) * 1000
  if (ms > 0) await advance(Math.ceil(ms))
}
const status = (): string => getController().getState().status
const records = (): Promise<SessionRecord[]> => repo.all()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 22, 8, 5))
  resetServices()
  repo = createMemorySessionRepo()
  setSessionRepo(repo)
  prefsStore.getState().reset()
  prefsStore.getState().set({ onboarded: true, safety: { ackOn: '2026-10-01' } })
  sessionStore.setState({ ...INITIAL_SESSION })
  navigate.mockClear()
  setNavigate(navigate)
  stopFlows = initFlows()
})

afterEach(() => {
  stopFlows()
  resetServices()
  setSessionRepo(null)
  setNavigate(null)
  vi.useRealTimers()
})

const today = (practiceId: StartOptions['practiceId'], minutes?: number): StartOptions =>
  minutes === undefined ? { practiceId, from: 'today' } : { practiceId, minutes, from: 'today' }

describe('开始', () => {
  it('排好计划、开始会话、进播放器', async () => {
    expect(startPractice(today('pause'))).toBe('started')
    expect(navigate).toHaveBeenCalledWith('/play/pause', { replace: false })
    await advance(10)
    expect(status()).toBe('lead')
    const s = sessionStore.getState()
    expect(s.phase).toBe('playing')
    expect(s.plan?.plannedSec).toBe(60)
    expect(s.origin).toBe('/')
  })

  it('不给时长时用上次选的时长', async () => {
    prefsStore.getState().setPractice('focus', { minutes: 15 })
    startPractice({ practiceId: 'focus', from: 'catalogue' })
    expect(sessionStore.getState().plan?.plannedSec).toBe(900)
  })

  it('正在练习时不再开始', async () => {
    startPractice(today('pause'))
    await advance(10)
    expect(startPractice(today('focus'))).toBe('busy')
  })

  it('计划里的一天写进记录的参数', () => {
    startPractice({
      practiceId: 'focus',
      minutes: 10,
      from: 'today',
      programDay: { programId: 'mindfulness-8w', day: 'w3d2', role: 'day', countsAsDay: true },
    })
    expect(sessionStore.getState().plan?.params).toMatchObject({
      program: 'mindfulness-8w',
      programDay: 'w3d2',
    })
  })
})

describe('首次使用', () => {
  it('没读过「开始之前」：先去 /welcome，确认后接着开始那一项', async () => {
    prefsStore.getState().set({ onboarded: false, safety: { ackOn: null } })
    expect(startPractice(today('slow', 5))).toBe('gated')
    expect(navigate).toHaveBeenCalledWith('/welcome', {})
    expect(status()).toBe('idle')
    expect(confirmSafetyNotice(new Date(2026, 9, 22))).toBe('started')
    expect(prefsStore.getState().safety.ackOn).toBe('2026-10-22')
    expect(prefsStore.getState().onboarded).toBe(true)
    expect(navigate).toHaveBeenLastCalledWith('/play/slow', { replace: false })
    expect(sessionStore.getState().gated).toBeNull()
  })

  it('直接在 /welcome 确认：开始一分钟停一停', () => {
    prefsStore.getState().set({ safety: { ackOn: null } })
    confirmSafetyNotice()
    expect(sessionStore.getState().plan?.practiceId).toBe('pause')
  })
})

describe('练习前自评', () => {
  beforeEach(() => {
    prefsStore.getState().set({ checkin: { prePost: true } })
  })

  it('先打开面板；点了分数 300 ms 后开始，分数记进记录', async () => {
    expect(startPractice(today('pause'))).toBe('checkin')
    expect(sessionStore.getState().phase).toBe('checkin')
    expect(navigate).not.toHaveBeenCalled()
    answerPreCheckin(6)
    expect(navigate).not.toHaveBeenCalled()
    await advance(CHECKIN_SEEN_MS)
    expect(navigate).toHaveBeenCalledWith('/play/pause', { replace: false })
    expect(sessionStore.getState()).toMatchObject({ phase: 'playing', pre: 6, preAsked: true })
    await practiceUntil(61)
    await advance(0)
    expect((await records())[0]?.checkin).toEqual({ pre: 6 })
    expect(sessionStore.getState().summary?.questions).toEqual({ feeling: true, checkin: true })
  })

  it('跳过也开始，不等 300 ms', () => {
    startPractice(today('pause'))
    answerPreCheckin(null)
    expect(navigate).toHaveBeenCalledWith('/play/pause', { replace: false })
    expect(sessionStore.getState()).toMatchObject({ pre: null, preAsked: true })
  })

  it('难受时的出口、落地练习、睡前、测试不问', () => {
    expect(needsPreCheckin({ practiceId: 'cyclic-sigh', from: 'hard-moment' })).toBe(false)
    expect(needsPreCheckin({ practiceId: 'grounding', from: 'summary' })).toBe(false)
    expect(needsPreCheckin({ practiceId: 'sleep', from: 'catalogue' })).toBe(false)
    expect(needsPreCheckin({ practiceId: 'body-scan-sleep', from: 'today' })).toBe(false)
    expect(needsPreCheckin({ practiceId: 'pace-finder', from: 'pace-finder' })).toBe(false)
    expect(needsPreCheckin({ practiceId: 'focus', from: 'today' })).toBe(true)
  })

  it('今天上一次练完选了「很不舒服」：不问', async () => {
    startPractice(today('pause'))
    answerPreCheckin(null)
    await practiceUntil(61)
    await advance(ENDING_HOLD_MS)
    await submitFeeling('unwell')
    await advance(0)
    expect(needsPreCheckin(today('focus'), new Date(2026, 9, 22, 9))).toBe(false)
    expect(needsPreCheckin(today('focus'), new Date(2026, 9, 23, 9))).toBe(true)
  })
})

describe('结束与小结', () => {
  it('满 1 分钟：记下，停留 3 秒后打开小结', async () => {
    startPractice(today('pause'))
    await practiceUntil(60.5)
    expect(status()).toBe('done')
    expect(sessionStore.getState().phase).toBe('ending')
    await advance(ENDING_HOLD_MS)
    const s = sessionStore.getState()
    expect(s.phase).toBe('summary')
    expect(s.summary?.record?.practiceId).toBe('pause')
    expect(s.summary?.questions).toEqual({ feeling: true, checkin: false })
    expect(await records()).toHaveLength(1)
  })

  it('不足 1 分钟：不记录、不问，马上打开小结', async () => {
    startPractice(today('focus', 10))
    await practiceUntil(30)
    getController().end()
    await advance(0)
    const s = sessionStore.getState()
    expect(s.phase).toBe('summary')
    expect(s.summary?.record).toBeNull()
    expect(s.summary?.questions).toEqual({ feeling: false, checkin: false })
    expect(await records()).toHaveLength(0)
  })

  it('倒数里就结束：不出小结，回到开始的地方', async () => {
    startPractice(today('focus', 10))
    await advance(1000)
    expect(status()).toBe('lead')
    getController().end()
    expect(sessionStore.getState().phase).toBe('idle')
    expect(navigate).toHaveBeenLastCalledWith('/', { replace: true })
    expect(status()).toBe('idle')
  })

  it('计划的一天练完才记为完成；提前结束的不算', async () => {
    const programDay = { programId: 'mindfulness-8w', day: 'w1d1', role: 'day', countsAsDay: true } as const
    startPractice({ practiceId: 'pause', minutes: 1, from: 'program', programDay })
    await practiceUntil(61)
    expect(prefsStore.getState().programs['mindfulness-8w']?.done).toEqual(['w1d1'])
    expect(sessionStore.getState().summary?.programDayDone).toEqual(programDay)
    closeSummary()

    const day2 = { ...programDay, day: 'w1d2' }
    startPractice({ practiceId: 'focus', minutes: 5, from: 'program', programDay: day2 })
    await practiceUntil(120)
    getController().end()
    expect(prefsStore.getState().programs['mindfulness-8w']?.done).toEqual(['w1d1'])
  })

  it('点过「有点急」：记住最后的速度；计划规定的速度不记', async () => {
    startPractice(today('slow', 3))
    await practiceUntil(100)
    getController().stepBack()
    await practiceUntil(130)
    getController().stepBack()
    await practiceUntil(181)
    const { summary } = sessionStore.getState()
    expect(summary?.result.rateSteps).toBe(2)
    expect(summary?.rememberedRate).toBe(6.5)
    expect(prefsStore.getState().practice.slow?.rate).toBe(6.5)
    expect(prefsStore.getState().personalRate).toBe(6.5)
    closeSummary()

    prefsStore.getState().setPractice('slow', { rate: 5.5 })
    startPractice({ practiceId: 'slow', minutes: 3, from: 'program', overrides: { params: { rate: 6 } } })
    await practiceUntil(100)
    getController().stepBack()
    await practiceUntil(181)
    expect(sessionStore.getState().summary?.rememberedRate).toBeNull()
    expect(prefsStore.getState().practice.slow?.rate).toBe(5.5)
  })

  it('「有点急」到 7 次时记住 7 次：慢呼吸的范围是 4.5–7.0（PRODUCT.md §2）', async () => {
    prefsStore.getState().setPractice('slow', { rate: 6.5 })
    startPractice(today('slow', 3))
    await practiceUntil(100)
    getController().stepBack()
    await practiceUntil(181)
    const { summary } = sessionStore.getState()
    expect(summary?.result.finalRate).toBe(7)
    expect(summary?.rememberedRate).toBe(7)
    expect(prefsStore.getState().practice.slow?.rate).toBe(7)
    expect(prefsStore.getState().personalRate).toBe(7)
  })

  it('睡前的声音之后不问，练习前也不问', async () => {
    prefsStore.getState().set({ checkin: { prePost: true } })
    expect(startPractice(today('sleep', 15))).toBe('started')
    await practiceUntil(15 * 60 + 1)
    expect(sessionStore.getState().summary?.questions).toEqual({ feeling: false, checkin: false })
  })

  it('v1 不提供的练习（正念行走、睡前身体扫描）不能开始', () => {
    expect(startPractice(today('walking', 5))).toBe('unavailable')
    expect(startPractice(today('body-scan-sleep', 10))).toBe('unavailable')
    expect(navigate).not.toHaveBeenCalled()
    expect(status()).toBe('idle')
  })

  it('再来一次：同一项、同样的时长，从小结开始；计划里的一天不再算', async () => {
    const programDay = { programId: 'mindfulness-8w', day: 'w3d2', role: 'day', countsAsDay: true } as const
    startPractice({ ...today('focus', 5), programDay })
    await practiceUntil(5 * 60 + 1)
    await advance(ENDING_HOLD_MS)
    expect(sessionStore.getState().phase).toBe('summary')
    expect(practiceAgain()).toBe('started')
    expect(sessionStore.getState().start).toMatchObject({ practiceId: 'focus', minutes: 5, from: 'summary' })
    expect(sessionStore.getState().start?.programDay).toBeUndefined()
    expect(sessionStore.getState().plan?.params.programDay).toBeUndefined()
  })
})

describe('小结里的回答', () => {
  async function finishPause(): Promise<void> {
    startPractice(today('pause'))
    await practiceUntil(61)
    await advance(ENDING_HOLD_MS)
  }

  it('练完感觉、练后自评和备注随点随存', async () => {
    prefsStore.getState().set({ checkin: { prePost: true } })
    startPractice(today('pause'))
    answerPreCheckin(7)
    await advance(CHECKIN_SEEN_MS)
    await practiceUntil(61)
    await advance(ENDING_HOLD_MS)
    await submitFeeling('calmer')
    await submitCheckin(4)
    await submitNote('  有点困。  ')
    const [r] = await records()
    expect(r).toMatchObject({ feeling: 'calmer', checkin: { pre: 7, post: 4 }, note: '有点困。' })
    expect(sessionStore.getState().summary?.answers).toEqual({ feeling: 'calmer', post: 4, note: '有点困。' })
  })

  it('最近 3 次里 2 次更紧张或很不舒服：建议更温和的练法', async () => {
    await finishPause()
    await submitFeeling('tenser')
    expect(sessionStore.getState().summary?.gentler).toBe(false)
    closeSummary()
    await finishPause()
    await submitFeeling('unwell')
    expect(sessionStore.getState().summary?.gentler).toBe(true)
  })

  it('完成：收起小结，回到今日', async () => {
    await finishPause()
    closeSummary()
    expect(navigate).toHaveBeenLastCalledWith('/', { replace: true })
    expect(sessionStore.getState().phase).toBe('idle')
    expect(status()).toBe('idle')
  })
})

describe('不舒服？', () => {
  it('结束练习：不确认，满 1 分钟记下，小结只问练完感觉', async () => {
    prefsStore.getState().set({ checkin: { prePost: true } })
    startPractice(today('focus', 10))
    answerPreCheckin(5)
    await advance(CHECKIN_SEEN_MS)
    await practiceUntil(90)
    pauseForDistress()
    expect(status()).toBe('paused')
    endFromDistress()
    await advance(0)
    const s = sessionStore.getState()
    expect(s.phase).toBe('summary')
    expect(s.summary?.questions).toEqual({ feeling: true, checkin: false })
    expect(await records()).toHaveLength(1)
  })

  it('60 秒落地练习：结束这一次（照样记下），不出小结，马上开始落地练习', async () => {
    startPractice(today('focus', 10))
    await practiceUntil(90)
    pauseForDistress()
    startGroundingFromDistress()
    expect(navigate).toHaveBeenLastCalledWith('/play/grounding', { replace: false })
    expect(sessionStore.getState()).toMatchObject({ phase: 'playing', summary: null })
    expect(sessionStore.getState().plan?.practiceId).toBe('grounding')
    await advance(10)
    expect(status()).toBe('lead')
    expect((await records()).map(r => r.practiceId)).toEqual(['focus'])
    await practiceUntil(61)
    await advance(ENDING_HOLD_MS)
    expect(sessionStore.getState().summary?.questions).toEqual({ feeling: true, checkin: false })
  })

  it('继续：先按开头倒数的秒数倒数，倒数期间仍是暂停，然后接着练', async () => {
    startPractice(today('focus', 10))
    await practiceUntil(90)
    pauseForDistress()
    const lead = getController().getState().plan?.leadSec ?? 0
    expect(lead).toBeGreaterThan(0)
    continueAfterDistress()
    expect(sessionStore.getState().resumeAt).not.toBeNull()
    await advance(lead * 1000 - 100)
    expect(status()).toBe('paused')
    await advance(200)
    expect(status()).toBe('running')
    expect(sessionStore.getState().resumeAt).toBeNull()
  })

  it('倒数里又打开不舒服？、结束或在别处恢复：倒数作废，不会自己接着练', async () => {
    startPractice(today('focus', 10))
    await practiceUntil(90)
    pauseForDistress()
    continueAfterDistress()
    await advance(1000)
    pauseForDistress()
    expect(sessionStore.getState().resumeAt).toBeNull()
    await advance(10_000)
    expect(status()).toBe('paused')

    continueAfterDistress()
    getController().resume()
    expect(sessionStore.getState().resumeAt).toBeNull()
    expect(status()).toBe('running')
  })

  it('开头倒数设为 0：马上接着练', async () => {
    prefsStore.getState().set({ leadIn: 0 })
    startPractice(today('focus', 10))
    await practiceUntil(90)
    pauseForDistress()
    continueAfterDistress()
    expect(status()).toBe('running')
    expect(sessionStore.getState().resumeAt).toBeNull()
  })
})

describe('舒适节律探索', () => {
  it('每档一次 60 秒的短会话：不进播放器、不存记录、不出小结；一轮走完合成一条记录', async () => {
    const results = []
    for (const [i, rate] of PACE_FINDER_RATES.entries()) {
      const outcome = startPractice({
        practiceId: 'pace-finder',
        from: 'pace-finder',
        overrides: { params: { rate, step: i + 1 }, ...(i > 0 ? { leadSec: 3 } : {}) },
      })
      expect(outcome).toBe('started')
      await practiceUntil(61)
      const s = sessionStore.getState()
      expect(s.phase).toBe('idle')
      expect(s.summary?.record).toBeNull()
      expect(s.summary?.result.plan.params).toMatchObject({ rate, step: i + 1 })
      if (s.summary) results.push(s.summary.result)
    }
    expect(navigate).not.toHaveBeenCalled()
    expect(await records()).toHaveLength(0)

    const record = await savePaceFinderRun(results, { chosenRate: 5.5 })
    expect(record).toMatchObject({
      practiceId: 'pace-finder',
      actualSec: 300,
      params: { steps: 5, rate: 5.5 },
    })
    expect(await records()).toHaveLength(1)
  })

  it('不足 1 分钟的一轮不记', async () => {
    startPractice({
      practiceId: 'pace-finder',
      from: 'pace-finder',
      overrides: { params: { rate: 6.5, step: 1 } },
    })
    await practiceUntil(30)
    getController().end()
    await advance(0)
    const result = sessionStore.getState().summary?.result
    expect(result).toBeDefined()
    expect(await savePaceFinderRun(result ? [result] : [])).toBeNull()
    expect(await records()).toHaveLength(0)
  })
})

describe('离开播放器', () => {
  it('正在练习：结束并记下，不出小结', async () => {
    startPractice(today('focus', 10))
    await practiceUntil(90)
    abandonPractice()
    expect(sessionStore.getState().phase).toBe('idle')
    expect(status()).toBe('idle')
    await advance(0)
    const all = await records()
    expect(all).toHaveLength(1)
    expect(all[0]?.date).toBe(dayKey(new Date(2026, 9, 22)))
  })

  it('还在等声音解锁：这次不再开始', async () => {
    startPractice(today('focus', 10))
    abandonPractice()
    await advance(5000)
    expect(status()).toBe('idle')
  })
})
