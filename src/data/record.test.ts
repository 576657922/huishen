import { describe, expect, it } from 'vitest'
import type { SessionPlan, SessionResult } from '@/engine/types'
import { makeRecord } from './fixtures'
import {
  byStartedAt,
  isRecordable,
  MAX_MARKS,
  MIN_RECORD_SEC,
  resultToRecord,
  sanitizeRecord,
} from './record'
import type { SessionRecord } from './types'

function plan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    practiceId: 'focus',
    kind: 'focus',
    title: '专注',
    plannedSec: 600,
    leadSec: 5,
    pattern: null,
    timeline: null,
    intervalSec: null,
    sound: { ambience: 'stream', music: 'drone', ambienceVolume: 55, musicVolume: 45 },
    cues: true,
    captionCue: true,
    voice: false,
    haptics: false,
    silentEnd: true,
    params: {},
    ...overrides,
  }
}

function result(overrides: Partial<SessionResult> = {}): SessionResult {
  return {
    plan: plan(),
    startedAt: new Date(2026, 9, 22, 21, 5).toISOString(),
    practicedSec: 600,
    completed: true,
    marks: [],
    count: null,
    breaths: null,
    finalRate: null,
    rateSteps: 0,
    skipped: [],
    ...overrides,
  }
}

/** 一条合法记录的原始形态（模拟从 JSON 读进来的数据） */
function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...JSON.parse(JSON.stringify(makeRecord())), ...overrides }
}

describe('sanitizeRecord: identity fields', () => {
  it('accepts a valid record unchanged', () => {
    const record = makeRecord({ marks: [1.5, 30], note: '有点困' })
    expect(sanitizeRecord(record)).toEqual(record)
  })

  it('rejects non-objects', () => {
    for (const x of [null, undefined, 42, 'record', [], new Date()]) expect(sanitizeRecord(x)).toBeNull()
  })

  it('rejects a bad id', () => {
    expect(sanitizeRecord(raw({ id: '' }))).toBeNull()
    expect(sanitizeRecord(raw({ id: ' padded ' }))).toBeNull()
    expect(sanitizeRecord(raw({ id: 'x'.repeat(129) }))).toBeNull()
    expect(sanitizeRecord(raw({ id: 7 }))).toBeNull()
    expect(sanitizeRecord(raw({ id: 'a\u0000b' }))).toBeNull()
  })

  it('rejects unknown practices, kinds and versions', () => {
    expect(sanitizeRecord(raw({ practiceId: 'qigong' }))).toBeNull()
    expect(sanitizeRecord(raw({ kind: 'breathing' }))).toBeNull()
    expect(sanitizeRecord(raw({ v: 2 }))).toBeNull()
    expect(sanitizeRecord(raw({ v: undefined }))?.v).toBe(1)
  })

  it('keeps records of the newer practices', () => {
    for (const [practiceId, kind] of [
      ['slow', 'paced'],
      ['walking', 'guided'],
      ['pace-finder', 'assessment'],
      ['listen', 'sound'],
      ['sleep', 'sound'],
    ] as const) {
      expect(sanitizeRecord(raw({ practiceId, kind }))?.practiceId).toBe(practiceId)
    }
  })

  it('requires a full ISO start time within a sane range and normalizes it', () => {
    expect(sanitizeRecord(raw({ startedAt: '2026-10-22' }))).toBeNull()
    expect(sanitizeRecord(raw({ startedAt: 'yesterday' }))).toBeNull()
    expect(sanitizeRecord(raw({ startedAt: '1999-12-31T23:00:00Z' }))).toBeNull()
    expect(sanitizeRecord(raw({ startedAt: '2100-01-01T00:00:00Z' }))).toBeNull()
    expect(sanitizeRecord(raw({ startedAt: 1761100000000 }))).toBeNull()
    const r = sanitizeRecord(raw({ startedAt: '2026-10-22T07:30:00+08:00', date: '2026-10-22' }))
    expect(r?.startedAt).toBe('2026-10-21T23:30:00.000Z')
    expect(r?.date).toBe('2026-10-22')
  })

  it('requires a finite actual duration and clamps it', () => {
    expect(sanitizeRecord(raw({ actualSec: undefined }))).toBeNull()
    expect(sanitizeRecord(raw({ actualSec: '600' }))).toBeNull()
    expect(sanitizeRecord(raw({ actualSec: Number.NaN }))).toBeNull()
    expect(sanitizeRecord(raw({ actualSec: -5 }))?.actualSec).toBe(0)
    expect(sanitizeRecord(raw({ actualSec: 1e9 }))?.actualSec).toBe(86400)
    expect(sanitizeRecord(raw({ actualSec: 600.4 }))?.actualSec).toBe(600)
  })
})

describe('sanitizeRecord: repairable fields', () => {
  it('drops unknown fields', () => {
    const r = sanitizeRecord(raw({ password: 'x', extra: { a: 1 } }))
    expect(r).not.toBeNull()
    expect(Object.keys(r as SessionRecord)).not.toContain('password')
    expect(Object.keys(r as SessionRecord)).not.toContain('extra')
  })

  it('derives planned time and completion when missing', () => {
    const r = sanitizeRecord(raw({ plannedSec: undefined, completed: undefined, actualSec: 420 }))
    expect(r?.plannedSec).toBe(420)
    expect(r?.completed).toBe(true)
    expect(sanitizeRecord(raw({ plannedSec: 600, actualSec: 300, completed: 'yes' }))?.completed).toBe(false)
  })

  it('treats a planned time of 0 as an open-ended session that ends when the user stops', () => {
    const r = sanitizeRecord(raw({ plannedSec: 0, actualSec: 1500, completed: undefined }))
    expect(r?.plannedSec).toBe(0)
    expect(r?.completed).toBe(true)
  })

  it('keeps a known feeling and drops anything else', () => {
    expect(sanitizeRecord(raw({ feeling: 'tenser' }))?.feeling).toBe('tenser')
    expect(sanitizeRecord(raw({ feeling: 'great' }))).not.toHaveProperty('feeling')
    expect(sanitizeRecord(raw({ feeling: 2 }))).not.toHaveProperty('feeling')
  })

  it('repairs a local date that cannot belong to the start time', () => {
    const at = new Date(2026, 9, 22, 23, 50)
    const r = sanitizeRecord(raw({ startedAt: at.toISOString(), date: '2026-10-01' }))
    expect(r?.date).toBe('2026-10-22')
    expect(sanitizeRecord(raw({ startedAt: at.toISOString(), date: 'soon' }))?.date).toBe('2026-10-22')
  })

  it('keeps a recorded date that differs from UTC by one day (another time zone)', () => {
    // 东京 2026-10-23 08:00 = UTC 2026-10-22 23:00：本地日期比 UTC 日期晚一天，仍是合法记录
    const r = sanitizeRecord(raw({ startedAt: '2026-10-22T23:00:00.000Z', date: '2026-10-23' }))
    expect(r?.date).toBe('2026-10-23')
  })

  it('accepts every ambience the sound layer offers, including noise', () => {
    for (const ambience of ['rain', 'stream', 'ocean', 'forest', 'birds', 'wind', 'pink', 'brown']) {
      expect(sanitizeRecord(raw({ sound: { ambience, music: 'none' } }))?.sound.ambience).toBe(ambience)
    }
  })

  it('keeps a known sound mode and drops anything else', () => {
    const sound = (mode: unknown) =>
      sanitizeRecord(raw({ sound: { ambience: 'rain', music: 'none', mode } }))?.sound
    expect(sound('sleep')).toEqual({ ambience: 'rain', music: 'none', mode: 'sleep' })
    expect(sound('relax')?.mode).toBe('relax')
    expect(sound('nap')).toEqual({ ambience: 'rain', music: 'none' })
    expect(sound(undefined)).not.toHaveProperty('mode')
  })

  it('falls back to silence for unknown sounds', () => {
    expect(sanitizeRecord(raw({ sound: { ambience: 'pad', music: 'jazz' } }))?.sound).toEqual({
      ambience: 'none',
      music: 'none',
    })
    expect(sanitizeRecord(raw({ sound: 'stream' }))?.sound).toEqual({ ambience: 'none', music: 'none' })
  })

  it('keeps only safe, primitive params', () => {
    const params = JSON.parse(
      '{"__proto__":{"polluted":true},"rate":5.5,"ratio":"equal","nested":{},"bad key":1}',
    )
    params.inf = Number.POSITIVE_INFINITY
    const r = sanitizeRecord(raw({ params }))
    expect(r?.params).toEqual({ rate: 5.5, ratio: 'equal' })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('cleans, sorts, rounds, clamps and caps marks', () => {
    const r = sanitizeRecord(raw({ actualSec: 600, marks: [30.04, 12.345, Number.NaN, 'x', -2, 900] }))
    expect(r?.marks).toEqual([0, 12.3, 30, 600])
    const many = Array.from({ length: MAX_MARKS + 500 }, (_, i) => i * 0.2)
    expect(sanitizeRecord(raw({ actualSec: 3600, marks: many }))?.marks).toHaveLength(MAX_MARKS)
    expect(sanitizeRecord(raw({ marks: 'many' }))?.marks).toBeUndefined()
  })

  it('keeps counting tallies consistent', () => {
    const r = sanitizeRecord(raw({ count: { cycles: 10, correct: 12, errors: 5, resets: -2 } }))
    expect(r?.count).toEqual({ cycles: 10, correct: 10, errors: 0, resets: 0 })
    expect(sanitizeRecord(raw({ count: { cycles: 6.6, correct: 4, errors: 9 } }))?.count).toEqual({
      cycles: 7,
      correct: 4,
      errors: 3,
      resets: 0,
    })
    expect(sanitizeRecord(raw({ count: { correct: 3 } }))?.count).toBeUndefined()
  })

  it('keeps too-fast rounds within what is left of the cycles', () => {
    const count = (c: Record<string, unknown>) => sanitizeRecord(raw({ count: c }))?.count
    expect(count({ cycles: 10, correct: 6, errors: 2, resets: 1, invalid: 2 })).toEqual({
      cycles: 10,
      correct: 6,
      errors: 2,
      resets: 1,
      invalid: 2,
    })
    expect(count({ cycles: 10, correct: 6, errors: 3, resets: 0, invalid: 5 })?.invalid).toBe(1)
    expect(count({ cycles: 4, correct: 4, errors: 0, resets: 0, invalid: 0 })?.invalid).toBe(0)
    // 引擎加上 invalid 之前的记录：原样保留，不凭空补一个 0
    expect(count({ cycles: 4, correct: 3, errors: 1, resets: 0 })).not.toHaveProperty('invalid')
    expect(count({ cycles: 4, correct: 3, errors: 1, resets: 0, invalid: 'many' })).not.toHaveProperty(
      'invalid',
    )
  })

  it('validates paced fields', () => {
    const r = sanitizeRecord(raw({ breaths: 3.7, rate: 5.45, rateSteps: 1.6 }))
    expect(r?.breaths).toBe(4)
    expect(r?.rate).toBe(5.5)
    expect(r?.rateSteps).toBe(2)
    expect(sanitizeRecord(raw({ rate: 0 }))?.rate).toBeUndefined()
    expect(sanitizeRecord(raw({ rate: 500 }))?.rate).toBe(60)
    expect(sanitizeRecord(raw({ breaths: -3 }))?.breaths).toBe(0)
    expect(sanitizeRecord(raw({ rateSteps: -1 }))?.rateSteps).toBe(0)
    expect(sanitizeRecord(raw({ rateSteps: 'twice' }))).not.toHaveProperty('rateSteps')
  })

  it('keeps skipped section ids in order, without duplicates or junk', () => {
    const skipped = (x: unknown) =>
      sanitizeRecord(raw({ kind: 'guided', practiceId: 'body-scan', skipped: x }))?.skipped
    expect(skipped(['knees', 'hips', 'knees'])).toEqual(['knees', 'hips'])
    // 段落 id 本来就干净：需要清理的、不是字符串的都是坏数据
    expect(skipped(['feet', ' hips ', 7, null, '', 'a\u0000b', 'x'.repeat(65)])).toEqual(['feet'])
    expect(skipped(Array.from({ length: 100 }, (_, i) => `s${i}`))).toHaveLength(64)
    expect(skipped([])).toBeUndefined()
    expect(skipped('feet')).toBeUndefined()
  })

  it('clamps check-ins to 0–10 integers', () => {
    expect(sanitizeRecord(raw({ checkin: { pre: 7.6, post: 11 } }))?.checkin).toEqual({ pre: 8, post: 10 })
    expect(sanitizeRecord(raw({ checkin: { pre: 3 } }))?.checkin).toEqual({ pre: 3 })
    expect(sanitizeRecord(raw({ checkin: { pre: 'high' } }))?.checkin).toBeUndefined()
  })

  it('drops implausible heart-rate measurements instead of clamping them', () => {
    const r = sanitizeRecord(raw({ hrv: { meanHr: 300, rmssd: 42.345, amplitude: -1 } }))
    expect(r?.hrv).toEqual({ rmssd: 42.3 })
    expect(sanitizeRecord(raw({ hrv: { meanHr: 'fast' } }))?.hrv).toBeUndefined()
  })

  it('cleans notes and keeps line breaks', () => {
    expect(sanitizeRecord(raw({ note: '  有点困\r\n后来好了\u0000 ' }))?.note).toBe('有点困\n后来好了')
    expect(sanitizeRecord(raw({ note: '字'.repeat(800) }))?.note).toHaveLength(500)
    expect(sanitizeRecord(raw({ note: '   ' }))?.note).toBeUndefined()
  })
})

describe('sanitizeRecord: robustness', () => {
  it('is idempotent', () => {
    const once = sanitizeRecord(
      raw({
        marks: [5.55, 1],
        count: { cycles: 3, correct: 2, errors: 1, resets: 0 },
        note: ' x ',
        rateSteps: 1,
        skipped: ['hips', 'hips', 'feet'],
        sound: { ambience: 'brown', music: 'none', mode: 'sleep' },
      }),
    )
    expect(sanitizeRecord(once)).toEqual(once)
  })

  it('keeps records written before rate steps, skipped sections and sound modes existed', () => {
    const old = raw({ kind: 'paced', practiceId: 'slow', breaths: 50, rate: 5.5 })
    const r = sanitizeRecord(old)
    expect(r).toEqual(old)
    expect(r).not.toHaveProperty('rateSteps')
    expect(r).not.toHaveProperty('skipped')
    expect(r?.sound).not.toHaveProperty('mode')
  })

  it('never throws on hostile input', () => {
    const throwingProto = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('boom')
        },
      },
    )
    const throwingGetter = raw()
    Object.defineProperty(throwingGetter, 'actualSec', {
      enumerable: true,
      get() {
        throw new Error('boom')
      },
    })
    expect(sanitizeRecord(throwingProto)).toBeNull()
    expect(sanitizeRecord(throwingGetter)).toBeNull()
  })
})

describe('resultToRecord', () => {
  it('records a focus session with rounded marks and the local date', () => {
    const r = resultToRecord(result({ marks: [12.345, 3.21, 400], practicedSec: 599.6 }))
    expect(r).toMatchObject({
      v: 1,
      practiceId: 'focus',
      kind: 'focus',
      date: '2026-10-22',
      plannedSec: 600,
      actualSec: 600,
      completed: true,
      sound: { ambience: 'stream', music: 'drone' },
      marks: [3.2, 12.3, 400],
    })
    expect(r.id).toMatch(/\S/)
    expect(r.startedAt).toBe(new Date(2026, 9, 22, 21, 5).toISOString())
  })

  it('uses the local date of the start even late at night', () => {
    const r = resultToRecord(result({ startedAt: new Date(2026, 9, 22, 23, 59).toISOString() }))
    expect(r.date).toBe('2026-10-22')
  })

  it('keeps an empty marks list for focus to mean "zero returns"', () => {
    expect(resultToRecord(result()).marks).toEqual([])
    const guided = resultToRecord(result({ plan: plan({ practiceId: 'body-scan', kind: 'guided' }) }))
    expect(guided.marks).toBeUndefined()
    expect(guided.breaths).toBeUndefined()
    expect(guided.rate).toBeUndefined()
  })

  it('copies breath counting without the in-progress count', () => {
    const r = resultToRecord(
      result({
        plan: plan({ practiceId: 'breath-count', kind: 'count' }),
        count: { current: 3, cycles: 6, correct: 4, errors: 1, resets: 2, invalid: 1 },
      }),
    )
    expect(r.count).toEqual({ cycles: 6, correct: 4, errors: 1, resets: 2, invalid: 1 })
  })

  it('records the pace the user settled on after slowing it down, and how often they asked', () => {
    const paced = plan({
      practiceId: 'slow',
      kind: 'paced',
      pattern: { T: 60 / 5.5, rate: 5.5, segs: [] },
      params: { rate: 5.5, ratio: 'equal' },
    })
    const r = resultToRecord(result({ plan: paced, breaths: 60, finalRate: 6.5, rateSteps: 2 }))
    // 计划的速度留在 params 里，rate 是实际最后的节奏
    expect(r).toMatchObject({ rate: 6.5, rateSteps: 2, params: { rate: 5.5 }, breaths: 60 })
    expect(resultToRecord(result({ plan: paced, finalRate: Number.NaN })).rate).toBe(5.5)
    expect(resultToRecord(result({ plan: paced, finalRate: 0 })).rate).toBe(5.5)
    // 没按过「有点急」也记 0，和「不适用」分开
    expect(resultToRecord(result({ plan: paced })).rateSteps).toBe(0)
    expect(resultToRecord(result({ rateSteps: 3 }))).not.toHaveProperty('rateSteps')
  })

  it('records the sections skipped in a guided practice', () => {
    const guided = plan({ practiceId: 'body-scan', kind: 'guided' })
    const r = resultToRecord(result({ plan: guided, practicedSec: 480, skipped: ['knees', 'hips'] }))
    expect(r.skipped).toEqual(['knees', 'hips'])
    expect(resultToRecord(result({ plan: guided }))).not.toHaveProperty('skipped')
  })

  it('records the mode of a sound session, relax unless the plan says sleep', () => {
    const sound = (overrides: Partial<SessionPlan>) =>
      resultToRecord(result({ plan: plan({ practiceId: 'listen', kind: 'sound', ...overrides }) })).sound
    const mix = { ambience: 'brown', music: 'none', ambienceVolume: 50, musicVolume: 0 } as const
    expect(sound({ practiceId: 'sleep', sound: { ...mix, mode: 'sleep' } })).toEqual({
      ambience: 'brown',
      music: 'none',
      mode: 'sleep',
    })
    // 计划里没写时声音层按放松播放，记录也照实记放松
    expect(sound({ sound: mix }).mode).toBe('relax')
    expect(sound({ practiceId: 'sleep', sound: mix }).mode).toBe('relax')
    // 其他练习只在计划写明时才记
    expect(resultToRecord(result()).sound).toEqual({ ambience: 'stream', music: 'drone' })
    const scan = plan({ practiceId: 'body-scan-sleep', kind: 'guided', sound: { ...mix, mode: 'sleep' } })
    expect(resultToRecord(result({ plan: scan })).sound.mode).toBe('sleep')
  })

  it('records breaths and rate for paced practice', () => {
    const pattern = { T: 60 / 5.5, rate: 5.5, segs: [] }
    const paced = plan({
      practiceId: 'slow',
      kind: 'paced',
      pattern,
      params: { rate: 5.5, ratio: 'equal' },
    })
    const r = resultToRecord(result({ plan: paced, breaths: 54 }))
    expect(r).toMatchObject({ breaths: 54, rate: 5.5, params: { rate: 5.5, ratio: 'equal' } })
    // 引擎没给轮数时按节拍推算；恰好整轮时不能因为浮点误差少算一轮
    const computed = resultToRecord(
      result({ plan: plan({ kind: 'paced', pattern: { T: 10, rate: 6, segs: [] } }) }),
    )
    expect(computed.breaths).toBe(60)
    expect(computed.rate).toBe(6)
  })

  it('derives the rate from the cycle length when needed', () => {
    const r = resultToRecord(
      result({ plan: plan({ kind: 'paced', pattern: { T: 12, rate: Number.NaN, segs: [] } }) }),
    )
    expect(r.rate).toBe(5)
  })

  it('does not share the params object with the plan', () => {
    const p = plan({ params: { cycle: 10 } })
    const r = resultToRecord(result({ plan: p }))
    p.params.cycle = 12
    expect(r.params.cycle).toBe(10)
  })

  it('adds sanitized check-in and heart-rate extras', () => {
    const r = resultToRecord(result(), { checkin: { pre: 6, post: 3.4 }, hrv: { meanHr: 64.26, rmssd: 999 } })
    expect(r.checkin).toEqual({ pre: 6, post: 3 })
    expect(r.hrv).toEqual({ meanHr: 64.3 })
  })

  it('adds the feeling and a note when they are already known', () => {
    const r = resultToRecord(result(), { feeling: 'calmer', note: '  窗外有雨 ' })
    expect(r.feeling).toBe('calmer')
    expect(r.note).toBe('窗外有雨')
    expect(resultToRecord(result())).not.toHaveProperty('feeling')
  })

  it('records an open-ended sound session as complete with its actual length', () => {
    // 引擎约定：不限时的计划时长为 0，用户结束即算完成，实际时长按真实计时
    const sleep = plan({ practiceId: 'sleep', kind: 'sound', plannedSec: 0 })
    const r = resultToRecord(result({ plan: sleep, practicedSec: 1834.2, completed: true }))
    expect(r).toMatchObject({ plannedSec: 0, actualSec: 1834, completed: true })
    expect(r.marks).toBeUndefined()
  })

  it('throws on an invalid start time or duration', () => {
    expect(() => resultToRecord(result({ startedAt: 'not a date' }))).toThrow(RangeError)
    expect(() => resultToRecord(result({ practicedSec: Number.NaN }))).toThrow(/时长 NaN 秒/)
  })

  it('exposes the minimum recordable duration', () => {
    expect(MIN_RECORD_SEC).toBe(60)
    expect(isRecordable({ practicedSec: 59.9 })).toBe(false)
    expect(isRecordable({ practicedSec: 60 })).toBe(true)
  })
})

describe('byStartedAt', () => {
  it('orders by start time, then id', () => {
    const a = makeRecord({ id: 'b', at: new Date(2026, 9, 22, 8) })
    const b = makeRecord({ id: 'a', at: new Date(2026, 9, 22, 8) })
    const c = makeRecord({ id: 'c', at: new Date(2026, 9, 21, 8) })
    expect([a, b, c].sort(byStartedAt).map(r => r.id)).toEqual(['c', 'a', 'b'])
  })
})
