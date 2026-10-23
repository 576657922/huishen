import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BellKind } from '@/audio/types'
import type { GuidedScript, PacedParams } from '@/content/types'
import { mulberry32 } from '@/lib/random'
import {
  BODY_SCAN_SCRIPT,
  BREATHING_SPACE_SCRIPT,
  type BreathSpan,
  createTestSession,
  FAKE_AUDIO_START,
  FakeAudioPort,
  FakePlatform,
  FakeVoice,
  guidedPlan,
  LOVING_KINDNESS_SCRIPT,
  pacedPlan,
  practiceOrigin,
  SILENT_SOUND,
  slowPlan,
  soundPlan,
  spanY,
  TEST_SOUND,
  type TestSession,
  testPlan,
} from '@/test/fakes'
import {
  type Pace,
  paceAt,
  paceBreaths,
  paceCycles,
  paceEndAt,
  paceOf,
  paceSteps,
  paceTarget,
  stepBack,
} from './pace'
import {
  type CycleSpan,
  completedCycles,
  cyclesOf,
  ease,
  LONG_EXHALE_INHALE_FRACTION,
  patternAt,
} from './patterns'
import { HORIZON_HIDDEN_SEC, HORIZON_VISIBLE_SEC } from './scheduler'
import {
  AUDIO_START_GRACE_MS,
  BED_BEFORE_BELL_SEC,
  CAPTION_CUE_GAP_SEC,
  COMPLETE_BED_FADE_SEC,
  captionCueTimes,
  createSessionController,
  DEFAULT_FADE_IN_SEC,
  endingOf,
  HAPTICS,
  leadFor,
  MARK_DEBOUNCE_SEC,
  MIN_PARTIAL_GLIDE_SEC,
  MIN_PARTIAL_SEC,
  NO_BELL_FADE_SEC,
  NULL_VOICE,
  PACED_TAIL_SEC,
  PARTIAL_GLIDE_STEPS,
  SHORT_SILENT_END_FADE_SEC,
  SHORT_SILENT_END_SEC,
  SILENT_END_FADE_SEC,
  SILENT_END_SEC,
  SKIP_LEAD_SEC,
  SPEECH_LATE_TOLERANCE_SEC,
  START_DELAY_SEC,
  STOP_BED_FADE_SEC,
  UNLOCK_TIMEOUT_MS,
} from './session'
import { buildTimeline, DEFAULT_END_BUFFER_SEC, lineSec, settleTone, speakSec } from './timeline'
import type {
  BreathPattern,
  CueStyle,
  Segment,
  SessionController,
  SessionPlan,
  SessionState,
  Timeline,
  TimelineCue,
} from './types'

const AUDIO_START = FAKE_AUDIO_START

const SIGH: PacedParams = { type: 'sigh', cycle: 10.5 }
const BOX: PacedParams = { type: 'phases', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 }
/** 每分钟 6 次、吸呼等长：一轮 10 秒，算起来方便 */
const SLOW6: PacedParams = { type: 'resonance', rate: 6, ratio: 'equal' }

const IDLE: SessionState = {
  status: 'idle',
  plan: null,
  startedAt: null,
  marks: [],
  count: null,
  caption: null,
  phaseIndex: -1,
  silentEnding: false,
  endReason: null,
  practicedSec: 0,
  audio: 'off',
  rate: null,
  section: null,
  endSec: null,
}

const noopTimers = {
  setInterval: () => 0,
  clearInterval: () => undefined,
  setTimeout: () => 0,
  clearTimeout: () => undefined,
}

const countPlan = (overrides: Partial<SessionPlan> = {}): SessionPlan =>
  testPlan({ kind: 'count', practiceId: 'breath-count', plannedSec: 600, ...overrides })

const speakCues = (plan: SessionPlan): TimelineCue[] =>
  plan.timeline?.cues.filter(c => c.kind === 'speak') ?? []

function patternOf(plan: SessionPlan): BreathPattern {
  if (!plan.pattern) throw new Error('计划里没有节拍')
  return plan.pattern
}

/** 排给背景声或滑音的各段，时刻换算成练习秒数 */
function segCalls(
  s: TestSession,
  method: 'breath' | 'glide',
  origin: number,
): Array<{ seg: Segment; t: number }> {
  return s.audio.callsTo(method).map(c => ({ seg: c.args[0] as Segment, t: (c.args[1] as number) - origin }))
}

interface PlannedSeg {
  key: string
  t: number
  dur: number
}

/** 按节拍应当排给背景声的各段：在 end − PACED_TAIL_SEC 之前开始，照整段排（背景声结束时本来就在淡出） */
function expectedSegments(pace: Pace, end: number): PlannedSeg[] {
  const out: PlannedSeg[] = []
  for (const c of paceCycles(pace)) {
    if (c.start >= end) break
    for (const seg of c.segs) {
      const t = c.start + seg.t0
      if (t < end - PACED_TAIL_SEC) out.push({ key: seg.key, t, dur: seg.dur })
    }
  }
  return out
}

/** 按节拍应当排给滑音的各段：和背景声一样，只是超出 end 的部分截掉 */
const expectedGlides = (pace: Pace, end: number): PlannedSeg[] =>
  expectedSegments(pace, end).map(e => ({ ...e, dur: Math.min(e.dur, end - e.t) }))

/** 排给滑音的各段，半截的一段拆成的直线小段（同一个 key、首尾相接）合回一段 */
function glideWindows(s: TestSession, origin: number): Array<{ seg: Segment; t: number }> {
  const out: Array<{ seg: Segment; t: number }> = []
  for (const c of segCalls(s, 'glide', origin)) {
    const last = out.at(-1)
    const joins = last && last.seg.key === c.seg.key && Math.abs(last.t + last.seg.dur - c.t) < 1e-9
    if (last && joins && c.seg.ease === 'linear')
      last.seg = { ...last.seg, dur: last.seg.dur + c.seg.dur, y1: c.seg.y1 }
    else out.push({ ...c })
  }
  return out
}

/**
 * 声音实际跟随的起伏离画面上的呼吸曲线最远多少：在每一段跟随的范围里每隔 step 秒取一点（含两端），
 * 与 breathAt 读出的位置比较
 */
function maxDrift(
  spans: readonly BreathSpan[],
  ctrl: SessionController,
  origin: number,
  step = 0.01,
): number {
  let worst = 0
  for (const span of spans) {
    const n = Math.max(1, Math.ceil((span.to - span.from) / step))
    for (let k = 0; k <= n; k++) {
      const t = span.from + ((span.to - span.from) * k) / n
      const want = ctrl.breathAt(t - origin)?.y ?? Number.NaN
      worst = Math.max(worst, Math.abs(spanY(span, t) - want))
    }
  }
  return worst
}

/** 半截的滑音拆成直线小段后，弦与弧之差的上限（起伏幅度为 1）：每小段不长于整段的 1/PARTIAL_GLIDE_STEPS，
 * 只有从一段开头起的第一小段可以放长到 MIN_PARTIAL_GLIDE_SEC；inout 缓动的弦高不超过 (π²/16)·(小段/整段)² */
const chordTolerance = (shortestSeg: number): number =>
  (Math.PI ** 2 / 16) * Math.max(1 / PARTIAL_GLIDE_STEPS, MIN_PARTIAL_GLIDE_SEC / shortestSeg) ** 2

/** 实际排出的各段与应当排出的逐段一致 */
function expectSegments(actual: Array<{ seg: Segment; t: number }>, expected: readonly PlannedSeg[]): void {
  expect(actual.map(a => a.seg.key)).toEqual(expected.map(e => e.key))
  for (const [i, a] of actual.entries()) {
    expect(a.t).toBeCloseTo(expected[i]?.t ?? Number.NaN, 6)
    expect(a.seg.dur).toBeCloseTo(expected[i]?.dur ?? Number.NaN, 6)
  }
}

/** 一段里 x 秒（段内）处的位置 */
const yIn = (seg: Segment, x: number): number =>
  seg.y0 + (seg.y1 - seg.y0) * ease(seg.ease, seg.dur > 0 ? x / seg.dur : 1)

/**
 * 背景声实际跟随的曲线（去掉撤销的、截到停下的时刻）：从练习第 0 秒起首尾相接、不重叠，交界处的位置连续；
 * 最后一段在 end − PACED_TAIL_SEC（练习秒数）之前开始，照整段走完。
 * 唯一允许的空档：撤销时正在走的那一段只剩不到 MIN_PARTIAL_SEC，不再补排，背景声停在那里，
 * 下一段在这一段本来结束的时刻准时接上
 */
function expectContinuousCover(audio: FakeAudioPort, origin: number, end: number): void {
  const cover = audio.breathCover()
  const first = cover[0]
  if (!first) throw new Error('背景声没有跟过节拍')
  expect(first.from).toBeCloseTo(origin, 9)
  expect(spanY(first, first.from)).toBe(0)
  for (const [i, span] of cover.entries()) {
    const next = cover[i + 1]
    const naturalEnd = span.at + span.seg.dur
    if (next && Math.abs(next.from - span.to) < 1e-6) {
      expect(spanY(next, next.from)).toBeCloseTo(spanY(span, span.to), 9)
    } else if (next) {
      expect(naturalEnd - span.to).toBeLessThan(MIN_PARTIAL_SEC)
      expect(next.from).toBeCloseTo(naturalEnd, 6)
      expect(spanY(next, next.from)).toBeCloseTo(span.seg.y1, 9)
    } else {
      expect(span.from - origin).toBeLessThan(end - PACED_TAIL_SEC)
      expect(span.to).toBeCloseTo(naturalEnd, 9)
      expect(span.to - origin).toBeGreaterThanOrEqual(end - PACED_TAIL_SEC - 1e-6)
    }
  }
}

/** 第一次排的背景声淡出：[声音时钟上的开始时刻, 秒数] */
function firstFade(s: TestSession): [number, number] {
  const args = s.audio.callsTo('fadeBedOut')[0]?.args
  if (!args) throw new Error('没有排背景声淡出')
  return [args[0] as number, args[1] as number]
}

/** 第 k 轮（从 0 数）；节拍的轮是无限的，不能整个展开 */
function nthCycle(pace: Pace, k: number): CycleSpan {
  let n = 0
  for (const c of paceCycles(pace)) if (n++ === k) return c
  throw new Error('不会到这里')
}

/** 还排着、没被撤销的钟声，换算成练习秒数 */
const liveBells = (s: TestSession, kind: BellKind, origin: number): number[] =>
  s.audio
    .bells(kind)
    .filter(b => !b.cancelled)
    .map(b => b.at - origin)

/** 去掉连续重复后的序列 */
const changes = <T>(xs: readonly T[]): T[] => xs.filter((x, i) => i === 0 || x !== xs[i - 1])

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-22T21:00:00+08:00'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('focus session', () => {
  it('runs from the countdown to completion', async () => {
    const s = createTestSession()
    const plan = testPlan({ plannedSec: 600, leadSec: 3 })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)

    expect(s.ctrl.getState()).toEqual({
      ...IDLE,
      status: 'lead',
      plan,
      startedAt: '2026-10-22T13:00:00.000Z',
      audio: 'on',
      endSec: 600,
    })
    expect(s.platform.awake).toBe(true)
    expect(s.ctrl.time()).toBeCloseTo(-3 - START_DELAY_SEC, 9)

    // 背景声在倒数一开始就淡入；开始钟声落在练习第 0 秒，结束钟声落在计划时长
    const bedAt = AUDIO_START + START_DELAY_SEC
    expect(s.audio.callsTo('startBed')[0]?.args).toEqual([plan.sound, bedAt, DEFAULT_FADE_IN_SEC, 603])
    expect(s.audio.bells('start').map(b => b.at)).toEqual([origin])
    expect(s.audio.bells('end').map(b => b.at)).toEqual([origin + 600])
    const [fadeAt, fadeDur] = firstFade(s)
    expect(fadeAt).toBeCloseTo(origin + 600 - SILENT_END_SEC, 9)
    expect(fadeDur).toBe(SILENT_END_FADE_SEC)

    await s.advanceTo(0.5)
    expect(s.ctrl.getState().status).toBe('running')

    // 背景声按自己的周期起伏，前瞻 6 秒
    const lastUntil = s.audio.callsTo('freeRun').at(-1)?.args[0] as number
    expect(lastUntil - origin).toBeCloseTo(0.5 - 0.1 + HORIZON_VISIBLE_SEC, 0)

    await s.advanceTo(10)
    s.ctrl.mark()
    s.ctrl.mark()
    await s.advance(500)
    s.ctrl.mark()
    await s.advance(200)
    s.ctrl.mark()
    expect(s.ctrl.getState().marks).toEqual([10, 10.7])
    expect(s.audio.cues('mark')).toHaveLength(2)

    await s.advanceTo(539.9)
    expect(s.ctrl.getState().silentEnding).toBe(false)
    await s.advance(150)
    expect(s.ctrl.getState().silentEnding).toBe(true)

    await s.advanceTo(600)
    await s.advance(20)
    expect(s.ctrl.getState()).toMatchObject({
      status: 'done',
      endReason: 'complete',
      practicedSec: 600,
      caption: null,
    })
    expect(s.results).toEqual([
      {
        plan,
        startedAt: '2026-10-22T13:00:00.000Z',
        practicedSec: 600,
        completed: true,
        marks: [10, 10.7],
        count: null,
        breaths: null,
        finalRate: null,
        rateSteps: 0,
        skipped: [],
      },
    ])
    // 结束钟声照常响，背景声慢慢淡出
    expect(s.audio.callsTo('cancelScheduled')).toHaveLength(0)
    expect(s.audio.bells('end')[0]?.cancelled).toBe(false)
    expect(s.audio.callsTo('stopBed').map(c => c.args)).toEqual([[COMPLETE_BED_FADE_SEC]])
    expect(Math.max(...s.audio.callsTo('freeRun').map(c => c.args[0] as number))).toBeLessThanOrEqual(
      origin + 601,
    )
    expect(s.platform.awake).toBe(false)
    expect(s.voice.cancels).toBe(1)
    expect(s.audio.listenerCount()).toBe(0)
    expect(s.platform.listenerCount()).toBe(0)

    expect(s.ctrl.time()).toBe(600)
    s.ctrl.mark()
    s.ctrl.end()
    await s.advance(30_000)
    expect(s.results).toHaveLength(1)
    expect(s.ctrl.getState().marks).toEqual([10, 10.7])

    s.ctrl.reset()
    expect(s.ctrl.getState()).toEqual(IDLE)
    expect(s.ctrl.time()).toBe(0)
  })

  it('completes within a few milliseconds of the planned time', async () => {
    const s = createTestSession()
    let doneAt = 0
    s.ctrl.subscribe(() => {
      if (s.ctrl.getState().status === 'done' && doneAt === 0) doneAt = performance.now()
    })
    const plan = testPlan({ plannedSec: 61.37, leadSec: 2 })
    const startedAt = performance.now()
    await s.ctrl.start(plan)
    await s.advance(70_000)
    const due = startedAt + (leadFor(plan, true) + START_DELAY_SEC + 61.37) * 1000
    expect(doneAt - due).toBeGreaterThanOrEqual(0)
    expect(doneAt - due).toBeLessThan(15)
  })

  it('notices completion from time() alone when timers are frozen', async () => {
    const s = createTestSession({ session: noopTimers })
    await s.ctrl.start(testPlan({ plannedSec: 60, leadSec: 0, sound: { ...SILENT_SOUND } }))
    vi.advanceTimersByTime(61_000)
    expect(s.ctrl.getState().status).toBe('lead')
    expect(s.ctrl.time()).toBe(60)
    await Promise.resolve()
    expect(s.ctrl.getState()).toMatchObject({ status: 'done', endReason: 'complete', practicedSec: 60 })
  })

  it('records marks only for focus practice', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ kind: 'timer', practiceId: 'timer' }))
    await s.advanceTo(5)
    s.ctrl.mark()
    expect(s.ctrl.getState().marks).toEqual([])
    expect(s.audio.cues('mark')).toHaveLength(0)
  })

  it('marks silently when cues are off', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ cues: false }))
    await s.advanceTo(5)
    s.ctrl.mark()
    expect(s.ctrl.getState().marks).toEqual([5])
    expect(s.audio.cues('mark')).toHaveLength(0)
  })
})

describe('lead-in', () => {
  it('lets the bed play at least 3 s before the start bell by lengthening a short countdown', async () => {
    for (const leadSec of [0, 1, 2.5]) {
      const s = createTestSession()
      const plan = testPlan({ leadSec, plannedSec: 60 })
      expect(leadFor(plan, true)).toBe(BED_BEFORE_BELL_SEC)
      await s.ctrl.start(plan)
      const bedAt = s.audio.callsTo('startBed')[0]?.args[1] as number
      const bell = s.audio.bells('start')[0]?.at ?? Number.NaN
      expect(bell - bedAt).toBeCloseTo(BED_BEFORE_BELL_SEC, 9)
      // 界面上的倒数（time() 为负的那段）恰好在钟声响起时走到 0：钟声不会晚于倒数
      expect(s.ctrl.time()).toBeCloseTo(-(BED_BEFORE_BELL_SEC + START_DELAY_SEC), 9)
      const toZero = Math.round((BED_BEFORE_BELL_SEC + START_DELAY_SEC) * 1000)
      await s.advance(toZero - 1)
      expect(s.ctrl.getState().status).toBe('lead')
      await s.advance(2)
      expect(s.ctrl.getState().status).toBe('running')
      expect(s.audio.now()).toBeGreaterThanOrEqual(bell)
    }
  })

  it.each<[string, Partial<SessionPlan>, boolean, number]>([
    ['a longer countdown', { leadSec: 5 }, true, 5],
    ['no bed to wait for', { leadSec: 1, sound: { ...SILENT_SOUND } }, true, 1],
    ['a muted bed', { leadSec: 1, sound: { ...TEST_SOUND, ambienceVolume: 0 } }, true, 1],
    ['music only', { leadSec: 1, sound: { ...SILENT_SOUND, music: 'drone' } }, true, BED_BEFORE_BELL_SEC],
    ['no start bell (listening)', { leadSec: 1, kind: 'sound', practiceId: 'listen' }, true, 1],
    ['no sound at all', { leadSec: 1 }, false, 1],
  ])('keeps the planned countdown with %s', async (_, overrides, audioOn, lead) => {
    const plan = testPlan({ plannedSec: 60, ...overrides })
    expect(leadFor(plan, audioOn)).toBe(lead)
    const s = createTestSession({ audio: { unlockResult: audioOn } })
    await s.ctrl.start(plan)
    expect(s.ctrl.time()).toBeCloseTo(-lead - (audioOn ? START_DELAY_SEC : 0), 9)
  })

  it('fades the bed in over the lead-in and tells it how long the practice will run', async () => {
    const timed = createTestSession()
    const plan = testPlan({ plannedSec: 900, leadSec: 5, fadeInSec: 20 })
    await timed.ctrl.start(plan)
    expect(timed.audio.callsTo('startBed')[0]?.args).toEqual([
      plan.sound,
      AUDIO_START + START_DELAY_SEC,
      20,
      905,
    ])

    // 不限时：不告诉背景声练习多长
    const open = createTestSession()
    const unlimited = soundPlan({ plannedSec: 0 })
    await open.ctrl.start(unlimited)
    expect(open.audio.callsTo('startBed')[0]?.args).toEqual([
      unlimited.sound,
      AUDIO_START + START_DELAY_SEC,
      DEFAULT_FADE_IN_SEC,
    ])
  })
})

describe('ending', () => {
  it('clears the end bell it left ringing when the next practice starts right away', async () => {
    const s = createTestSession()
    const plan = testPlan({ kind: 'timer', practiceId: 'timer', plannedSec: 60 })
    await s.ctrl.start(plan)
    await s.advanceTo(60)
    await s.advance(100)
    expect(s.results[0]?.completed).toBe(true)
    // 到点结束不撤：结束钟声照常响完（真实声音层里后两击在 +7、+14 秒），回到 idle 也不撤
    s.ctrl.reset()
    expect(s.audio.callsTo('cancelScheduled')).toEqual([])
    // 小结页上马上「再来一次」：先撤掉旧钟声还没敲的几击，再排这一次的
    await s.advance(2000)
    const before = s.audio.calls.length
    await s.ctrl.start(plan)
    const fresh = s.audio.calls.slice(before)
    expect(fresh.slice(0, 3).map(c => c.method)).toEqual(['unlock', 'cancelScheduled', 'startBed'])
    const bedAt = fresh[2]?.args[1] as number
    const origin = bedAt + leadFor(plan, true)
    // 这一次自己的钟声照常排着
    const ahead = (kind: BellKind): number[] => liveBells(s, kind, origin).filter(t => t >= bedAt - origin)
    expect(ahead('start')).toEqual([expect.closeTo(0, 9)])
    expect(ahead('end')).toEqual([expect.closeTo(60, 9)])
    // 提前结束时当场就撤了；再开始一次不必多撤
    await s.advanceTo(10)
    s.ctrl.end()
    const cancels = s.audio.callsTo('cancelScheduled').length
    s.ctrl.reset()
    await s.ctrl.start(plan)
    expect(s.audio.callsTo('cancelScheduled')).toHaveLength(cancels)
  })

  it.each<[string, Partial<SessionPlan>, [number, number], number | null]>([
    ['3 minutes or more: fades over 30 s, then 30 s of silence', { plannedSec: 600 }, [540, 30], 540],
    ['exactly 3 minutes', { plannedSec: 180 }, [120, SILENT_END_FADE_SEC], 120],
    ['1 to 3 minutes: a shorter fade', { plannedSec: 179 }, [154, SHORT_SILENT_END_FADE_SEC], 154],
    ['exactly 1 minute', { plannedSec: 60 }, [60 - SHORT_SILENT_END_SEC, SHORT_SILENT_END_FADE_SEC], 35],
    [
      'under a minute: the bed fades with the end bell',
      { plannedSec: 59 },
      [59, COMPLETE_BED_FADE_SEC],
      null,
    ],
    ['silent ending off', { plannedSec: 600, silentEnd: false }, [600, COMPLETE_BED_FADE_SEC], null],
  ])('%s', async (_, overrides, [fadeFrom, fadeDur], silentAt) => {
    const s = createTestSession()
    const plan = testPlan(overrides)
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    const [at, dur] = firstFade(s)
    expect(at - origin).toBeCloseTo(fadeFrom, 9)
    expect(dur).toBe(fadeDur)
    expect(liveBells(s, 'end', origin)).toEqual([expect.closeTo(plan.plannedSec, 9)])
    if (silentAt === null) {
      await s.advance(700_000)
      expect(s.states.some(st => st.silentEnding)).toBe(false)
    } else {
      await s.advanceTo(silentAt - 0.1)
      expect(s.ctrl.getState().silentEnding).toBe(false)
      await s.advance(150)
      expect(s.ctrl.getState().silentEnding).toBe(true)
      await s.advance(700_000)
    }
    expect(s.ctrl.getState().status).toBe('done')
    expect(s.audio.callsTo('fadeBedOut')).toHaveLength(1)
  })

  it('fades the bed over the last two minutes and rings no end bell when asked', async () => {
    const s = createTestSession()
    const plan = testPlan({ plannedSec: 900, endBell: false })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    expect(s.audio.bells('start')).toHaveLength(1)
    expect(s.audio.bells('end')).toEqual([])
    const [at, dur] = firstFade(s)
    expect(at - origin).toBeCloseTo(900 - NO_BELL_FADE_SEC, 9)
    expect(dur).toBe(NO_BELL_FADE_SEC)
    await s.advance(1_000_000)
    expect(s.states.some(st => st.silentEnding)).toBe(false)
    expect(s.results[0]).toMatchObject({ completed: true, practicedSec: 900 })
    expect(s.audio.bells()).toHaveLength(1)
  })

  it('works out the ending from the end time alone', () => {
    expect(endingOf(600, true, true)).toEqual({ bell: 600, fade: { at: 540, dur: 30 }, silentAt: 540 })
    expect(endingOf(120, true, true)).toEqual({ bell: 120, fade: { at: 95, dur: 15 }, silentAt: 95 })
    expect(endingOf(30, true, true)).toEqual({ bell: 30, fade: { at: 30, dur: 6 }, silentAt: null })
    expect(endingOf(600, false, true)).toEqual({ bell: 600, fade: { at: 600, dur: 6 }, silentAt: null })
    expect(endingOf(2700, true, false)).toEqual({ bell: null, fade: { at: 2580, dur: 120 }, silentAt: null })
    // 比两分钟还短：从头淡到尾
    expect(endingOf(90, false, false)).toEqual({ bell: null, fade: { at: 0, dur: 90 }, silentAt: null })
    for (const end of [Number.POSITIVE_INFINITY, 0, Number.NaN])
      expect(endingOf(end, true, true)).toEqual({ bell: null, fade: null, silentAt: null })
  })
})

describe('paced session', () => {
  it('schedules every segment once, ahead of time, with breath and a glide by default', async () => {
    const s = createTestSession()
    const plan = pacedPlan(SIGH, { plannedSec: 63 })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    // 倒数时就已排上前瞻范围里的段
    expect(segCalls(s, 'breath', origin).map(c => c.t)).toEqual([0, 2.5])
    expect(s.ctrl.getState().rate).toBeCloseTo(60 / 10.5, 12)

    await s.advance(70_000)
    const expected = expectedSegments(paceOf(patternOf(plan)), 63)
    expect(expected).toHaveLength(18)
    expectSegments(segCalls(s, 'breath', origin), expected)
    expectSegments(glideWindows(s, origin), expectedGlides(paceOf(patternOf(plan)), 63))
    for (const c of [...s.audio.callsTo('breath'), ...s.audio.callsTo('glide')])
      expect(c.args[1] as number).toBeGreaterThan(c.time)
    // 滑音之外不再有每段的提示音，背景声也不再自己起伏
    expect(s.audio.callsTo('cue')).toEqual([])
    expect(s.audio.callsTo('freeRun')).toEqual([])
    expect(s.results[0]).toMatchObject({
      completed: true,
      practicedSec: 63,
      breaths: 6,
      rateSteps: 0,
      skipped: [],
    })
    expect(s.results[0]?.finalRate).toBeCloseTo(60 / 10.5, 12)
  })

  it.each<[CueStyle, { breath: boolean; glide: boolean; ping: boolean }]>([
    ['glide', { breath: true, glide: true, ping: false }],
    ['ping', { breath: true, glide: false, ping: true }],
    ['bed', { breath: true, glide: false, ping: false }],
    ['off', { breath: false, glide: false, ping: false }],
  ])('plays the %s cue style', async (cueStyle, want) => {
    const s = createTestSession()
    // 回神、数息、段落的提示音关着，不影响节拍提示
    const plan = pacedPlan(SIGH, { plannedSec: 63, cueStyle, cues: false })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    await s.advance(70_000)
    const expected = expectedSegments(paceOf(patternOf(plan)), 63)
    if (want.breath) expectSegments(segCalls(s, 'breath', origin), expected)
    else expect(s.audio.callsTo('breath')).toEqual([])
    if (want.glide) expectSegments(glideWindows(s, origin), expectedGlides(paceOf(patternOf(plan)), 63))
    else expect(s.audio.callsTo('glide')).toEqual([])
    const pings = s.audio.cues().map(c => [c.kind, c.at - origin])
    expect(pings).toEqual(want.ping ? expected.map(e => [e.key, expect.closeTo(e.t, 6)]) : [])
    // 静音时背景声不跟节拍，按自己的周期起伏
    const freeRun = s.audio.callsTo('freeRun').map(c => (c.args[0] as number) - origin)
    if (cueStyle === 'off') {
      expect(freeRun.length).toBeGreaterThan(0)
      expect(Math.max(...freeRun)).toBeLessThanOrEqual(64 + 1e-9)
    } else expect(freeRun).toEqual([])
    expect(s.results[0]).toMatchObject({ completed: true, breaths: 6 })
  })

  it('cuts the last glide at the end along the drawn curve so nothing rings on past the end bell', async () => {
    const s = createTestSession()
    // 一轮 10 秒；第 60 秒开始的吸气只剩 3 秒
    const plan = pacedPlan(SLOW6, { plannedSec: 63 })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    await s.advance(70_000)
    const seg = patternOf(plan).segs[0]
    if (!seg) throw new Error('节拍里没有吸气')
    // 最后一个滑音截到第 63 秒，拆成首尾相接的直线小段：交界处都在吸气的曲线上，而不是把缓动重新套在 3 秒上
    const parts = segCalls(s, 'glide', origin).filter(c => c.t > 60 - 1e-9)
    const [head, ...rest] = parts
    if (!head) throw new Error('没有排上最后的滑音')
    expect(head.t).toBeCloseTo(60, 9)
    expect(head.seg).toMatchObject({ key: 'in', y0: 0, t0: 0, ease: 'linear' })
    // 从一段开头起可能新起一个音，声音端口按第一小段的长短起音：它不短于 MIN_PARTIAL_GLIDE_SEC
    expect(head.seg.dur).toBeGreaterThanOrEqual(MIN_PARTIAL_GLIDE_SEC - 1e-9)
    let prev = head
    for (const p of rest) {
      expect(p.t).toBeCloseTo(prev.t + prev.seg.dur, 9)
      expect(p.seg.dur).toBeLessThanOrEqual(seg.dur / PARTIAL_GLIDE_STEPS + 1e-9)
      expect(p.seg).toMatchObject({ key: 'in', ease: 'linear' })
      prev = p
    }
    for (const p of parts) {
      expect(p.seg.y0).toBeCloseTo(yIn(seg, p.t - 60), 12)
      expect(p.seg.y1).toBeCloseTo(yIn(seg, p.t - 60 + p.seg.dur), 12)
    }
    expect(prev.t + prev.seg.dur).toBeCloseTo(63, 9)
    expect(prev.seg.y1).toBeCloseTo(yIn(seg, 3), 12)
    expect(maxDrift(s.audio.glideCover(), s.ctrl, origin)).toBeLessThan(chordTolerance(seg.dur))
    for (const g of s.audio.glides()) expect(g.at + (g.seg?.dur ?? 0)).toBeLessThanOrEqual(origin + 63 + 1e-9)
    // 背景声那时正在淡出，最后一段照整段排，一直跟着画面上的曲线
    const bed = segCalls(s, 'breath', origin).at(-1)
    expect(bed?.seg).toBe(seg)
    expect(bed?.t).toBeCloseTo(60, 9)
    expect(maxDrift(s.audio.breathCover(), s.ctrl, origin)).toBeLessThan(1e-9)

    // 离结束不到 PACED_TAIL_SEC 才开始的一段不再排
    const tail = createTestSession()
    const short = pacedPlan(SLOW6, { plannedSec: 60 + PACED_TAIL_SEC / 2 })
    await tail.ctrl.start(short)
    await tail.advance(70_000)
    expect(segCalls(tail, 'breath', practiceOrigin(short)).at(-1)?.t).toBeCloseTo(55, 9)
  })

  it('reports phase changes and vibrates on them while running', async () => {
    const s = createTestSession()
    await s.ctrl.start(pacedPlan(SIGH, { plannedSec: 63 }))
    await s.advanceTo(-0.5)
    expect(s.platform.vibrations).toEqual([])
    expect(s.ctrl.getState().phaseIndex).toBe(-1)
    await s.advanceTo(21.01)
    expect(s.platform.vibrations).toEqual([40, 20, [30, 60, 30], 40, 20, [30, 60, 30], 40])
    expect(changes(s.states.map(st => st.phaseIndex))).toEqual([-1, 0, 1, 2, 0, 1, 2, 0])
  })

  it('does not vibrate on holds or when haptics are off', async () => {
    const box = createTestSession()
    await box.ctrl.start(pacedPlan(BOX, { plannedSec: 60 }))
    await box.advanceTo(16.5)
    expect(box.platform.vibrations).toEqual([40, [30, 60, 30], 40])

    const off = createTestSession()
    await off.ctrl.start(pacedPlan(SIGH, { plannedSec: 60, haptics: false }))
    await off.advanceTo(30)
    expect(off.platform.vibrations).toEqual([])
  })

  it('counts whole breaths when stopped early', async () => {
    const s = createTestSession()
    await s.ctrl.start(pacedPlan(SIGH, { plannedSec: 300 }))
    await s.advanceTo(31.4)
    s.ctrl.end()
    expect(s.results[0]).toMatchObject({ completed: false, breaths: 2, rateSteps: 0 })
  })

  it('follows a warm-up that slows from 8 breaths a minute', async () => {
    const s = createTestSession()
    const plan = slowPlan(5.5, { plannedSec: 120 })
    const pattern = patternOf(plan)
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    expect(s.ctrl.getState().rate).toBe(8)
    await s.advance(130_000)

    const expected: Array<{ seg: Segment; t: number }> = []
    for (const c of cyclesOf(pattern)) {
      if (c.start >= 120) break
      for (const seg of c.segs)
        if (c.start + seg.t0 < 120 - PACED_TAIL_SEC) expected.push({ seg, t: c.start + seg.t0 })
    }
    const breaths = segCalls(s, 'breath', origin)
    expect(breaths).toHaveLength(expected.length)
    for (const [i, call] of breaths.entries()) {
      // 背景声按这一轮实际的段长起伏
      expect(call.seg.key).toBe(expected[i]?.seg.key)
      expect(call.seg.dur).toBeCloseTo(expected[i]?.seg.dur ?? Number.NaN, 9)
      expect(call.t).toBeCloseTo(expected[i]?.t ?? Number.NaN, 9)
    }
    // 第一轮每分钟 8 次：一轮 7.5 秒，吸 3.07 秒（约「吸 3 · 呼 4.5」）
    expect(breaths[0]?.seg.dur).toBeCloseTo(7.5 * LONG_EXHALE_INHALE_FRACTION, 9)
    expect(s.platform.vibrations).toHaveLength(expected.length)
    expect(changes(s.states.map(st => st.rate))).toEqual([8, 7.5, 7, 6.5, 6, 5.5])
    expect(s.results[0]).toMatchObject({
      breaths: completedCycles(pattern, 120),
      finalRate: 5.5,
      rateSteps: 0,
    })
    expect(s.results[0]?.breaths).toBe(13)
  })
})

describe('step back (有点急)', () => {
  it('during the warm-up: speeds up from the current cycle, drops the rest of the warm-up and holds', async () => {
    const s = createTestSession()
    const plan = slowPlan(5.5, { plannedSec: 300 })
    const origin = practiceOrigin(plan)
    const before = paceOf(patternOf(plan))
    // 放慢：8 8 7.5 7.5 7 7 6.5 6.5 …；第 7 轮（序号 6）每分钟 6.5 次
    const c6 = nthCycle(before, 6)
    expect(c6.rate).toBe(6.5)
    await s.ctrl.start(plan)
    await s.advanceTo(c6.start + 1)
    const want = stepBack(before, s.ctrl.time())
    if (!want) throw new Error('「有点急」应当生效')
    s.ctrl.stepBack()
    expect(want).toMatchObject({ rate: 7 })
    expect(want.at).toBeCloseTo(c6.start + c6.T, 9)
    // 新速度在下一轮开头才生效；画面上将来的曲线马上就变
    expect(s.ctrl.getState().rate).toBe(6.5)
    const later = want.at + 3
    expect(s.ctrl.breathAt(later)).toEqual(paceAt(want.pace, later))
    expect(s.ctrl.breathAt(later)).not.toEqual(patternAt(patternOf(plan), later))

    await s.advanceTo(want.at + 0.05)
    expect(s.ctrl.getState().rate).toBe(7)
    await s.advance(400_000)
    expect(changes(s.states.map(st => st.rate))).toEqual([8, 7.5, 7, 6.5, 7])
    expectContinuousCover(s.audio, origin, 300)
    // 交界之后排出的每一段都按每分钟 7 次
    const after = segCalls(s, 'breath', origin).filter(c => c.t >= want.at - 1e-9)
    expectSegments(
      after,
      expectedSegments(want.pace, 300).filter(e => e.t >= want.at - 1e-9),
    )
    expect(s.results[0]).toMatchObject({
      completed: true,
      finalRate: 7,
      rateSteps: 1,
      breaths: paceBreaths(want.pace, 300),
    })
    expect(liveBells(s, 'end', origin)).toEqual([expect.closeTo(300, 9)])
  })

  it('in the warm-up cycles faster than 7: keeps slowing to 7, then holds 7 instead of slowing further', async () => {
    const s = createTestSession()
    const plan = slowPlan(5.5, { plannedSec: 120 })
    const before = paceOf(patternOf(plan))
    const c4 = nthCycle(before, 4)
    await s.ctrl.start(plan)
    await s.advanceTo(3)
    expect(s.ctrl.getState().rate).toBe(8)
    s.ctrl.stepBack()
    // 不往慢里调，也不超过 7：画面上将来的曲线照常放慢到 7 次，之后停在 7 次
    const want = stepBack(before, 3)
    expect(want).toMatchObject({ rate: 7 })
    expect(want?.at).toBeCloseTo(c4.start, 9)
    expect(s.ctrl.breathAt(c4.start + 30)).toEqual(paceAt(want?.pace ?? before, c4.start + 30))
    await s.advance(200_000)
    expect(changes(s.states.map(st => st.rate))).toEqual([8, 7.5, 7])
    expect(s.results[0]).toMatchObject({ completed: true, finalRate: 7, rateSteps: 1 })
  })

  it('mid-cycle in a steady pace: finishes this cycle, then holds the faster pace', async () => {
    const s = createTestSession()
    const plan = pacedPlan(SLOW6, { plannedSec: 120 })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    await s.advanceTo(33)
    const t = s.ctrl.time()
    s.ctrl.stepBack()
    expect(s.audio.callsTo('cancelScheduled')).toHaveLength(1)

    // 正在响的吸气滑音停在此刻，从当前音高沿吸气的曲线补上这一段剩下的 2 秒（拆成首尾相接的直线小段）
    const inhale = patternOf(plan).segs[0]
    if (!inhale) throw new Error('节拍里没有吸气')
    const cut = s.audio.glides().filter(g => g.stoppedAt !== null)
    expect(cut.map(g => g.at - origin)).toEqual([expect.closeTo(30, 9)])
    expect(cut[0]?.stoppedAt).toBeCloseTo(origin + t, 9)
    const rest = glideWindows(s, origin).filter(w => w.t > t - 1e-9 && w.t < 35 - 1e-6)
    expect(rest).toHaveLength(1)
    expect(rest[0]?.t).toBeCloseTo(t, 9)
    expect(rest[0]?.seg.key).toBe('in')
    expect(rest[0]?.seg.dur).toBeCloseTo(35 - t, 9)
    expect(rest[0]?.seg.y0).toBeCloseTo(paceAt(paceOf(patternOf(plan)), t).y, 9)
    expect(rest[0]?.seg.y1).toBe(1)
    const parts = segCalls(s, 'glide', origin).filter(c => c.t > t - 1e-9 && c.t < 35 - 1e-6)
    expect(parts.length).toBeGreaterThan(1)
    for (const p of parts) expect(p.seg.dur).toBeLessThanOrEqual(inhale.dur / PARTIAL_GLIDE_STEPS + 1e-9)
    // 背景声照整段吸气、从第 30 秒起再排一次：声音端口从停住的值沿原来的曲线接着走
    const again = s.audio.callsTo('breath').filter(c => Math.abs(c.time - origin - t) < 1e-9)
    expect(again[0]?.args[0]).toBe(inhale)
    expect((again[0]?.args[1] as number) - origin).toBeCloseTo(30, 9)
    // 结束钟声、背景声淡出照原样补上，只留一个
    expect(liveBells(s, 'end', origin)).toEqual([expect.closeTo(120, 9)])
    expect(s.audio.fade?.at).toBeCloseTo(origin + 120 - SHORT_SILENT_END_SEC, 9)

    // 生效前再点不算
    await s.advanceTo(36)
    s.ctrl.stepBack()
    expect(s.audio.callsTo('cancelScheduled')).toHaveLength(1)
    await s.advanceTo(40.05)
    expect(s.ctrl.getState().rate).toBe(6.5)
    // 生效以后再点：从下一轮起每分钟 7 次
    await s.advanceTo(45)
    s.ctrl.stepBack()
    expect(s.audio.callsTo('cancelScheduled')).toHaveLength(2)
    await s.advance(100_000)

    const first = stepBack(paceOf(patternOf(plan)), t)
    const second = first && stepBack(first.pace, 45)
    if (!second) throw new Error('两次「有点急」都应当生效')
    expect(second.at).toBeCloseTo(40 + 60 / 6.5, 6)
    expect(changes(s.states.map(st => st.rate))).toEqual([6, 6.5, 7])
    expectContinuousCover(s.audio, origin, 120)
    expect(s.results[0]).toMatchObject({ finalRate: 7, rateSteps: 2, breaths: paceBreaths(second.pace, 120) })
  })

  it('carries a nearly finished phase on the bed but adds no stub of a glide', async () => {
    const s = createTestSession()
    const plan = pacedPlan(SLOW6, { plannedSec: 120 })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    // 吸气到第 5 秒结束，只剩 0.3 秒
    await s.advanceTo(4.7)
    const t = s.ctrl.time()
    s.ctrl.stepBack()
    const at = (c: { t: number }): boolean => Math.abs(c.t - t) < 1e-9
    // 背景声照整段吸气再排一次，从此刻接着走完剩下的 0.3 秒
    const bed = s.audio.callsTo('breath').filter(c => Math.abs(c.time - origin - t) < 1e-9)
    expect(bed[0]?.args[0]).toBe(patternOf(plan).segs[0])
    expect((bed[0]?.args[1] as number) - origin).toBeCloseTo(0, 9)
    expect(5 - t).toBeLessThan(MIN_PARTIAL_GLIDE_SEC)
    expect(segCalls(s, 'glide', origin).filter(at)).toEqual([])
    // 下一段照常有滑音
    const next = segCalls(s, 'glide', origin).filter(c => c.t > t)
    expect(next[0]?.seg.key).toBe('out')
    expect(next[0]?.t).toBeCloseTo(5, 9)
  })

  it('waits for the cycle after next when the current one is about to end', async () => {
    const s = createTestSession()
    await s.ctrl.start(pacedPlan(SLOW6, { plannedSec: 120 }))
    await s.advanceTo(39.85)
    s.ctrl.stepBack()
    await s.advanceTo(49.9)
    expect(s.ctrl.getState().rate).toBe(6)
    await s.advanceTo(50.05)
    expect(s.ctrl.getState().rate).toBe(6.5)
  })

  it('re-plans a long background horizon and leaves exactly one end bell', async () => {
    const s = createTestSession()
    const plan = pacedPlan(SLOW6, { plannedSec: 120, cueStyle: 'ping' })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    await s.advanceTo(20)
    s.platform.setHidden(true)
    const latest = (): number => Math.max(...segCalls(s, 'breath', origin).map(c => c.t))
    expect(latest()).toBeGreaterThan(20 + HORIZON_HIDDEN_SEC - 10)

    await s.advanceTo(21)
    const now = s.ctrl.time()
    const want = stepBack(paceOf(patternOf(plan)), now)
    if (!want) throw new Error('「有点急」应当生效')
    s.ctrl.stepBack()
    expect(liveBells(s, 'end', origin)).toEqual([expect.closeTo(120, 9)])
    // 还排着的起伏和提示音都按新的节拍，仍排满 75 秒
    const ahead = expectedSegments(want.pace, 120).filter(e => e.t > now && e.t < now + HORIZON_HIDDEN_SEC)
    const live = s.audio.breathLog.filter(b => !b.cancelled && b.at - origin > now + 1e-9)
    expect(live.map(b => [b.seg.key, b.at - origin])).toEqual(ahead.map(e => [e.key, expect.closeTo(e.t, 6)]))
    const pings = s.audio.pending().filter(p => p.type === 'cue')
    expect(pings.map(p => [p.kind, p.at - origin])).toEqual(ahead.map(e => [e.key, expect.closeTo(e.t, 6)]))

    await s.advance(200_000)
    expect(s.results[0]).toMatchObject({ completed: true, rateSteps: 1, finalRate: 6.5 })
    expect(liveBells(s, 'end', origin)).toEqual([expect.closeTo(120, 9)])
    expectContinuousCover(s.audio, origin, 120)
  })

  it('changes the pace without any sound on the perf clock or with the cue style off', async () => {
    for (const setup of [{ unlockResult: false }, { cueStyle: 'off' as const }]) {
      const s = createTestSession({
        audio: { unlockResult: 'unlockResult' in setup ? setup.unlockResult : true },
      })
      const plan = pacedPlan(SLOW6, { plannedSec: 120, ...('cueStyle' in setup ? setup : {}) })
      await s.ctrl.start(plan)
      await s.advanceTo(33)
      s.ctrl.stepBack()
      expect(s.audio.callsTo('cancelScheduled')).toEqual([])
      await s.advance(200_000)
      expect(s.results[0]).toMatchObject({ finalRate: 6.5, rateSteps: 1 })
    }
  })

  it('is ignored unless a slow-breathing practice is running and can still change', async () => {
    const ignored = async (
      plan: SessionPlan,
      at: number,
      before?: (s: TestSession) => void,
    ): Promise<void> => {
      const s = createTestSession()
      await s.ctrl.start(plan)
      await s.advanceTo(at)
      before?.(s)
      const snapshot = s.ctrl.getState()
      s.ctrl.stepBack()
      expect(s.ctrl.getState()).toBe(snapshot)
      expect(s.audio.callsTo('cancelScheduled')).toEqual([])
      s.ctrl.end()
      expect(s.results[0]?.rateSteps ?? 0).toBe(0)
    }
    await ignored(pacedPlan(SIGH, { plannedSec: 120 }), 5)
    await ignored(pacedPlan(BOX, { plannedSec: 120 }), 5)
    await ignored(testPlan({ plannedSec: 120 }), 5)
    await ignored(pacedPlan(SLOW6, { plannedSec: 120 }), -1)
    await ignored(pacedPlan(SLOW6, { plannedSec: 120 }), 5, s => s.ctrl.pause())
    // 已经是每分钟 7 次（上限），或者本来就更快
    await ignored(pacedPlan({ type: 'resonance', rate: 7, ratio: 'long' }, { plannedSec: 120 }), 5)
    await ignored(pacedPlan({ type: 'resonance', rate: 8, ratio: 'long' }, { plannedSec: 120 }), 5)
    // 下一轮开头已在练习结束之后
    await ignored(pacedPlan(SLOW6, { plannedSec: 60 }), 55)
  })
})

describe('step back property', () => {
  it('keeps the bed on one continuous curve that matches the pace under random taps', async () => {
    let effective = 0
    for (let seed = 1; seed <= 16; seed++) {
      const rnd = mulberry32(seed)
      const s = createTestSession()
      const end = 300
      const plan = slowPlan(rnd() < 0.5 ? 5.5 : 4.5, {
        plannedSec: end,
        cueStyle: rnd() < 0.5 ? 'glide' : 'bed',
      })
      const origin = practiceOrigin(plan)
      await s.ctrl.start(plan)
      let pace = paceOf(patternOf(plan))
      let t = 3 + rnd() * 60
      for (let k = 0; k < 8; k++) {
        await s.advanceTo(t)
        if (rnd() < 0.3) s.platform.setHidden(!s.platform.hidden())
        const now = s.ctrl.time()
        const next = stepBack(pace, now)
        s.ctrl.stepBack()
        if (next && next.at < end && s.ctrl.getState().status === 'running') {
          pace = next.pace
          effective++
        }
        // 有时连点（生效前再点），有时隔很久
        t = now + (rnd() < 0.3 ? rnd() * 0.5 : 3 + rnd() * 45)
      }
      await s.advance(400_000)

      expectContinuousCover(s.audio, origin, end)
      // 节拍上的每一段都在它该开始的时刻起排过：没有漏排
      const cover = s.audio.breathCover()
      for (const e of expectedSegments(pace, end)) {
        const span = cover.find(c => Math.abs(c.from - origin - e.t) < 1e-6)
        expect(span?.seg.key).toBe(e.key)
        expect(span?.seg.dur).toBeCloseTo(e.dur, 6)
      }
      // 背景声跟的每一段都是节拍上那一刻的那一段：没有按旧节拍排的残留
      for (const span of cover) expect(paceAt(pace, span.from - origin + 1e-7).seg?.key).toBe(span.seg.key)
      // 补排的半段也在画面上的曲线上：背景声读数一致，滑音只差弦与弧之间的一点
      expect(maxDrift(cover, s.ctrl, origin, 0.02)).toBeLessThan(1e-9)
      const last = pace.at(-1)?.pattern.segs ?? []
      const tolerance = chordTolerance(Math.min(...last.map(seg => seg.dur)))
      expect(maxDrift(s.audio.glideCover(), s.ctrl, origin, 0.02)).toBeLessThan(tolerance)
      const live = s.audio.bells('end').filter(b => !b.cancelled)
      expect(live.map(b => b.at - origin)).toEqual([expect.closeTo(end, 9)])
      expect(s.results[0]).toMatchObject({
        breaths: paceBreaths(pace, end),
        finalRate: paceTarget(pace, end),
        rateSteps: paceSteps(pace, end),
      })
    }
    // 随机的点击里确实有不少生效了（上限是 7 次，到了就不再生效）
    expect(effective).toBeGreaterThanOrEqual(14)
    // 要把 16 次 5 分钟的练习整个模拟一遍：单独跑约 0.6 秒，和其他测试一起、机器忙时会超过默认的 5 秒
  }, 30_000)
})

describe('sound on the drawn breathing curve', () => {
  /** 往前走到 key 那一段里、进度在 lo–hi 之间的时刻 */
  async function advanceIntoPhase(s: TestSession, key: string, lo: number, hi: number): Promise<void> {
    for (let k = 0; k < 400; k++) {
      const p = s.ctrl.breathAt(s.ctrl.time())
      if (p?.seg?.key === key && p.progress > lo && p.progress < hi) return
      await s.advance(50)
    }
    throw new Error(`没有走到「${key}」的 ${lo}–${hi} 处`)
  }

  it('keeps the bed and the glide on the curve after 有点急 in the middle of an inhale', async () => {
    const s = createTestSession()
    const plan = slowPlan(5.5, { plannedSec: 300 })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    // 放慢走完以后，一口吸气的四分之一处
    await s.advanceTo(120)
    await advanceIntoPhase(s, 'in', 0.2, 0.3)
    const want = stepBack(paceOf(patternOf(plan)), s.ctrl.time())
    if (!want) throw new Error('「有点急」应当生效')
    s.ctrl.stepBack()
    expect(s.audio.callsTo('cancelScheduled')).toHaveLength(1)
    await s.advance(400_000)
    expect(s.results[0]).toMatchObject({ completed: true, rateSteps: 1 })
    // 背景声：撤销前、接着走的半段、之后的各段，读数都与画面一致（把缓动重新套在半段上时差到 0.1 以上）
    expect(maxDrift(s.audio.breathCover(), s.ctrl, origin)).toBeLessThan(1e-9)
    // 滑音：接着滑的半段拆成直线小段，只差弦与弧之间的一点
    const segs = want.pace.at(-1)?.pattern.segs ?? []
    expect(maxDrift(s.audio.glideCover(), s.ctrl, origin)).toBeLessThan(
      chordTolerance(Math.min(...segs.map(x => x.dur))),
    )
  })

  it('does not jump when one inhale is re-planned twice', async () => {
    const timeline = buildTimeline(BODY_SCAN_SCRIPT, 10)
    const plan = slowPlan(6, { plannedSec: timeline.duration, timeline })
    const feet = timeline.sections.find(x => x.id === 'feet')
    if (!feet) throw new Error('缺少段落')
    const s = createTestSession()
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    await s.advanceTo(feet.t0 + 1)
    await advanceIntoPhase(s, 'in', 0.2, 0.3)
    const want = stepBack(paceOf(patternOf(plan)), s.ctrl.time())
    if (!want) throw new Error('「有点急」应当生效')
    s.ctrl.stepBack()
    await s.advance(800)
    // 还在同一口吸气里、同一个段落里：跳过这一段，第二次重排
    expect(s.ctrl.breathAt(s.ctrl.time())?.seg?.key).toBe('in')
    expect(s.ctrl.getState().section?.id).toBe('feet')
    s.ctrl.skipSection()
    expect(s.audio.callsTo('cancelScheduled')).toHaveLength(2)
    await s.advance(1_000_000)
    const result = s.results[0]
    expect(result).toMatchObject({ completed: true, skipped: ['feet'], rateSteps: 1 })
    // 跳过之后结尾的话跟着提前；节拍在它开始后走完那一段就停下
    const end = result?.practicedSec ?? Number.NaN
    const stop = paceEndAt(want.pace, (timeline.closingT ?? Number.NaN) - (plan.plannedSec - end), end)
    expect(stop).toBeLessThan(end)
    expect(s.ctrl.breathAt(stop)).toBeNull()
    // 交界处的位置连续（从停住的值接着走，不从节拍上的读数重新起步），整条都在画面上的曲线上
    expectContinuousCover(s.audio, origin, stop)
    expect(maxDrift(s.audio.breathCover(), s.ctrl, origin)).toBeLessThan(1e-9)
    const shortest = Math.min(
      ...[...patternOf(plan).segs, ...(want.pace.at(-1)?.pattern.segs ?? [])].map(x => x.dur),
    )
    expect(maxDrift(s.audio.glideCover(), s.ctrl, origin)).toBeLessThan(chordTolerance(shortest))
  })
})

describe('breathAt', () => {
  it('follows the warm-up and returns null for practices without a pattern', async () => {
    const s = createTestSession()
    const plan = slowPlan(5.5, { plannedSec: 120 })
    expect(s.ctrl.breathAt(3)).toBeNull()
    await s.ctrl.start(plan)
    for (const t of [-2, 0, 3.1, 7.5, 50, 100])
      expect(s.ctrl.breathAt(t)).toEqual(patternAt(patternOf(plan), t))

    const focus = createTestSession()
    await focus.ctrl.start(testPlan())
    expect(focus.ctrl.breathAt(5)).toBeNull()
  })

  it('keeps answering after the practice ends, until reset', async () => {
    const s = createTestSession()
    const plan = pacedPlan(SLOW6, { plannedSec: 60 })
    await s.ctrl.start(plan)
    await s.advance(70_000)
    expect(s.ctrl.getState().status).toBe('done')
    expect(s.ctrl.breathAt(12)).toEqual(patternAt(patternOf(plan), 12))
    s.ctrl.reset()
    expect(s.ctrl.breathAt(12)).toBeNull()
  })
})

describe('count session', () => {
  /** 每隔 gapMs 点一次「这一口」，共 n 次 */
  async function taps(s: TestSession, n: number, gapMs: number): Promise<void> {
    for (let i = 0; i < n; i++) {
      s.ctrl.countTap('breath')
      await s.advance(gapMs)
    }
  }

  it('counts breaths, ninths and resets', async () => {
    const s = createTestSession()
    await s.ctrl.start(countPlan())
    expect(s.ctrl.getState().count).toEqual({
      current: 0,
      cycles: 0,
      correct: 0,
      errors: 0,
      resets: 0,
      invalid: 0,
    })
    s.ctrl.countTap('breath')
    expect(s.ctrl.getState().count?.current).toBe(0)

    await s.advanceTo(1)
    await taps(s, 8, 2000)
    expect(s.ctrl.getState().count?.current).toBe(8)
    s.ctrl.countTap('ninth')
    expect(s.ctrl.getState().count).toMatchObject({ current: 0, cycles: 1, correct: 1, errors: 0 })
    await taps(s, 5, 2000)
    s.ctrl.countTap('ninth')
    await taps(s, 10, 2000)
    s.ctrl.countTap('ninth')
    await taps(s, 2, 2000)
    s.ctrl.countTap('reset')
    const final = { current: 0, cycles: 3, correct: 1, errors: 2, resets: 1, invalid: 0 }
    expect(s.ctrl.getState().count).toEqual(final)
    expect(s.audio.cues('tap')).toHaveLength(25)
    expect(s.audio.cues('ninth')).toHaveLength(3)

    s.ctrl.pause()
    s.ctrl.countTap('breath')
    expect(s.ctrl.getState().count).toEqual(final)
    s.ctrl.end()
    expect(s.results[0]?.count).toEqual(final)
    expect(s.results[0]?.count).not.toBe(s.ctrl.getState().count)
  })

  it('marks a cycle tapped faster than one breath per 1.5 s as invalid, neither right nor wrong', async () => {
    const s = createTestSession()
    await s.ctrl.start(countPlan())
    await s.advanceTo(1)
    // 每秒点一下：不可能是跟着呼吸点的
    await taps(s, 8, 1000)
    s.ctrl.countTap('ninth')
    expect(s.ctrl.getState().count).toEqual({
      current: 0,
      cycles: 1,
      correct: 0,
      errors: 0,
      resets: 0,
      invalid: 1,
    })
    // 又快、数又不对：仍然只算无效
    await taps(s, 5, 1000)
    s.ctrl.countTap('ninth')
    // 稍慢于下限：照常判对错
    await taps(s, 8, 1600)
    s.ctrl.countTap('ninth')
    await taps(s, 7, 1600)
    s.ctrl.countTap('ninth')
    // 直接点第九口：没法算间隔，按错计
    s.ctrl.countTap('ninth')
    expect(s.ctrl.getState().count).toEqual({
      current: 0,
      cycles: 5,
      correct: 1,
      errors: 2,
      resets: 0,
      invalid: 2,
    })
    // 每一下都有提示音，无效的轮次也一样
    expect(s.audio.cues('ninth')).toHaveLength(5)
  })

  it('times a cycle in practice time, leaving pauses out, and restarts it after a reset', async () => {
    const s = createTestSession()
    await s.ctrl.start(countPlan())
    await s.advanceTo(1)
    await taps(s, 4, 1000)
    s.ctrl.pause()
    await s.advance(60_000)
    s.ctrl.resume()
    await taps(s, 4, 1000)
    s.ctrl.countTap('ninth')
    expect(s.ctrl.getState().count).toMatchObject({ cycles: 1, invalid: 1 })

    // 数乱了重来：前面那几下快的不算进下一轮
    await taps(s, 3, 200)
    s.ctrl.countTap('reset')
    await taps(s, 8, 2000)
    s.ctrl.countTap('ninth')
    expect(s.ctrl.getState().count).toMatchObject({ cycles: 2, correct: 1, resets: 1, invalid: 1 })
  })

  it('stays silent when cues are off and ignores taps in other kinds', async () => {
    const quiet = createTestSession()
    await quiet.ctrl.start(countPlan({ cues: false }))
    await quiet.advanceTo(1)
    quiet.ctrl.countTap('breath')
    await quiet.advance(2000)
    quiet.ctrl.countTap('ninth')
    expect(quiet.audio.callsTo('cue')).toHaveLength(0)
    expect(quiet.ctrl.getState().count).toMatchObject({ cycles: 1, errors: 1, invalid: 0 })

    const focus = createTestSession()
    await focus.ctrl.start(testPlan())
    await focus.advanceTo(1)
    focus.ctrl.countTap('breath')
    expect(focus.ctrl.getState().count).toBeNull()
  })
})

describe('guided session', () => {
  it('shows captions and speaks every line in order, on time', async () => {
    const s = createTestSession()
    const plan = guidedPlan(BREATHING_SPACE_SCRIPT, 3)
    const timeline = plan.timeline
    if (!timeline) throw new Error('缺少时间线')
    const captions: Array<SessionState['caption']> = []
    s.ctrl.subscribe(() => {
      const c = s.ctrl.getState().caption
      if (c !== captions.at(-1)) captions.push(c)
    })
    const startedAt = performance.now()
    await s.ctrl.start(plan)
    await s.advance(200_000)
    expect(s.ctrl.getState().status).toBe('done')

    const speaks = speakCues(plan)
    expect(s.voice.spoken).toEqual(speaks.map(c => c.text))
    const leadMs = (START_DELAY_SEC + leadFor(plan, true)) * 1000
    const said = s.voice.log.filter(e => e.type === 'speak')
    for (const [i, e] of said.entries()) {
      const late = e.at - (startedAt + leadMs + (speaks[i]?.t ?? 0) * 1000)
      expect(late).toBeGreaterThanOrEqual(0)
      expect(late).toBeLessThan(15)
      // 语气平稳时不带倍数
      expect(e.type === 'speak' && e.opts).toBeFalsy()
    }

    const shown = captions.filter(c => c !== null)
    expect(shown.map(c => c?.text)).toEqual(speaks.map(c => c.text))
    expect(shown.map(c => c?.section)).toEqual(speaks.map(c => c.sectionTitle ?? null))
    expect(shown[0]?.section).toBeNull()
    expect(shown.at(-1)?.section).toBeNull()
    // 段落提示音出现时，上一段的字幕先收起
    expect(captions.filter(c => c === null).length).toBeGreaterThanOrEqual(timeline.sections.length)

    const origin = practiceOrigin(plan)
    const sectionCues = timeline.cues.filter(c => c.kind === 'section')
    const chimes = s.audio.cues('section')
    expect(chimes).toHaveLength(sectionCues.length)
    for (const [i, c] of chimes.entries()) expect(c.at - origin).toBeCloseTo(sectionCues[i]?.t ?? 0, 9)
    for (const call of s.audio.callsTo('cue')) expect(call.args[1] as number).toBeGreaterThan(call.time)

    expect(changes(s.states.map(st => st.phaseIndex))).toEqual([-1, 0, 1, 2])
    expect(changes(s.states.map(st => st.section?.id ?? null))).toEqual([
      null,
      'aware',
      'gather',
      'expand',
      null,
    ])
    // 这几段都不能跳过
    expect(s.states.some(st => st.section?.skippable)).toBe(false)
  })

  it('reports which section is on and whether it can be skipped', async () => {
    const s = createTestSession()
    const plan = guidedPlan(LOVING_KINDNESS_SCRIPT, 20)
    const sections = plan.timeline?.sections ?? []
    await s.ctrl.start(plan)
    for (const [index, sec] of sections.entries()) {
      await s.advanceTo(sec.t0 + 2)
      expect(s.ctrl.getState().section).toEqual({
        index,
        id: sec.id,
        title: sec.title,
        skippable: sec.id === 'difficult',
      })
    }
    // 结尾的话不属于任何段落
    await s.advanceTo((sections.at(-1)?.t1 ?? 0) + 1)
    expect(s.ctrl.getState().section).toBeNull()
  })

  it('never offers to skip the last section, even when it is marked skippable', async () => {
    const script: GuidedScript = {
      ...BREATHING_SPACE_SCRIPT,
      sections: BREATHING_SPACE_SCRIPT.sections.map(sec => ({ ...sec, skippable: true })),
    }
    const s = createTestSession()
    const plan = guidedPlan(script, 3)
    const last = plan.timeline?.sections.at(-1)
    if (!last) throw new Error('没有段落')
    await s.ctrl.start(plan)
    await s.advanceTo(last.t0 + 2)
    expect(s.ctrl.getState().section).toMatchObject({ id: last.id, skippable: false })
    const snapshot = s.ctrl.getState()
    s.ctrl.skipSection()
    expect(s.ctrl.getState()).toBe(snapshot)
  })

  it('stops speaking while paused and never replays lines after resuming', async () => {
    const s = createTestSession()
    const plan = guidedPlan(BREATHING_SPACE_SCRIPT, 3)
    const speaks = speakCues(plan)
    await s.ctrl.start(plan)
    const second = speaks[1]
    if (!second) throw new Error('引导词太短')
    await s.advanceTo(second.t + 0.5)
    expect(s.voice.spoken).toEqual(speaks.slice(0, 2).map(c => c.text))

    s.ctrl.pause()
    expect(s.voice.log.at(-1)?.type).toBe('cancel')
    await s.advance(120_000)
    expect(s.voice.spoken).toHaveLength(2)

    s.ctrl.resume()
    await s.advance(200_000)
    expect(s.voice.spoken).toEqual(speaks.map(c => c.text))
  })

  it('keeps captions without reading when the voice is off or unavailable', async () => {
    for (const setup of [{ voice: false }, { available: false }]) {
      const s = createTestSession({ voice: { available: !('available' in setup) } })
      const plan = guidedPlan(BREATHING_SPACE_SCRIPT, 3, 'voice' in setup ? { voice: false } : {})
      await s.ctrl.start(plan)
      await s.advanceTo(30)
      expect(s.voice.spoken).toEqual([])
      expect(s.ctrl.getState().caption?.text).toBeTruthy()
    }
  })

  it('shows but does not read lines that are long overdue', async () => {
    const s = createTestSession({ session: noopTimers })
    const plan = guidedPlan(BREATHING_SPACE_SCRIPT, 3)
    const speaks = speakCues(plan)
    await s.ctrl.start(plan)
    const target = (speaks[4]?.t ?? 0) + 1
    // 后台定时器被冻结，很久之后才第一次处理
    vi.advanceTimersByTime((target + leadFor(plan, true) + START_DELAY_SEC) * 1000)
    s.platform.setHidden(true)
    const due = speaks.filter(c => c.t <= target)
    const fresh = due.filter(c => target - c.t <= SPEECH_LATE_TOLERANCE_SEC)
    expect(fresh.length).toBeLessThan(due.length)
    expect(s.voice.spoken).toEqual(fresh.map(c => c.text))
    expect(s.ctrl.getState().caption?.text).toBe(due.at(-1)?.text)
  })
})

describe('prosody', () => {
  it('reads each line at the rate and volume the settling timeline gives it', async () => {
    const s = createTestSession()
    const plan = guidedPlan(BREATHING_SPACE_SCRIPT, 3, {}, { prosody: 'settle' })
    expect(plan.prosody).toBe('settle')
    await s.ctrl.start(plan)
    await s.advance(200_000)
    const said = s.voice.log.flatMap(e => (e.type === 'speak' ? [e] : []))
    const speaks = speakCues(plan)
    expect(said.map(e => e.text)).toEqual(speaks.map(c => c.text))
    expect(said.map(e => e.opts)).toEqual(speaks.map(c => ({ rate: c.rate, volume: c.volume })))
    // 越往后越慢、越轻
    const rates = said.map(e => e.opts?.rate ?? Number.NaN)
    const volumes = said.map(e => e.opts?.volume ?? Number.NaN)
    for (let i = 1; i < said.length; i++) {
      expect(rates[i]).toBeLessThanOrEqual((rates[i - 1] ?? 0) + 1e-12)
      expect(volumes[i]).toBeLessThanOrEqual((volumes[i - 1] ?? 0) + 1e-12)
    }
    expect(rates[0]).toBeGreaterThan(0.99)
    expect(rates.at(-1)).toBeLessThan(0.92)
    expect(volumes.at(-1)).toBeLessThan(0.8)
  })

  it('only softens the voice when the plan settles but the timeline was laid out steady', async () => {
    const s = createTestSession()
    const plan = guidedPlan(BREATHING_SPACE_SCRIPT, 3, { prosody: 'settle' })
    await s.ctrl.start(plan)
    await s.advance(200_000)
    const said = s.voice.log.flatMap(e => (e.type === 'speak' ? [e] : []))
    const speaks = speakCues(plan)
    const duration = plan.timeline?.duration ?? 1
    expect(said.map(e => e.opts)).toEqual(
      speaks.map(c => ({ volume: expect.closeTo(settleTone(c.t / duration).volume, 12) })),
    )
  })
})

describe('skip section', () => {
  it('starts the next section now and ends the practice earlier by the same amount', async () => {
    const s = createTestSession()
    const plan = guidedPlan(BODY_SCAN_SCRIPT, 10)
    const tl = plan.timeline
    const [feet, legs] = tl?.sections ?? []
    if (!tl || !feet || !legs) throw new Error('缺少段落')
    const origin = practiceOrigin(plan)
    const feetLines = speakCues(plan).filter(c => c.sectionId === 'feet')
    const startedAt = performance.now()
    await s.ctrl.start(plan)
    // 双脚的第一句说完、第二句还没说时跳过
    await s.advanceTo((feetLines[0]?.t ?? 0) + 1)
    expect(s.ctrl.getState().section).toEqual({ index: 0, id: 'feet', title: '双脚', skippable: true })
    const t = s.ctrl.time()
    s.ctrl.skipSection()
    const delta = legs.t0 - (t + SKIP_LEAD_SEC)
    const end = 600 - delta
    expect(delta).toBeGreaterThan(60)
    expect(s.ctrl.getState().endSec).toBeCloseTo(end, 9)
    // 正在读的这一段不再读完
    expect(s.voice.log.at(-1)?.type).toBe('cancel')
    // 下一段的提示音马上响；结束钟声和背景声淡出一起提前，结束钟声只剩一个
    expect(s.audio.pending().filter(p => p.kind === 'section')[0]?.at).toBeCloseTo(
      origin + t + SKIP_LEAD_SEC,
      9,
    )
    expect(liveBells(s, 'end', origin)).toEqual([expect.closeTo(end, 9)])
    expect(s.audio.fade?.at).toBeCloseTo(origin + end - SILENT_END_SEC, 9)
    expect(s.audio.fade?.dur).toBe(SILENT_END_FADE_SEC)

    await s.advance(100)
    expect(s.ctrl.getState().section).toEqual({ index: 1, id: 'legs', title: '小腿和膝盖', skippable: true })
    await s.advance(1_000_000)
    expect(s.results[0]).toMatchObject({ completed: true, skipped: ['feet'] })
    expect(s.results[0]?.practicedSec).toBeCloseTo(end, 9)
    expect(changes(s.states.map(st => st.endSec))).toEqual([600, expect.closeTo(end, 9)])

    // 跳过的这一段剩下的话不再说；后面的话一句不少、不重复，按提前后的时刻说
    const dropped = feetLines.filter(c => c.t > t)
    expect(dropped.length).toBeGreaterThan(0)
    const kept = speakCues(plan).filter(c => !dropped.includes(c))
    expect(s.voice.spoken).toEqual(kept.map(c => c.text))
    const leadMs = (START_DELAY_SEC + leadFor(plan, true)) * 1000
    const said = s.voice.log.flatMap(e => (e.type === 'speak' ? [e] : []))
    for (const [i, e] of said.entries()) {
      const cue = kept[i]
      const at = (cue?.t ?? 0) - (cue && cue.t >= legs.t0 ? delta : 0)
      const late = e.at - (startedAt + leadMs + at * 1000)
      expect(late).toBeGreaterThanOrEqual(-1)
      expect(late).toBeLessThan(15)
    }
    expect(s.audio.bells('end').filter(b => !b.cancelled)).toHaveLength(1)
  })

  it('can skip several sections in a row and records them in order', async () => {
    const s = createTestSession()
    const plan = guidedPlan(BODY_SCAN_SCRIPT, 10)
    const [feet, , belly] = plan.timeline?.sections ?? []
    if (!feet || !belly) throw new Error('缺少段落')
    await s.ctrl.start(plan)
    await s.advanceTo(feet.t0 + 3)
    s.ctrl.skipSection()
    // 同一刻再点：还停在被跳过的这一段，不算第二次
    s.ctrl.skipSection()
    expect(s.audio.callsTo('cancelScheduled')).toHaveLength(1)
    await s.advance(100)
    expect(s.ctrl.getState().section?.id).toBe('legs')
    const t = s.ctrl.time()
    s.ctrl.skipSection()
    // 两次提前的总和：腹部从此刻开始，原本在 belly.t0
    expect(s.ctrl.getState().endSec).toBeCloseTo(600 - (belly.t0 - (t + SKIP_LEAD_SEC)), 9)
    await s.advance(100)
    expect(s.ctrl.getState().section?.id).toBe('belly')
    await s.advance(1_000_000)
    expect(s.results[0]).toMatchObject({ completed: true, skipped: ['feet', 'legs'] })
    expect(s.results[0]?.practicedSec).toBeCloseTo(600 - (belly.t0 - (t + SKIP_LEAD_SEC)), 9)
  })

  it('works on the perf clock too', async () => {
    const s = createTestSession({ audio: { unlockResult: false } })
    const plan = guidedPlan(BODY_SCAN_SCRIPT, 10)
    const legs = plan.timeline?.sections[1]
    if (!legs) throw new Error('缺少段落')
    await s.ctrl.start(plan)
    await s.advanceTo(40)
    const t = s.ctrl.time()
    s.ctrl.skipSection()
    const end = 600 - (legs.t0 - t - SKIP_LEAD_SEC)
    expect(s.ctrl.getState().endSec).toBeCloseTo(end, 9)
    await s.advance(1_000_000)
    expect(s.results[0]).toMatchObject({ completed: true, skipped: ['feet'] })
    expect(s.results[0]?.practicedSec).toBeCloseTo(end, 9)
  })

  it('does nothing outside a skippable section', async () => {
    const ignored = async (
      plan: SessionPlan,
      at: number,
      before?: (s: TestSession) => void,
    ): Promise<void> => {
      const s = createTestSession()
      await s.ctrl.start(plan)
      await s.advanceTo(at)
      before?.(s)
      const snapshot = s.ctrl.getState()
      s.ctrl.skipSection()
      expect(s.ctrl.getState()).toBe(snapshot)
      expect(s.audio.callsTo('cancelScheduled')).toEqual([])
      s.ctrl.end()
      expect(s.results[0]?.skipped).toEqual([])
    }
    const bodyScan = guidedPlan(BODY_SCAN_SCRIPT, 10)
    const sections = bodyScan.timeline?.sections ?? []
    const whole = sections.at(-1)
    if (!whole) throw new Error('缺少段落')
    // 开场、最后的全身、结尾、倒数中、暂停时
    await ignored(bodyScan, 5)
    await ignored(bodyScan, whole.t0 + 5)
    await ignored(bodyScan, whole.t1 + 2)
    await ignored(bodyScan, -1)
    await ignored(bodyScan, (sections[0]?.t0 ?? 0) + 5, s => s.ctrl.pause())
    // 不可跳过的段落、没有引导词的练习
    await ignored(guidedPlan(BREATHING_SPACE_SCRIPT, 3), 30)
    await ignored(testPlan(), 30)
  })
})

describe('timer session', () => {
  it('rings interval bells between the start and the end', async () => {
    const s = createTestSession()
    const plan = testPlan({ kind: 'timer', practiceId: 'timer', plannedSec: 600, intervalSec: 120 })
    await s.ctrl.start(plan)
    await s.advance(700_000)
    const origin = practiceOrigin(plan)
    const bells = s.audio.bells('interval').map(b => b.at - origin)
    expect(bells).toHaveLength(4)
    for (const [i, t] of [120, 240, 360, 480].entries()) expect(bells[i]).toBeCloseTo(t, 9)
    for (const call of s.audio.callsTo('bell')) expect(call.args[1] as number).toBeGreaterThan(call.time)
    expect(s.audio.bells('end')).toHaveLength(1)
  })

  it('leaves the last interval to the end bell', async () => {
    const s = createTestSession()
    const plan = testPlan({ kind: 'timer', practiceId: 'timer', plannedSec: 600, intervalSec: 150 })
    await s.ctrl.start(plan)
    await s.advance(700_000)
    expect(s.audio.bells('interval').map(b => Math.round(b.at - practiceOrigin(plan)))).toEqual([
      150, 300, 450,
    ])
  })

  it.each([null, 0])('rings no interval bells when the interval is %s', async intervalSec => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ kind: 'timer', practiceId: 'timer', plannedSec: 300, intervalSec }))
    await s.advance(400_000)
    expect(s.audio.bells('interval')).toEqual([])
  })
})

describe('listening (kind sound)', () => {
  it('plays without a start bell or voice and ends with the bell the plan asks for', async () => {
    const s = createTestSession()
    const plan = soundPlan({
      plannedSec: 1200,
      leadSec: 1,
      voice: true,
      timeline: { duration: 1200, cues: [{ t: 5, kind: 'speak', text: '听。' }], sections: [] },
    })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    expect(s.ctrl.time()).toBeCloseTo(-1 - START_DELAY_SEC, 9)
    expect(s.audio.bells('start')).toEqual([])
    expect(liveBells(s, 'end', origin)).toEqual([expect.closeTo(1200, 9)])
    await s.advanceTo(10)
    // 听声音不朗读，字幕照常
    expect(s.voice.spoken).toEqual([])
    expect(s.ctrl.getState().caption?.text).toBe('听。')
    await s.advance(1_300_000)
    expect(s.results[0]).toMatchObject({ completed: true, practicedSec: 1200, breaths: null })
  })

  it('runs without an end when unlimited, and counts ending it as complete', async () => {
    const s = createTestSession()
    const plan = soundPlan({
      plannedSec: 0,
      endBell: false,
      fadeInSec: 20,
      sound: { ...TEST_SOUND, mode: 'sleep' },
    })
    await s.ctrl.start(plan)
    expect(s.ctrl.getState()).toMatchObject({ status: 'lead', endSec: null })
    expect(s.audio.bells()).toEqual([])
    expect(s.audio.callsTo('fadeBedOut')).toEqual([])
    await s.advance(3_600_000)
    expect(s.ctrl.getState()).toMatchObject({ status: 'running', endSec: null, silentEnding: false })
    const t = s.ctrl.time()
    expect(t).toBeCloseTo(3600 - 3 - START_DELAY_SEC, 6)
    s.ctrl.end()
    expect(s.ctrl.getState()).toMatchObject({ status: 'done', endReason: 'complete' })
    expect(s.results).toEqual([
      expect.objectContaining({ completed: true, breaths: null, finalRate: null, rateSteps: 0, skipped: [] }),
    ])
    expect(s.results[0]?.practicedSec).toBeCloseTo(t, 6)
    // 用户停下的，不是到点：撤下排好的，背景声 1.5 秒淡出
    expect(s.audio.callsTo('cancelScheduled')).toHaveLength(1)
    expect(s.audio.callsTo('stopBed').map(c => c.args)).toEqual([[STOP_BED_FADE_SEC]])
    expect(s.voice.spoken).toEqual([])
  })

  it('keeps an unlimited session open even when it asks for an end bell', async () => {
    const s = createTestSession()
    await s.ctrl.start(soundPlan({ plannedSec: 0, endBell: true }))
    await s.advance(600_000)
    expect(s.ctrl.getState().status).toBe('running')
    expect(s.audio.bells()).toEqual([])
  })
})

describe('pause and resume', () => {
  it('stops the audio clock while paused', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ plannedSec: 120 }))
    await s.advanceTo(7)
    s.ctrl.pause()
    expect(s.ctrl.getState().status).toBe('paused')
    expect(s.audio.state()).toBe('suspended')
    expect(s.platform.awake).toBe(false)
    const frozen = s.ctrl.time()
    await s.advance(60_000)
    expect(s.ctrl.time()).toBe(frozen)
    s.ctrl.pause()

    s.ctrl.resume()
    expect(s.ctrl.getState().status).toBe('running')
    expect(s.audio.state()).toBe('running')
    expect(s.platform.awake).toBe(true)
    await s.advance(5000)
    expect(s.ctrl.time()).toBeCloseTo(frozen + 5, 6)

    await s.advanceTo(120)
    await s.advance(20)
    expect(s.results).toEqual([expect.objectContaining({ completed: true, practicedSec: 120 })])
    expect(s.audio.state()).toBe('running')
    expect(s.audio.callsTo('suspend')).toHaveLength(1)
  })

  it('leaves paused time out on the perf clock', async () => {
    const s = createTestSession({ audio: { unlockResult: false } })
    await s.ctrl.start(testPlan({ plannedSec: 120 }))
    expect(s.ctrl.time()).toBe(-3)
    await s.advance(10_000)
    s.ctrl.pause()
    await s.advance(60_000)
    expect(s.ctrl.time()).toBeCloseTo(7, 9)
    s.ctrl.resume()
    await s.advance(5000)
    expect(s.ctrl.time()).toBeCloseTo(12, 9)
    expect(s.audio.callsTo('suspend')).toHaveLength(0)
  })

  it('returns to the countdown when paused during it', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan())
    await s.advance(1000)
    s.ctrl.pause()
    await s.advance(5000)
    s.ctrl.resume()
    expect(s.ctrl.getState().status).toBe('lead')
    await s.advanceTo(0.5)
    expect(s.ctrl.getState().status).toBe('running')
  })

  it('does not take a state change reported while resuming for an interruption', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ plannedSec: 120 }))
    await s.advanceTo(10)
    s.ctrl.pause()
    const resume = s.audio.resume.bind(s.audio)
    // 有的端口在恢复时先同步报一次别的状态，再真正走起来
    vi.spyOn(s.audio, 'resume').mockImplementation(() => {
      s.audio.setState('interrupted')
      return resume()
    })
    s.ctrl.resume()
    expect(s.ctrl.getState().status).toBe('running')
    await s.advance(AUDIO_START_GRACE_MS + 100)
    expect(s.ctrl.getState()).toMatchObject({ status: 'running', audio: 'on' })
  })

  it('ends from pause with the practiced time and cancels pending sounds', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ kind: 'timer', practiceId: 'timer', plannedSec: 600, intervalSec: 60 }))
    await s.advanceTo(42)
    s.ctrl.pause()
    await s.advance(30_000)
    s.ctrl.end()
    const st = s.ctrl.getState()
    expect(st).toMatchObject({ status: 'done', endReason: 'stopped' })
    expect(st.practicedSec).toBeCloseTo(42, 6)
    expect(s.results).toEqual([expect.objectContaining({ completed: false })])
    expect(s.results[0]?.practicedSec).toBe(st.practicedSec)
    expect(s.audio.callsTo('cancelScheduled')).toHaveLength(1)
    // 暂停前声音已淡出、已挂起，停下时不再等淡出
    expect(s.audio.callsTo('stopBed').map(c => c.args)).toEqual([[0]])
    expect(s.audio.bells('end')[0]?.cancelled).toBe(true)
    expect(s.audio.pending()).toEqual([])
  })

  it('cancels the end bell and fades the bed when stopped early', async () => {
    const s = createTestSession()
    await s.ctrl.start(pacedPlan(SIGH, { plannedSec: 300 }))
    await s.advanceTo(30)
    s.ctrl.end()
    expect(s.audio.bells('end')[0]?.cancelled).toBe(true)
    expect(s.audio.pending()).toEqual([])
    expect(s.audio.callsTo('stopBed').map(c => c.args)).toEqual([[STOP_BED_FADE_SEC]])
    expect(s.results[0]?.practicedSec).toBeCloseTo(30, 6)
    const calls = s.audio.calls.length
    await s.advance(60_000)
    expect(s.audio.calls.length).toBe(calls)
  })
})

describe('starting', () => {
  it('ignores a second start while starting or running', async () => {
    const s = createTestSession({ audio: { unlockDelayMs: 50 } })
    const plan = testPlan()
    const a = s.ctrl.start(plan)
    const b = s.ctrl.start(plan)
    await s.advance(100)
    await Promise.all([a, b])
    await s.ctrl.start(plan)
    expect(s.audio.callsTo('unlock')).toHaveLength(1)
    expect(s.audio.callsTo('startBed')).toHaveLength(1)
    expect(s.ctrl.getState().status).toBe('lead')
  })

  it('can start a new practice straight after finishing', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ plannedSec: 60 }))
    await s.advanceTo(5)
    s.ctrl.end()
    vi.setSystemTime(new Date('2026-10-22T21:30:00+08:00'))
    await s.ctrl.start(testPlan({ plannedSec: 60 }))
    expect(s.ctrl.getState()).toMatchObject({ status: 'lead', startedAt: '2026-10-22T13:30:00.000Z' })
    await s.advance(70_000)
    expect(s.results.map(r => r.completed)).toEqual([false, true])
  })

  it('rejects invalid plans and options', async () => {
    const s = createTestSession()
    await expect(s.ctrl.start(testPlan({ plannedSec: -1 }))).rejects.toThrow(RangeError)
    await expect(s.ctrl.start(testPlan({ leadSec: Number.NaN }))).rejects.toThrow(RangeError)
    await expect(s.ctrl.start(testPlan({ fadeInSec: -2 }))).rejects.toThrow(RangeError)
    expect(s.audio.callsTo('unlock')).toHaveLength(0)
    const ports = { audio: new FakeAudioPort(), voice: new FakeVoice(), platform: new FakePlatform() }
    expect(() => createSessionController(ports, { timeScale: 0 })).toThrow(RangeError)
  })

  it('does nothing for user actions in the wrong state', () => {
    const s = createTestSession()
    s.ctrl.pause()
    s.ctrl.resume()
    s.ctrl.end()
    s.ctrl.mark()
    s.ctrl.countTap('breath')
    s.ctrl.stepBack()
    s.ctrl.skipSection()
    s.ctrl.setSound({ ambience: 'ocean' })
    s.ctrl.reset()
    expect(s.ctrl.getState()).toEqual(IDLE)
    expect(s.ctrl.breathAt(1)).toBeNull()
    expect(s.states).toEqual([])
    expect(s.audio.calls).toEqual([])
  })
})

describe('when the browser blocks audio', () => {
  it('falls back to a silent perf clock after the grace period', async () => {
    const s = createTestSession({ audio: { stateAfterUnlock: 'suspended' } })
    await s.ctrl.start(testPlan({ plannedSec: 240 }))
    expect(s.ctrl.getState().audio).toBe('on')
    await s.advance(1000)
    const frozen = s.ctrl.time()
    expect(frozen).toBeCloseTo(-3 - START_DELAY_SEC, 9)
    await s.advance(AUDIO_START_GRACE_MS - 1000)
    expect(s.ctrl.getState().audio).toBe('blocked')
    expect(s.audio.callsTo('cancelScheduled')).toHaveLength(1)
    expect(s.audio.callsTo('stopBed').map(c => c.args)).toEqual([[0]])
    expect(s.audio.bells('end')[0]?.cancelled).toBe(true)

    const calls = s.audio.calls.length
    await s.advance(1000)
    expect(s.ctrl.time()).toBeCloseTo(frozen + 1, 9)
    await s.advance(300_000)
    expect(s.ctrl.getState()).toMatchObject({ status: 'done', silentEnding: false })
    expect(s.results[0]).toMatchObject({ completed: true, practicedSec: 240 })
    expect(s.audio.calls.length).toBe(calls)
  })

  it('starts silently when the audio cannot be unlocked', async () => {
    const s = createTestSession({ audio: { unlockResult: false } })
    await s.ctrl.start(testPlan({ plannedSec: 60 }))
    expect(s.ctrl.getState().audio).toBe('blocked')
    await s.advance(70_000)
    expect(s.ctrl.getState().status).toBe('done')
    expect(s.audio.calls.map(c => c.method)).toEqual(['unlock'])
  })

  it('reports no audio when the device has none', async () => {
    const s = createTestSession({ audio: { unlockResult: false, initialState: 'unavailable' } })
    await s.ctrl.start(testPlan())
    expect(s.ctrl.getState().audio).toBe('off')
  })

  it('gives up waiting for an unlock that never returns', async () => {
    const s = createTestSession({ audio: { unlockDelayMs: Number.POSITIVE_INFINITY } })
    const started = s.ctrl.start(testPlan())
    await s.advance(UNLOCK_TIMEOUT_MS - 1)
    expect(s.ctrl.getState().status).toBe('idle')
    await s.advance(1)
    await started
    expect(s.ctrl.getState()).toMatchObject({ status: 'lead', audio: 'blocked' })
  })

  it('survives an unlock that throws', async () => {
    const s = createTestSession()
    vi.spyOn(s.audio, 'unlock').mockImplementation(() => {
      throw new Error('没有 AudioContext')
    })
    await s.ctrl.start(testPlan())
    expect(s.ctrl.getState()).toMatchObject({ status: 'lead', audio: 'blocked' })
  })

  it('stays silent and runs faster with a time scale', async () => {
    const s = createTestSession({ session: { timeScale: 10 } })
    await s.ctrl.start(testPlan({ plannedSec: 60, leadSec: 3 }))
    expect(s.ctrl.getState().audio).toBe('off')
    await s.advance(6299)
    expect(s.ctrl.getState().status).toBe('running')
    await s.advance(15)
    expect(s.ctrl.getState().status).toBe('done')
    expect(s.audio.calls.map(c => c.method)).toEqual(['unlock'])
  })
})

describe('audio interruptions', () => {
  it('pauses on an interruption and resumes cleanly', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ plannedSec: 120 }))
    await s.advanceTo(20)
    s.audio.setState('interrupted')
    expect(s.ctrl.getState().status).toBe('paused')
    expect(s.voice.cancels).toBe(1)
    const frozen = s.ctrl.time()
    await s.advance(30_000)
    expect(s.ctrl.time()).toBe(frozen)
    s.ctrl.resume()
    expect(s.ctrl.getState().status).toBe('running')
    await s.advance(1000)
    expect(s.ctrl.time()).toBeCloseTo(frozen + 1, 6)
    await s.advance(AUDIO_START_GRACE_MS)
    expect(s.ctrl.getState().audio).toBe('on')
  })

  it('re-suspends audio that the system restarts during a pause', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ plannedSec: 120 }))
    await s.advanceTo(5)
    s.ctrl.pause()
    s.audio.setState('running')
    expect(s.audio.state()).toBe('suspended')
    expect(s.ctrl.getState().status).toBe('paused')
  })

  it('does not mistake a slow start for an interruption', async () => {
    const s = createTestSession({ audio: { stateAfterUnlock: 'suspended' } })
    await s.ctrl.start(testPlan())
    s.audio.setState('interrupted')
    expect(s.ctrl.getState().status).toBe('lead')
    s.audio.setState('running')
    await s.advance(AUDIO_START_GRACE_MS + 100)
    expect(s.ctrl.getState()).toMatchObject({ status: 'lead', audio: 'on' })
    s.audio.setState('suspended')
    expect(s.ctrl.getState().status).toBe('paused')
  })

  it('continues silently if the audio does not come back after resuming', async () => {
    const s = createTestSession({ audio: { resumeWorks: false } })
    await s.ctrl.start(testPlan({ plannedSec: 120 }))
    await s.advanceTo(10)
    s.ctrl.pause()
    s.ctrl.resume()
    expect(s.ctrl.getState().status).toBe('running')
    await s.advance(AUDIO_START_GRACE_MS)
    expect(s.ctrl.getState().audio).toBe('blocked')
    const t = s.ctrl.time()
    await s.advance(1000)
    expect(s.ctrl.time()).toBeCloseTo(t + 1, 9)
  })
})

describe('page visibility', () => {
  it('fills a long horizon as soon as the page goes to the background', async () => {
    const s = createTestSession()
    const plan = pacedPlan(SIGH, { plannedSec: 600 })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    await s.advanceTo(10)
    const latest = (): number => Math.max(...segCalls(s, 'breath', origin).map(c => c.t))
    expect(latest()).toBeLessThan(10 + HORIZON_VISIBLE_SEC + 1e-6)
    s.platform.setHidden(true)
    expect(latest()).toBeGreaterThan(10 + HORIZON_HIDDEN_SEC - 11)
    expect(latest()).toBeLessThan(10 + HORIZON_HIDDEN_SEC + 1e-6)
  })

  it('asks for the screen to stay on again when the page returns', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan())
    s.platform.setHidden(true)
    s.platform.setHidden(false)
    expect(s.platform.awakeLog).toEqual([true, true])
    s.ctrl.pause()
    s.platform.setHidden(true)
    s.platform.setHidden(false)
    expect(s.platform.awakeLog).toEqual([true, true, false])
  })
})

describe('state and listeners', () => {
  it('emits only on changes and never mutates old snapshots', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ plannedSec: 600 }))
    await s.advanceTo(1)
    const snapshot = s.ctrl.getState()
    const emitted = s.states.length
    await s.advance(10_000)
    expect(s.states.length).toBe(emitted)
    expect(s.ctrl.getState()).toBe(snapshot)
    s.ctrl.mark()
    expect(s.ctrl.getState()).not.toBe(snapshot)
    expect(snapshot.marks).toEqual([])
  })

  it('emits nothing between phase changes of a paced practice', async () => {
    const s = createTestSession()
    await s.ctrl.start(pacedPlan(SLOW6, { plannedSec: 120 }))
    await s.advanceTo(1)
    const emitted = s.states.length
    // 第 1–5 秒都在第一口吸气里
    await s.advanceTo(4.9)
    expect(s.states.length).toBe(emitted)
    await s.advanceTo(5.1)
    expect(s.states.length).toBe(emitted + 1)
  })

  it('stops notifying after unsubscribing', async () => {
    const s = createTestSession()
    const listener = vi.fn()
    const finished = vi.fn()
    const off = s.ctrl.subscribe(listener)
    const offFinish = s.ctrl.onFinish(finished)
    off()
    offFinish()
    await s.ctrl.start(testPlan({ plannedSec: 60 }))
    await s.advance(70_000)
    expect(listener).not.toHaveBeenCalled()
    expect(finished).not.toHaveBeenCalled()
    expect(s.results).toHaveLength(1)
  })

  it('keeps going when a listener throws', async () => {
    const errors: unknown[] = []
    vi.stubGlobal('queueMicrotask', (fn: () => void) => {
      try {
        fn()
      } catch (err) {
        errors.push(err)
      }
    })
    const s = createTestSession()
    s.ctrl.subscribe(() => {
      throw new Error('界面出错')
    })
    s.ctrl.onFinish(() => {
      throw new Error('保存出错')
    })
    await s.ctrl.start(testPlan({ plannedSec: 60 }))
    await s.advance(70_000)
    expect(s.results).toHaveLength(1)
    expect(s.ctrl.getState().status).toBe('done')
    expect(errors.map(e => (e as Error).message)).toContain('保存出错')
  })

  it('changes the sound mid-practice and records the final choice', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ plannedSec: 60 }))
    s.ctrl.setSound({ ambience: 'ocean', ambienceVolume: 30 })
    expect(s.audio.callsTo('changeBed').map(c => c.args)).toEqual([
      [{ ambience: 'ocean', ambienceVolume: 30 }],
    ])
    expect(s.ctrl.getState().plan?.sound).toEqual({ ...TEST_SOUND, ambience: 'ocean', ambienceVolume: 30 })
    await s.advance(70_000)
    expect(s.results[0]?.plan.sound.ambience).toBe('ocean')
    s.ctrl.setSound({ music: 'drone' })
    expect(s.audio.callsTo('changeBed')).toHaveLength(1)
  })
})

describe('paced practice with spoken guidance', () => {
  // 呼吸练习的引导词不分段，免得段落提示音混进节拍
  const SIGH_SCRIPT: GuidedScript = {
    id: 'cyclic-sigh',
    title: '周期性叹息',
    minMinutes: 1,
    maxMinutes: 5,
    opening: [
      { text: '用鼻子吸气，快满时再补吸一小口。' },
      { text: '', pause: 8 },
      { text: '用嘴慢慢呼出。' },
    ],
    sections: [],
    closing: [{ text: '回到自然的呼吸。' }],
  }

  it('keeps the phase index on the breath and vibrates once per phase', async () => {
    const s = createTestSession()
    const timeline = buildTimeline(SIGH_SCRIPT, 1)
    const plan = pacedPlan(SIGH, { plannedSec: timeline.duration, timeline })
    await s.ctrl.start(plan)
    await s.advance(70_000)
    expect(s.ctrl.getState().status).toBe('done')

    // 结尾的话从第 46.5 秒起（第 5 轮的呼气里）：这一轮走完（第 52.5 秒）节拍就停下，序号回到 -1，不再振动
    expect(timeline.closingT).toBeCloseTo(
      60 - DEFAULT_END_BUFFER_SEC - lineSec({ text: '回到自然的呼吸。' }),
      9,
    )
    expect(changes(s.states.map(st => st.phaseIndex))).toEqual([
      -1,
      ...Array.from({ length: 5 }, () => [0, 1, 2]).flat(),
      -1,
    ])
    expect(s.platform.vibrations).toEqual(Array.from({ length: 5 }, () => [40, 20, [30, 60, 30]]).flat())
    // 引导词照常朗读、显示，不属于任何段落，也没有段落提示音
    expect(s.voice.spoken).toEqual(speakCues(plan).map(c => c.text))
    expect(s.states.some(st => st.caption?.text === '用嘴慢慢呼出。' && st.caption.section === null)).toBe(
      true,
    )
    expect(s.audio.cues('section')).toEqual([])
    expect(s.audio.callsTo('freeRun')).toEqual([])
  })
})

describe('guided speech details', () => {
  it('reads the spoken form but shows the caption text', async () => {
    const script: GuidedScript = {
      id: 'breath-count',
      title: '数息',
      minMinutes: 1,
      maxMinutes: 5,
      opening: [{ text: '忘了，就点「数乱了」。', say: '忘了，就点下方那个按钮。' }, { text: '回到一。' }],
      sections: [],
      closing: [],
    }
    const s = createTestSession()
    await s.ctrl.start(countPlan({ plannedSec: 60, timeline: buildTimeline(script, 1) }))
    await s.advanceTo(15)
    expect(s.voice.spoken).toEqual(['忘了，就点下方那个按钮。', '回到一。'])
    const captions = changes(s.states.flatMap(st => (st.caption ? [st.caption.text] : [])))
    expect(captions).toEqual(['忘了，就点「数乱了」。', '回到一。'])
  })

  it('rings chime cues as interval bells ahead of time', async () => {
    const s = createTestSession()
    const plan = testPlan({
      kind: 'guided',
      plannedSec: 60,
      timeline: {
        duration: 60,
        cues: [
          { t: 10, kind: 'chime' },
          { t: 20, kind: 'speak', text: '听。' },
        ],
        sections: [],
      },
    })
    await s.ctrl.start(plan)
    await s.advanceTo(5)
    const [chime] = s.audio.bells('interval')
    expect(chime?.at).toBeCloseTo(practiceOrigin(plan) + 10, 9)
    await s.advanceTo(21)
    // 手写的提示没有 dur：按字数和默认语速估算
    expect(s.ctrl.getState().caption).toEqual({
      text: '听。',
      section: null,
      t: 20,
      dur: speakSec({ text: '听。' }),
    })
    expect(s.audio.bells('interval')).toHaveLength(1)
    // 钟声之后才 10 秒：钟声也算打破安静，这一句不另响
    expect(s.audio.cues('caption')).toEqual([])
  })
})

describe('captions (text guidance)', () => {
  it('shows each line with the moment it appeared and its reading time, until the next line or section', async () => {
    const s = createTestSession()
    const plan = guidedPlan(BREATHING_SPACE_SCRIPT, 3)
    const speaks = speakCues(plan)
    await s.ctrl.start(plan)
    await s.advance(200_000)
    const shown = changes(s.states.map(st => st.caption)).filter(c => c !== null)
    expect(shown).toEqual(
      speaks.map(c => ({ text: c.text, section: c.sectionTitle ?? null, t: c.t, dur: c.dur })),
    )
    for (const c of speaks) expect(c.dur).toBeCloseTo(speakSec({ text: c.text ?? '' }), 9)
    // 结束时收起
    expect(s.ctrl.getState().caption).toBeNull()
  })

  it('rings a soft cue ahead of time when a line follows 20 s of quiet, not after a section chime', async () => {
    const s = createTestSession()
    const timeline: Timeline = {
      duration: 120,
      cues: [
        { t: 1, kind: 'speak', text: '开始。', dur: 1 },
        // 上一句读完（第 2 秒）到这里安静了 19.5 秒：不响
        { t: 21.5, kind: 'speak', text: '一。', dur: 0.5 },
        // 安静了 20 秒：响
        { t: 42, kind: 'speak', text: '二。', dur: 0.5 },
        { t: 70, kind: 'section', sectionId: 'b', sectionTitle: '乙' },
        // 段落提示音之后 1.5 秒：提示音已经打破安静，不另响
        { t: 71.5, kind: 'speak', text: '三。', sectionId: 'b', sectionTitle: '乙', dur: 0.5 },
        // 没有 dur：按字数估算，上一句读完到这里超过 20 秒
        { t: 95, kind: 'speak', text: '四。', sectionId: 'b', sectionTitle: '乙' },
      ],
      sections: [{ id: 'b', title: '乙', t0: 70, t1: 120 }],
    }
    expect(captionCueTimes(timeline, true)).toEqual([42, 95])
    // 段落提示音不响时，段落开头的那一句照样算安静了多久
    expect(captionCueTimes(timeline, false)).toEqual([42, 71.5, 95])
    // 第一句之前安静了 20 秒以上也响
    expect(
      captionCueTimes({ duration: 60, cues: [{ t: 25, kind: 'speak', text: '一。' }], sections: [] }, true),
    ).toEqual([25])

    const plan = testPlan({ kind: 'guided', practiceId: 'body-scan', plannedSec: 120, timeline })
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    await s.advanceTo(30)
    expect(s.audio.cues('caption')).toEqual([])
    // 前瞻排进声音时间线：第 42 秒那一声提前几秒就排好了
    await s.advanceTo(42 - HORIZON_VISIBLE_SEC + 0.5)
    expect(s.audio.cues('caption').map(c => c.at - origin)).toEqual([expect.closeTo(42, 9)])
    await s.advance(200_000)
    expect(s.audio.cues('caption').map(c => c.at - origin)).toEqual([
      expect.closeTo(42, 9),
      expect.closeTo(95, 9),
    ])
    for (const call of s.audio.callsTo('cue')) expect(call.args[1] as number).toBeGreaterThan(call.time)
    expect(s.audio.cues('section').map(c => c.at - origin)).toEqual([expect.closeTo(70, 9)])
  })

  it('uses a 20 s quiet threshold and needs no voice port (v1 has no voice guidance)', async () => {
    expect(CAPTION_CUE_GAP_SEC).toBe(20)
    expect(NULL_VOICE.available()).toBe(false)
    expect(Object.isFrozen(NULL_VOICE)).toBe(true)
    const audio = new FakeAudioPort()
    const ctrl = createSessionController({ audio, platform: new FakePlatform() })
    const plan = guidedPlan(BREATHING_SPACE_SCRIPT, 3)
    await ctrl.start(plan)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(ctrl.getState().caption?.text).toBeTruthy()
    ctrl.end()
    expect(ctrl.getState().status).toBe('done')
  })

  it('stays silent when the setting is off, for listening and without sound', async () => {
    const timeline: Timeline = {
      duration: 60,
      cues: [{ t: 30, kind: 'speak', text: '听。', dur: 0.5 }],
      sections: [],
    }
    for (const plan of [
      testPlan({ kind: 'guided', plannedSec: 60, timeline, captionCue: false }),
      soundPlan({ plannedSec: 60, timeline, captionCue: true }),
    ]) {
      const s = createTestSession()
      await s.ctrl.start(plan)
      await s.advance(80_000)
      expect(s.audio.cues('caption')).toEqual([])
      expect(s.results[0]?.completed).toBe(true)
    }
    const muted = createTestSession({ audio: { unlockResult: false } })
    await muted.ctrl.start(testPlan({ kind: 'guided', plannedSec: 60, timeline }))
    await muted.advance(80_000)
    expect(muted.audio.cues()).toEqual([])
  })

  it('moves the cue with the line when a section is skipped', async () => {
    const s = createTestSession()
    const plan = guidedPlan(BODY_SCAN_SCRIPT, 10)
    const tl = plan.timeline
    if (!tl) throw new Error('缺少时间线')
    const feet = tl.sections.find(x => x.id === 'feet')
    if (!feet) throw new Error('缺少段落')
    const origin = practiceOrigin(plan)
    await s.ctrl.start(plan)
    await s.advanceTo(feet.t0 + 3)
    s.ctrl.skipSection()
    const delta = plan.plannedSec - (s.ctrl.getState().endSec ?? Number.NaN)
    expect(delta).toBeGreaterThan(0)
    await s.advance(1_000_000)
    // 跳过之后每一声都按提前了的时间线：落在那时显示的那一句上
    const shownAt = new Set(changes(s.states.map(st => st.caption)).flatMap(c => (c ? [c.t] : [])))
    const rung = s.audio.cues('caption').filter(c => !c.cancelled)
    expect(rung.length).toBeGreaterThan(0)
    for (const c of rung) expect(shownAt.has(c.at - origin)).toBe(true)
  })
})

describe('bells setting', () => {
  it('rings neither the start nor the end bell when bells are off, and keeps the ending', async () => {
    const s = createTestSession()
    const plan = testPlan({ plannedSec: 300, bells: false })
    const origin = practiceOrigin(plan)
    // 没有开始钟声，倒数不必为了钟声拉长
    expect(leadFor(plan, true)).toBe(plan.leadSec)
    await s.ctrl.start(plan)
    await s.advance(400_000)
    expect(s.audio.bells()).toEqual([])
    // 静默收尾照常：最后 60 秒用 30 秒淡出
    expect(s.audio.callsTo('fadeBedOut')[0]?.args).toEqual([
      expect.closeTo(origin + 300 - SILENT_END_SEC, 9),
      SILENT_END_FADE_SEC,
    ])
    expect(s.states.some(st => st.silentEnding)).toBe(true)
    expect(s.results[0]).toMatchObject({ completed: true, practicedSec: 300 })
    expect(endingOf(300, true, true, false)).toEqual({
      bell: null,
      fade: { at: 300 - SILENT_END_SEC, dur: SILENT_END_FADE_SEC },
      silentAt: 300 - SILENT_END_SEC,
    })
  })

  it('still rings interval bells, which have their own setting', async () => {
    const s = createTestSession()
    const plan = testPlan({
      kind: 'timer',
      practiceId: 'timer',
      plannedSec: 600,
      intervalSec: 300,
      bells: false,
    })
    await s.ctrl.start(plan)
    await s.advance(700_000)
    expect(s.audio.bells().map(b => b.kind)).toEqual(['interval'])
  })
})

describe('paced practice with an intro script: the pacer stops at the closing', () => {
  /** 慢呼吸的引导词：开场一句，结尾一句「不用再跟着节拍」，再留 13 秒自然呼吸 */
  const SLOW_SCRIPT: GuidedScript = {
    id: 'slow',
    title: '慢呼吸',
    minMinutes: 1,
    maxMinutes: 5,
    opening: [{ text: '轻柔地呼吸。' }],
    sections: [],
    closing: [{ text: '不用再跟着节拍，自然地呼吸。' }, { text: '', pause: 13 }],
  }

  async function run(cueStyle: CueStyle, steps: readonly number[] = []) {
    const timeline = buildTimeline(SLOW_SCRIPT, 2)
    const plan = pacedPlan(SLOW6, { plannedSec: timeline.duration, timeline, cueStyle })
    const s = createTestSession()
    await s.ctrl.start(plan)
    for (const t of steps) {
      await s.advanceTo(t)
      s.ctrl.stepBack()
    }
    return { s, plan, timeline, origin: practiceOrigin(plan) }
  }

  it('finishes the phase in progress when the closing lines start, then draws, plays and vibrates nothing more', async () => {
    const { s, plan, timeline, origin } = await run('glide')
    const closing = timeline.closingT ?? Number.NaN
    // 每分钟 6 次、吸呼各 5 秒：结尾的话在第 120 − 10 − 结尾用时 秒开始，那一段走完就停
    expect(closing).toBeCloseTo(120 - DEFAULT_END_BUFFER_SEC - 13 - lineSec(SLOW_SCRIPT.closing[0]!), 9)
    const stop = Math.ceil(closing / 5) * 5
    expect(paceEndAt(paceOf(patternOf(plan)), closing, 120)).toBeCloseTo(stop, 9)
    await s.advanceTo(closing - 1)
    expect(s.ctrl.breathAt(closing)).not.toBeNull()
    expect(s.ctrl.breathAt(stop - 0.01)).not.toBeNull()
    expect(s.ctrl.breathAt(stop)).toBeNull()
    expect(s.ctrl.breathAt(stop + 10)).toBeNull()
    await s.advanceTo(stop + 1)
    expect(s.ctrl.getState().phaseIndex).toBe(-1)
    expect(s.ctrl.getState().caption?.text).toBe('不用再跟着节拍，自然地呼吸。')
    await s.advance(200_000)
    const result = s.results[0]
    expect(result).toMatchObject({
      completed: true,
      practicedSec: 120,
      breaths: Math.floor(stop / 10),
      rateSteps: 0,
    })
    // 背景声的起伏、滑音都停在那一段的末尾，整段排、不截半截；之后什么也不排
    for (const call of [...s.audio.callsTo('breath'), ...s.audio.callsTo('glide')]) {
      const seg = call.args[0] as Segment
      expect((call.args[1] as number) - origin + seg.dur).toBeLessThanOrEqual(stop + 1e-9)
    }
    const lastGlide = segCalls(s, 'glide', origin).at(-1)
    expect((lastGlide?.t ?? 0) + (lastGlide?.seg.dur ?? 0)).toBeCloseTo(stop, 9)
    expect(lastGlide?.seg.dur).toBe(5)
    // 一段一次振动，只振到停下为止
    expect(s.platform.vibrations).toHaveLength(stop / 5)
    // 小结页的曲线也画到停下为止
    expect(s.ctrl.breathAt(stop - 1)).not.toBeNull()
    expect(s.ctrl.breathAt(stop)).toBeNull()
    // 结束钟声照常
    expect(liveBells(s, 'end', origin)).toEqual([expect.closeTo(120, 9)])
  })

  it('plays no ping after the stop and ignores 有点急 once it can no longer take effect before it', async () => {
    const timeline = buildTimeline(SLOW_SCRIPT, 2)
    const stop = Math.ceil((timeline.closingT ?? 0) / 5) * 5
    // 第 stop − 2 秒点：下一轮在节拍停下之后才开始，来不及生效；停下以后再点也一样
    const { s, origin } = await run('ping', [stop - 2, stop + 2])
    await s.advance(200_000)
    expect(
      s.audio
        .cues()
        .filter(c => c.kind === 'in' || c.kind === 'out')
        .every(c => c.at - origin < stop),
    ).toBe(true)
    expect(s.results[0]?.rateSteps).toBe(0)
    expect(s.audio.callsTo('cancelScheduled')).toEqual([])
  })

  it('moves the stop with the pace when 有点急 takes effect before the closing', async () => {
    const timeline = buildTimeline(SLOW_SCRIPT, 2)
    const closing = timeline.closingT ?? Number.NaN
    const { s, plan, origin } = await run('glide', [3])
    const want = stepBack(paceOf(patternOf(plan)), 3)
    if (!want) throw new Error('「有点急」应当生效')
    const stop = paceEndAt(want.pace, closing, 120)
    expect(stop).toBeGreaterThanOrEqual(closing)
    await s.advance(200_000)
    expect(s.results[0]).toMatchObject({
      rateSteps: 1,
      finalRate: 6.5,
      breaths: paceBreaths(want.pace, stop),
    })
    for (const g of segCalls(s, 'glide', origin)) expect(g.t + g.seg.dur).toBeLessThanOrEqual(stop + 1e-9)
    expect(s.ctrl.breathAt(stop)).toBeNull()
  })

  it('keeps pacing to the end when the script has no closing lines', async () => {
    const timeline = buildTimeline({ ...SLOW_SCRIPT, closing: [] }, 2)
    expect(timeline.closingT).toBe(120)
    const plan = pacedPlan(SLOW6, { plannedSec: 120, timeline })
    const s = createTestSession()
    await s.ctrl.start(plan)
    await s.advance(200_000)
    expect(s.results[0]?.breaths).toBe(12)
    expect(s.ctrl.breathAt(130)).not.toBeNull()
  })
})

describe('robustness', () => {
  it('cancels a start that is still waiting for the audio when ended', async () => {
    const s = createTestSession({ audio: { unlockDelayMs: 100 } })
    const first = s.ctrl.start(testPlan())
    s.ctrl.end()
    await s.advance(50)
    // 取消之后马上再开始一次：不被前一次挡住
    const second = s.ctrl.start(testPlan({ plannedSec: 60 }))
    await s.advance(60)
    await first
    expect(s.ctrl.getState().status).toBe('idle')
    await s.advance(100)
    await second
    expect(s.ctrl.getState()).toMatchObject({ status: 'lead', plan: { plannedSec: 60 } })
    expect(s.audio.callsTo('unlock')).toHaveLength(2)
    expect(s.audio.callsTo('startBed')).toHaveLength(1)
    expect(s.results).toEqual([])
  })

  it('leaves nothing running when a listener ends the practice from a notification', async () => {
    const s = createTestSession()
    s.ctrl.subscribe(() => {
      if (s.ctrl.getState().status === 'running') s.ctrl.end()
    })
    await s.ctrl.start(testPlan({ plannedSec: 60, leadSec: 1 }))
    await s.advance(4000)
    expect(s.ctrl.getState()).toMatchObject({ status: 'done', endReason: 'stopped' })
    expect(s.results).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves nothing running when a listener pauses on resume', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan({ plannedSec: 60 }))
    await s.advanceTo(5)
    s.ctrl.pause()
    const off = s.ctrl.subscribe(() => {
      if (s.ctrl.getState().status === 'running') s.ctrl.pause()
    })
    s.ctrl.resume()
    off()
    expect(s.ctrl.getState().status).toBe('paused')
    expect(s.audio.state()).toBe('suspended')
    expect(s.platform.awake).toBe(false)
  })

  it('filters double taps on the unrounded time', async () => {
    const s = createTestSession()
    await s.ctrl.start(testPlan())
    await s.advanceTo(10.04)
    s.ctrl.mark()
    // 取整后相差 0.62 秒，实际只有 0.58 秒
    await s.advanceTo(10.04 + MARK_DEBOUNCE_SEC - 0.02)
    s.ctrl.mark()
    expect(s.ctrl.getState().marks).toEqual([10])
    await s.advance(40)
    s.ctrl.mark()
    expect(s.ctrl.getState().marks).toHaveLength(2)
  })

  it('rejects a broken breath pattern', async () => {
    const s = createTestSession()
    const broken = testPlan({ kind: 'paced', pattern: { T: 0, rate: 0, segs: [] } })
    await expect(s.ctrl.start(broken)).rejects.toThrow(RangeError)
    expect(s.ctrl.getState().status).toBe('idle')
  })

  it('names a vibration for every breath phase', () => {
    expect(Object.keys(HAPTICS).sort()).toEqual(['hold', 'in', 'in2', 'out', 'rest'])
  })
})

describe('retrying blocked session audio', () => {
  it('rejoins the audio clock without losing elapsed time or focus marks', async () => {
    const s = createTestSession()
    const unlock = vi.spyOn(s.audio, 'unlock').mockResolvedValueOnce(false)
    await s.ctrl.start(testPlan({ plannedSec: 120, leadSec: 0 }))
    await s.advanceTo(10)
    s.ctrl.mark()
    expect(s.ctrl.getState().audio).toBe('blocked')
    const elapsed = s.ctrl.time()
    unlock.mockRestore()
    expect(await s.ctrl.retryAudio!()).toBe(true)
    expect(s.ctrl.getState().audio).toBe('on')
    expect(s.ctrl.getState().marks).toHaveLength(1)
    expect(s.ctrl.time()).toBeCloseTo(elapsed, 1)
    await s.advance(2000)
    expect(s.ctrl.time()).toBeCloseTo(elapsed + 2, 1)
  })
  it('does not resurrect a practice ended while the retry was pending', async () => {
    const s = createTestSession()
    vi.spyOn(s.audio, 'unlock').mockResolvedValueOnce(false)
    await s.ctrl.start(testPlan({ plannedSec: 120, leadSec: 0 }))
    await s.advanceTo(10)
    let resolve: (value: boolean) => void = () => {}
    vi.spyOn(s.audio, 'unlock').mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done
        }),
    )
    const retry = s.ctrl.retryAudio!()
    s.ctrl.end()
    resolve(true)
    expect(await retry).toBe(false)
    expect(s.ctrl.getState().status).toBe('done')
    expect(s.audio.callsTo('startBed')).toHaveLength(0)
  })
})
