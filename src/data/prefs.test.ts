import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOX_PHASE_MAX_SEC, BOX_PHASE_MIN_SEC, SLOW_RATE_MAX, SLOW_RATE_MIN } from '@/engine/patterns'
import { addDays, dayKey } from '@/lib/date'
import {
  createPrefsStore,
  DEFAULT_PREFS,
  getPrefs,
  INTERVAL_BELLS,
  MAX_STRESS_RATINGS,
  PERSONAL_RATE,
  PREFS_KEY,
  type PrefsStore,
  pickPrefs,
  prefsStore,
  sanitizePracticePrefs,
  sanitizePrefs,
} from './prefs'
import { PREFS_VERSION, type Prefs, type Reminders, type Screening } from './types'

const KEY = 'test.prefs'
const stores: PrefsStore[] = []

function store(storage: Storage | null = localStorage): PrefsStore {
  const s = createPrefsStore({ storage, key: KEY })
  stores.push(s)
  return s
}

const saved = (): unknown => JSON.parse(localStorage.getItem(KEY) ?? 'null')

/** 模拟另一个标签页：先改存储，再收到 storage 事件 */
function writeFromOtherTab(value: unknown, key: string | null = KEY): void {
  if (key !== null) localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new StorageEvent('storage', { key }))
}

function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException('denied', 'SecurityError')
  }
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail }
}

/** 当前格式的原始数据，免得逐项校验的测试碰上迁移 */
const v2 = (fields: Record<string, unknown>): Record<string, unknown> => ({ v: PREFS_VERSION, ...fields })

const NO_CONDITIONS: Screening = {
  pregnancy: false,
  heart: false,
  respiratory: false,
  psychosis: false,
  bipolar: false,
  epilepsy: false,
  trauma: false,
  panic: false,
}

const PLAN: Reminders = {
  cue: '刷牙后',
  action: '3 分钟呼吸',
  fallback: '1 分钟',
  weekday: '07:30',
  weekend: '09:00',
}

/** builder 那一版（v1）存下的完整偏好 */
const V1 = {
  v: 1,
  theme: 'dark',
  volume: { master: 70, ambience: 50, music: 40, cues: 60 },
  voice: { enabled: false, voiceURI: null, rate: 1 },
  guidance: 'quiet',
  cueStyle: 'ping',
  cues: true,
  haptics: false,
  leadIn: 3,
  silentEnd: true,
  checkin: true,
  practice: { timer: { minutes: 20, interval: 5 }, slow: { rate: 6 } },
  personalRate: 5.5,
  onboarded: true,
  safetyAck: '2026-10-20',
  plan: {
    time: '07:30',
    place: '刷牙后',
    practiceId: 'breathing-space',
    minutes: 3,
    obstacle: '太累',
    fallbackMinutes: 1,
    weekendTime: '09:00',
  },
  program: { startedOn: '2026-10-19' },
}

// v1 的 voice（语音朗读）没有对应的设置了：迁移时直接丢掉
const MIGRATED: Prefs = {
  ...structuredClone(DEFAULT_PREFS),
  theme: 'dark',
  volume: { master: 70, ambience: 50, music: 40, cues: 60 },
  guidance: 'quiet',
  cueStyle: 'ping',
  intervalBell: 5,
  haptics: false,
  leadIn: 3,
  checkin: { prePost: true, feeling: true },
  practice: { timer: { minutes: 20, interval: 5 }, slow: { rate: 6 } },
  personalRate: 5.5,
  onboarded: true,
  safety: { ackOn: '2026-10-20', screening: null, monthlyCheck: false },
  reminders: { cue: '刷牙后', action: '3 分钟', fallback: '1 分钟', weekday: '07:30', weekend: '09:00' },
  programs: { 'mindfulness-8w': { startedOn: '2026-10-19', done: [] } },
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  for (const s of stores.splice(0)) s.destroy()
  vi.useRealTimers()
})

describe('defaults', () => {
  it('matches the product spec', () => {
    expect(DEFAULT_PREFS).toEqual({
      v: 2,
      theme: 'system',
      volume: { master: 80, ambience: 55, music: 45, cues: 70 },
      guidance: 'standard',
      captionCue: true,
      cueStyle: 'glide',
      cues: true,
      bells: true,
      intervalBell: 0,
      haptics: true,
      leadIn: 5,
      silentEnd: true,
      checkin: { prePost: false, feeling: true },
      weeklyStress: false,
      stressRatings: [],
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
    expect(INTERVAL_BELLS).toEqual([0, 5, 10])
    expect(PERSONAL_RATE).toEqual({ min: 4.5, max: 7 })
    // 慢呼吸的范围取自引擎（PRODUCT §2：4.5–7.0）
    expect(PERSONAL_RATE).toEqual({ min: SLOW_RATE_MIN, max: SLOW_RATE_MAX })
    // v1 没有语音朗读，也就没有语音和语速的设置
    expect(DEFAULT_PREFS).not.toHaveProperty('voice')
  })

  it('is deeply frozen so nobody can change the factory settings by accident', () => {
    for (const x of [
      DEFAULT_PREFS,
      DEFAULT_PREFS.volume,
      DEFAULT_PREFS.practice,
      DEFAULT_PREFS.checkin,
      DEFAULT_PREFS.stressRatings,
      DEFAULT_PREFS.sounds.sleep,
      DEFAULT_PREFS.safety,
      DEFAULT_PREFS.programs,
    ]) {
      expect(Object.isFrozen(x)).toBe(true)
    }
  })
})

describe('sanitizePrefs', () => {
  it('returns fresh, mutable defaults for garbage', () => {
    for (const raw of [undefined, null, 42, 'prefs', [], new Date()]) {
      const p = sanitizePrefs(raw)
      expect(p).toEqual(DEFAULT_PREFS)
      expect(p.volume).not.toBe(DEFAULT_PREFS.volume)
      for (const x of [p.practice, p.checkin, p.stressRatings, p.sounds.relax, p.safety, p.programs]) {
        expect(Object.isFrozen(x)).toBe(false)
      }
    }
  })

  it('falls back field by field', () => {
    const p = sanitizePrefs(
      v2({
        theme: 'neon',
        volume: { master: 150, ambience: -5, music: 'loud', cues: 33.3 },
        captionCue: 'no',
        bells: 0,
        cues: 'false',
        haptics: false,
        leadIn: 99,
        silentEnd: 0,
        checkin: { prePost: 'yes', feeling: false },
        weeklyStress: 1,
        onboarded: true,
      }),
    )
    expect(p.theme).toBe('system')
    expect(p.volume).toEqual({ master: 100, ambience: 0, music: 45, cues: 33 })
    expect(p.captionCue).toBe(true)
    expect(p.bells).toBe(true)
    expect(p.cues).toBe(true)
    expect(p.haptics).toBe(false)
    expect(p.leadIn).toBe(30)
    expect(p.silentEnd).toBe(true)
    expect(p.checkin).toEqual({ prePost: false, feeling: false })
    expect(p.weeklyStress).toBe(false)
    expect(p.onboarded).toBe(true)
    expect(sanitizePrefs(v2({ leadIn: 'soon' })).leadIn).toBe(5)
  })

  it('ignores the voice settings an older version stored, without a version bump', () => {
    const stored = v2({
      voice: { enabled: false, voiceURI: 'com.apple.voice.compact.zh-CN.Tingting', rate: 0.6 },
    })
    const p = sanitizePrefs(stored)
    expect(p).not.toHaveProperty('voice')
    expect(p).toEqual(DEFAULT_PREFS)
    expect(p.v).toBe(2)
  })

  it('keeps the caption cue and bell switches', () => {
    expect(sanitizePrefs(v2({ captionCue: false, bells: false }))).toMatchObject({
      captionCue: false,
      bells: false,
    })
    // 以前存下的偏好没有这两项：默认都开
    expect(sanitizePrefs(v2({}))).toMatchObject({ captionCue: true, bells: true })
  })

  it('keeps known practices and drops empty or unknown entries', () => {
    const p = sanitizePrefs(
      v2({
        practice: {
          focus: { minutes: 13, ambience: 'rain', junk: 1 },
          qigong: { minutes: 5 },
          timer: { interval: 500 },
          slow: { rate: 5.5, ratio: 'long', cycle: 2, music: 'drone', warmup: 'no' },
          box: {},
          'cyclic-sigh': 'fast',
        },
      }),
    )
    expect(p.practice).toEqual({
      focus: { minutes: 13, ambience: 'rain' },
      timer: { interval: 120 },
      slow: { rate: 5.5, ratio: 'long', cycle: 4, music: 'drone' },
    })
  })

  it('keeps the slow-breathing warm-up switch and the box seconds per step within 3–6', () => {
    const p = sanitizePrefs(v2({ practice: { slow: { warmup: false }, box: { phaseSec: 5 } } }))
    expect(p.practice).toEqual({ slow: { warmup: false }, box: { phaseSec: 5 } })
    expect(sanitizePracticePrefs({ phaseSec: 10 })).toEqual({ phaseSec: BOX_PHASE_MAX_SEC })
    expect(sanitizePracticePrefs({ phaseSec: 2 })).toEqual({ phaseSec: BOX_PHASE_MIN_SEC })
    expect(sanitizePracticePrefs({ phaseSec: 'long', warmup: 1 })).toBeNull()
  })

  it('keeps a slow-breathing rate within 4.5–7.0 and drops impossible ones', () => {
    expect(sanitizePracticePrefs({ rate: 6.5 })).toEqual({ rate: 6.5 })
    // 「有点急」最多到 7，记住的速度也不超过 7（以前最多存到 10）
    expect(sanitizePracticePrefs({ rate: 8 })).toEqual({ rate: SLOW_RATE_MAX })
    expect(sanitizePracticePrefs({ rate: 3.5 })).toEqual({ rate: SLOW_RATE_MIN })
    // 引擎排不出的速度当作坏数据
    expect(sanitizePracticePrefs({ rate: 42, minutes: 5 })).toEqual({ minutes: 5 })
  })

  it('defaults to standard guidance and gliding cues, and keeps a valid choice', () => {
    expect(sanitizePrefs(v2({}))).toMatchObject({ guidance: 'standard', cueStyle: 'glide' })
    expect(sanitizePrefs(v2({ guidance: 'quiet', cueStyle: 'ping' }))).toMatchObject({
      guidance: 'quiet',
      cueStyle: 'ping',
    })
    const base: Prefs = { ...DEFAULT_PREFS, guidance: 'detailed', cueStyle: 'bed' }
    expect(sanitizePrefs(v2({ guidance: 'loud', cueStyle: 'beep' }), base)).toMatchObject({
      guidance: 'detailed',
      cueStyle: 'bed',
    })
  })

  it('accepts only the offered interval bells', () => {
    for (const minutes of [0, 5, 10])
      expect(sanitizePrefs(v2({ intervalBell: minutes })).intervalBell).toBe(minutes)
    for (const bad of [15, 2.5, '5', null])
      expect(sanitizePrefs(v2({ intervalBell: bad })).intervalBell).toBe(0)
    expect(sanitizePrefs(v2({ intervalBell: 7 }), { ...DEFAULT_PREFS, intervalBell: 10 }).intervalBell).toBe(
      10,
    )
  })

  it('keeps a personal rate within 4.5–7 and treats impossible values as missing', () => {
    const rate = (x: unknown, base: Prefs = DEFAULT_PREFS) =>
      sanitizePrefs(v2({ personalRate: x }), base).personalRate
    expect(rate(5.8)).toBe(5.8)
    expect(rate(4.5)).toBe(4.5)
    expect(rate(5.555)).toBe(5.56)
    // 「有点急」从 7 再调一次是 7.5：记住的速度收在 7
    expect(rate(7.5)).toBe(7)
    expect(rate(3.5)).toBe(4.5)
    // 不可能是测出来的：不截断成一个看似合理的数
    expect(rate(42)).toBeNull()
    expect(rate('fast')).toBeNull()
    const measured: Prefs = { ...DEFAULT_PREFS, personalRate: 6 }
    expect(rate(42, measured)).toBe(6)
    expect(rate(null, measured)).toBeNull()
  })

  it('keeps one stress rating per day, in date order, dropping broken ones', () => {
    const p = sanitizePrefs(
      v2({
        weeklyStress: true,
        stressRatings: [
          { date: '2026-10-19', score: 8 },
          { date: '2026-09-28', score: 4.56789 },
          { date: '2026-10-19', score: 6 },
          { date: '2026-02-30', score: 5 },
          { date: '2026-10-01', score: 150 },
          { date: '2026-10-02', score: -1 },
          { date: '2026-10-03', score: '5' },
          { date: '2026-10-04T08:00:00Z', score: 5 },
          'junk',
        ],
      }),
    )
    expect(p.weeklyStress).toBe(true)
    // 同一天后记下的为准；分数超出 0–100 是存坏了，丢掉而不是截断
    expect(p.stressRatings).toEqual([
      { date: '2026-09-28', score: 4.57 },
      { date: '2026-10-19', score: 6 },
    ])
    expect(sanitizePrefs(v2({ stressRatings: 'many' })).stressRatings).toEqual([])
  })

  it(`keeps only the latest ${MAX_STRESS_RATINGS} stress ratings`, () => {
    const start = new Date(2020, 0, 6)
    const ratings = Array.from({ length: 250 }, (_, i) => ({
      date: dayKey(addDays(start, 7 * i)),
      score: i % 40,
    }))
    const kept = sanitizePrefs(v2({ stressRatings: [...ratings].reverse() })).stressRatings
    expect(kept).toHaveLength(MAX_STRESS_RATINGS)
    expect(kept[0]).toEqual(ratings[50])
    expect(kept.at(-1)).toEqual(ratings[249])
  })

  it('validates the default sound of each mode field by field', () => {
    const p = sanitizePrefs(
      v2({
        sounds: {
          relax: {
            ambience: 'ocean',
            music: 'drone',
            ambienceVolume: 70.4,
            musicVolume: 'loud',
            mode: 'sleep',
          },
          sleep: { ambience: 'brown', music: 'jazz' },
        },
      }),
    )
    expect(p.sounds).toEqual({
      // 模式跟着所在的键走
      relax: { ambience: 'ocean', music: 'drone', ambienceVolume: 70, musicVolume: 45, mode: 'relax' },
      sleep: { ambience: 'brown', music: 'none', ambienceVolume: 55, musicVolume: 45, mode: 'sleep' },
    })
    expect(sanitizePrefs(v2({ sounds: 'rain' })).sounds).toEqual(DEFAULT_PREFS.sounds)
  })

  it('keeps birdsong out of the sleep default, where it is hidden', () => {
    expect(sanitizePrefs(v2({ sounds: { sleep: { ambience: 'birds' } } })).sounds.sleep.ambience).toBe('rain')
    expect(sanitizePrefs(v2({ sounds: { relax: { ambience: 'birds' } } })).sounds.relax.ambience).toBe(
      'birds',
    )
    expect(sanitizePrefs(v2({ sounds: { sleep: { ambience: 'forest' } } })).sounds.sleep.ambience).toBe(
      'forest',
    )
  })

  it('validates the safety acknowledgement date', () => {
    const ack = (x: unknown) => sanitizePrefs(v2({ safety: { ackOn: x } })).safety.ackOn
    expect(ack('2026-10-22')).toBe('2026-10-22')
    expect(ack('2026-10-22T08:00:00.000Z')).toBe('2026-10-22T08:00:00.000Z')
    expect(ack('yesterday')).toBeNull()
    expect(ack(true)).toBeNull()
    // Date.parse 也认得这些，但坏数据不能让人跳过「开始之前」须知
    for (const junk of ['1', '2026', 'Oct 22 2026', '2026-10-22 08:00', '2026-02-30'])
      expect(ack(junk)).toBeNull()
    const acked: Prefs = { ...DEFAULT_PREFS, safety: { ...DEFAULT_PREFS.safety, ackOn: '2026-10-01' } }
    expect(sanitizePrefs(v2({ safety: { ackOn: 'soon' } }), acked).safety.ackOn).toBe('2026-10-01')
    expect(sanitizePrefs(v2({ safety: { ackOn: null } }), acked).safety.ackOn).toBeNull()
  })

  it('reads the health screening, treating questions not yet asked as no', () => {
    const screening = (x: unknown, base: Prefs = DEFAULT_PREFS) =>
      sanitizePrefs(v2({ safety: { screening: x } }), base).safety.screening
    const full: Screening = { ...NO_CONDITIONS, respiratory: true, panic: true }
    expect(screening(full)).toEqual(full)
    expect(screening({ respiratory: true })).toEqual({ ...NO_CONDITIONS, respiratory: true })
    expect(screening({})).toEqual(NO_CONDITIONS)
    expect(screening(null)).toBeNull()
  })

  it('distrusts a screening with a corrupted answer instead of reading it as no', () => {
    const screening = (x: unknown, base: Prefs = DEFAULT_PREFS) =>
      sanitizePrefs(v2({ safety: { screening: x } }), base).safety.screening
    expect(screening({ ...NO_CONDITIONS, heart: 'yes' })).toBeNull()
    expect(screening({ respiratory: 1 })).toBeNull()
    expect(screening('none')).toBeNull()
    const screened: Prefs = {
      ...DEFAULT_PREFS,
      safety: { ...DEFAULT_PREFS.safety, screening: { ...NO_CONDITIONS, heart: true } },
    }
    expect(screening({ heart: 'no' }, screened)).toEqual({ ...NO_CONDITIONS, heart: true })
  })

  it('keeps the monthly self-check switch', () => {
    expect(sanitizePrefs(v2({ safety: { monthlyCheck: true } })).safety.monthlyCheck).toBe(true)
    expect(sanitizePrefs(v2({ safety: { monthlyCheck: 'yes' } })).safety.monthlyCheck).toBe(false)
    expect(sanitizePrefs(v2({ safety: 'ok' })).safety).toEqual(DEFAULT_PREFS.safety)
  })

  it('keeps the date of the last monthly self-check, and only a valid one', () => {
    const checkedOn = (x: unknown, base: Prefs = DEFAULT_PREFS) =>
      sanitizePrefs(v2({ safety: { monthlyCheck: true, monthlyCheckedOn: x } }), base).safety
    expect(checkedOn('2026-10-01')).toEqual({
      ackOn: null,
      screening: null,
      monthlyCheck: true,
      monthlyCheckedOn: '2026-10-01',
    })
    // 从没问过时没有这一项，出厂设置也就不变
    expect(DEFAULT_PREFS.safety).not.toHaveProperty('monthlyCheckedOn')
    for (const x of [undefined, null, 'last month', '2026-10-01T08:00:00Z', 20261001]) {
      expect(checkedOn(x)).not.toHaveProperty('monthlyCheckedOn')
    }
    const checked: Prefs = {
      ...DEFAULT_PREFS,
      safety: { ...DEFAULT_PREFS.safety, monthlyCheckedOn: '2026-09-01' },
    }
    expect(checkedOn('soon', checked).monthlyCheckedOn).toBe('2026-09-01')
    expect(checkedOn(null, checked)).not.toHaveProperty('monthlyCheckedOn')
  })

  it('validates the reminder plan and allows blank parts', () => {
    const reminders = (x: unknown, base: Prefs = DEFAULT_PREFS) =>
      sanitizePrefs(v2({ reminders: x }), base).reminders
    expect(reminders(PLAN)).toEqual(PLAN)
    expect(reminders({ ...PLAN, cue: '  床边\u0000 ' })?.cue).toBe('床边')
    expect(reminders({ ...PLAN, action: '长'.repeat(100) })?.action).toHaveLength(60)
    const blank = { cue: '', action: '   ', fallback: '', weekday: null, weekend: '21:00' }
    expect(reminders(blank)).toEqual({ ...blank, action: '' })
    expect(reminders(null)).toBeNull()
    expect(reminders('every day')).toBeNull()
  })

  it('drops only the broken parts of a reminder plan', () => {
    const reminders = (x: unknown, base: Prefs = DEFAULT_PREFS) =>
      sanitizePrefs(v2({ reminders: x }), base).reminders
    expect(reminders({ ...PLAN, weekday: '7:30', weekend: '24:00', fallback: 1 })).toEqual({
      ...PLAN,
      weekday: null,
      weekend: null,
      fallback: '',
    })
    // 已有计划时，存坏的一项沿用原来的
    const planned: Prefs = { ...DEFAULT_PREFS, reminders: PLAN }
    expect(reminders({ ...PLAN, cue: 42, weekday: '7:30' }, planned)).toEqual(PLAN)
    expect(reminders('every day', planned)).toEqual(PLAN)
  })

  it('validates program progress and keeps completed days sorted and unique', () => {
    const p = sanitizePrefs(
      v2({
        programs: {
          'mindfulness-8w': {
            startedOn: '2026-10-19',
            done: ['w2d1', 'w1d2', 'w1d1', 'w1d2', 'w9d8', 'w0d1', 'x', 3, 'W1D3', 'w10d7'],
          },
          'breathing-4w': { startedOn: 'soon', done: [] },
          qigong: { startedOn: '2026-10-19', done: [] },
        },
      }),
    )
    expect(p.programs).toEqual({
      'mindfulness-8w': { startedOn: '2026-10-19', done: ['w1d1', 'w1d2', 'w2d1', 'w10d7'] },
    })
    expect(sanitizePrefs(v2({ programs: { 'breathing-4w': { startedOn: '2026-10-19' } } })).programs).toEqual(
      {
        'breathing-4w': { startedOn: '2026-10-19', done: [] },
      },
    )
    expect(sanitizePrefs(v2({ programs: [] })).programs).toEqual({})
  })

  it('keeps the date of the latest completed program day only when there is one', () => {
    const progress = (x: Record<string, unknown>) =>
      sanitizePrefs(v2({ programs: { 'mindfulness-8w': { startedOn: '2026-10-19', ...x } } })).programs[
        'mindfulness-8w'
      ]
    expect(progress({ done: ['w1d1'], lastDoneOn: '2026-10-19' })?.lastDoneOn).toBe('2026-10-19')
    // 进度本身照收，只去掉坏了的日期
    expect(progress({ done: ['w1d1'], lastDoneOn: 'today' })).toEqual({
      startedOn: '2026-10-19',
      done: ['w1d1'],
    })
    expect(progress({ done: [], lastDoneOn: '2026-10-19' })).toEqual({ startedOn: '2026-10-19', done: [] })
    expect(progress({ done: ['x'], lastDoneOn: '2026-10-19' })).not.toHaveProperty('lastDoneOn')
  })

  it('keeps the previous progress of a program whose new value is broken', () => {
    const base: Prefs = {
      ...DEFAULT_PREFS,
      programs: { 'breathing-4w': { startedOn: '2026-10-01', done: ['w1d1'] } },
    }
    const programs = (x: unknown) => sanitizePrefs(v2({ programs: x }), base).programs
    expect(programs({ 'breathing-4w': { startedOn: 'soon' } })).toEqual(base.programs)
    // 不在新值里的计划算退出
    expect(programs({})).toEqual({})
    expect(programs({ 'breathing-4w': undefined })).toEqual({})
    expect(programs('none')).toEqual(base.programs)
  })

  it('reads back exactly what it wrote', () => {
    const full: Prefs = {
      ...structuredClone(DEFAULT_PREFS),
      theme: 'dark',
      guidance: 'detailed',
      cueStyle: 'off',
      intervalBell: 5,
      checkin: { prePost: true, feeling: false },
      weeklyStress: true,
      stressRatings: [{ date: '2026-10-19', score: 12.5 }],
      sounds: {
        relax: { ambience: 'ocean', music: 'drone', ambienceVolume: 40, musicVolume: 30, mode: 'relax' },
        sleep: { ambience: 'brown', music: 'none', ambienceVolume: 35, musicVolume: 0, mode: 'sleep' },
      },
      practice: { slow: { rate: 5.5, ratio: 'long' } },
      personalRate: 6,
      onboarded: true,
      safety: {
        ackOn: '2026-10-01',
        screening: { ...NO_CONDITIONS, panic: true },
        monthlyCheck: true,
        monthlyCheckedOn: '2026-10-02',
      },
      reminders: PLAN,
      programs: { 'breathing-4w': { startedOn: '2026-10-19', done: ['w1d1'], lastDoneOn: '2026-10-19' } },
    }
    expect(sanitizePrefs(JSON.parse(JSON.stringify(full)))).toEqual(full)
    const migrated = sanitizePrefs(V1)
    expect(sanitizePrefs(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated)
  })

  it('uses the given base for invalid fields', () => {
    const base: Prefs = { ...DEFAULT_PREFS, theme: 'dark', leadIn: 10 }
    const p = sanitizePrefs(v2({ theme: 'neon', leadIn: Number.NaN }), base)
    expect(p.theme).toBe('dark')
    expect(p.leadIn).toBe(10)
  })

  it('never throws', () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('boom')
        },
      },
    )
    const getter = Object.defineProperty({}, 'theme', {
      enumerable: true,
      get() {
        throw new Error('boom')
      },
    })
    expect(sanitizePrefs(hostile)).toEqual(DEFAULT_PREFS)
    expect(sanitizePrefs(getter)).toEqual(DEFAULT_PREFS)
  })

  it('sanitizes a single practice entry', () => {
    expect(sanitizePracticePrefs({ minutes: 10.456, ratio: 'short' })).toEqual({ minutes: 10.46 })
    expect(sanitizePracticePrefs({})).toBeNull()
    expect(sanitizePracticePrefs(null)).toBeNull()
  })
})

describe('migrating v1 prefs', () => {
  it('moves every changed field into its v2 shape', () => {
    expect(sanitizePrefs(V1)).toEqual(MIGRATED)
  })

  it('treats prefs without a version as v1', () => {
    const p = sanitizePrefs({ checkin: false, safetyAck: '2026-10-01', program: { startedOn: '2026-09-28' } })
    expect(p.checkin).toEqual({ prePost: false, feeling: true })
    expect(p.safety.ackOn).toBe('2026-10-01')
    expect(p.programs).toEqual({ 'mindfulness-8w': { startedOn: '2026-09-28', done: [] } })
  })

  it('fills a reminder plan from what the v1 plan had', () => {
    const plan = { time: '21:00', place: '睡前', practiceId: 'body-scan' }
    // 没有周末时刻时 v1 每天都用 time；没写时长时「我会做」留空，等用户补全
    expect(sanitizePrefs({ v: 1, plan }).reminders).toEqual({
      cue: '睡前',
      action: '',
      fallback: '',
      weekday: '21:00',
      weekend: '21:00',
    })
    expect(sanitizePrefs({ v: 1, plan: { ...plan, minutes: 2.5, time: '9pm' } }).reminders).toMatchObject({
      action: '2.5 分钟',
      weekday: null,
      weekend: null,
    })
  })

  it('does not let legacy fields override v2 ones', () => {
    const p = sanitizePrefs({
      v: 1,
      checkin: { prePost: true, feeling: false },
      safetyAck: '2026-01-01',
      safety: { ackOn: '2026-10-01' },
      plan: { time: '07:00', place: '床边', practiceId: 'focus' },
      reminders: PLAN,
      intervalBell: 10,
      practice: { timer: { interval: 5 } },
    })
    expect(p.checkin).toEqual({ prePost: true, feeling: false })
    expect(p.safety.ackOn).toBe('2026-10-01')
    expect(p.reminders).toEqual(PLAN)
    expect(p.intervalBell).toBe(10)
  })

  it('leaves v2 data alone, ignoring stray legacy fields', () => {
    const p = sanitizePrefs(
      v2({ checkin: true, safetyAck: '2026-10-01', plan: V1.plan, program: V1.program }),
    )
    expect(p.checkin).toEqual(DEFAULT_PREFS.checkin)
    expect(p.safety.ackOn).toBeNull()
    expect(p.reminders).toBeNull()
    expect(p.programs).toEqual({})
    expect(p).not.toHaveProperty('safetyAck')
    expect(p).not.toHaveProperty('plan')
    expect(p).not.toHaveProperty('program')
  })

  it('carries over what the prototype stored under the same key', () => {
    const prototype = {
      mode: 'focus',
      dur: { focus: 13 },
      sound: 'stream',
      vol: 55,
      cues: false,
      silentEnd: false,
      rate: 5.5,
      ratio: 'equal',
      cycle: 10,
    }
    expect(sanitizePrefs(prototype)).toEqual({ ...DEFAULT_PREFS, cues: false, silentEnd: false })
  })

  it('migrates on load and writes v2 the next time something changes', () => {
    localStorage.setItem(KEY, JSON.stringify(V1))
    const s = store()
    expect(pickPrefs(s.getState())).toEqual(MIGRATED)
    expect(saved()).toEqual(V1)
    s.getState().set({ haptics: true })
    expect(saved()).toEqual({ ...MIGRATED, haptics: true })
  })

  it('migrates what an older version writes in another tab', () => {
    const s = store()
    writeFromOtherTab(V1)
    expect(pickPrefs(s.getState())).toEqual(MIGRATED)
  })
})

describe('prefs store', () => {
  it('loads saved prefs and sanitizes them', () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: 'dark', volume: { master: 300 } }))
    const s = store()
    expect(s.getState().theme).toBe('dark')
    expect(s.getState().volume.master).toBe(100)
  })

  it('merges patches, including partial volume and the guidance and bell switches, and persists them', () => {
    const s = store()
    s.getState().set({ theme: 'dark', volume: { music: 20 }, captionCue: false, bells: false })
    const state = s.getState()
    expect(state.theme).toBe('dark')
    expect(state.volume).toEqual({ master: 80, ambience: 55, music: 20, cues: 70 })
    expect(state).toMatchObject({ captionCue: false, bells: false })
    expect(saved()).toEqual(pickPrefs(state))
    expect(saved()).not.toHaveProperty('voice')
    expect(saved()).toMatchObject({ v: 2 })
    expect(saved()).not.toHaveProperty('set')
  })

  it('merges partial check-in, safety and sound patches', () => {
    const s = store()
    s.getState().set({ checkin: { prePost: true } })
    expect(s.getState().checkin).toEqual({ prePost: true, feeling: true })
    s.getState().set({ safety: { ackOn: '2026-10-22' } })
    s.getState().set({ safety: { screening: { ...NO_CONDITIONS, pregnancy: true } } })
    s.getState().set({ safety: { monthlyCheckedOn: '2026-10-23' } })
    expect(s.getState().safety).toEqual({
      ackOn: '2026-10-22',
      screening: { ...NO_CONDITIONS, pregnancy: true },
      monthlyCheck: false,
      monthlyCheckedOn: '2026-10-23',
    })
    s.getState().set({ safety: { monthlyCheckedOn: 'soon' } })
    expect(s.getState().safety.monthlyCheckedOn).toBe('2026-10-23')
    s.getState().set({ safety: { monthlyCheckedOn: undefined } })
    expect(s.getState().safety).not.toHaveProperty('monthlyCheckedOn')
    const relax = s.getState().sounds.relax
    s.getState().set({ sounds: { sleep: { ambience: 'brown', ambienceVolume: 40 } } })
    expect(s.getState().sounds.sleep).toEqual({
      ambience: 'brown',
      music: 'none',
      ambienceVolume: 40,
      musicVolume: 45,
      mode: 'sleep',
    })
    expect(s.getState().sounds.relax).toEqual(relax)
  })

  it('keeps the previous value when a patch is invalid', () => {
    const s = store()
    s.getState().set({ theme: 'dark', intervalBell: 5 })
    s.getState().set({ theme: 'neon' as never, leadIn: -4, intervalBell: 7 as never, reminders: undefined })
    expect(s.getState().theme).toBe('dark')
    expect(s.getState().leadIn).toBe(0)
    expect(s.getState().intervalBell).toBe(5)
    s.getState().set({ reminders: PLAN })
    s.getState().set({ reminders: { ...PLAN, weekday: '7am' } })
    expect(s.getState().reminders).toEqual(PLAN)
    s.getState().set({ reminders: null })
    expect(s.getState().reminders).toBeNull()
  })

  it('does not notify or write when nothing changes', () => {
    const s = store()
    s.getState().set({ theme: 'dark' })
    const listener = vi.fn()
    s.subscribe(listener)
    const write = vi.spyOn(Storage.prototype, 'setItem')
    s.getState().set({ theme: 'dark', volume: { master: 80 }, checkin: { feeling: true } })
    expect(listener).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })

  it('keeps untouched nested objects so selectors stay stable', () => {
    const s = store()
    const { volume, practice, checkin, sounds, safety, programs, stressRatings } = s.getState()
    s.getState().set({ theme: 'light' })
    const next = s.getState()
    expect(next.volume).toBe(volume)
    expect(next.practice).toBe(practice)
    expect(next.checkin).toBe(checkin)
    expect(next.sounds).toBe(sounds)
    expect(next.safety).toBe(safety)
    expect(next.programs).toBe(programs)
    expect(next.stressRatings).toBe(stressRatings)
  })

  it('clamps and rounds volumes', () => {
    const s = store()
    s.getState().setVolume('ambience', 120)
    s.getState().setVolume('music', 33.6)
    s.getState().setVolume('cues', Number.NaN)
    expect(s.getState().volume).toEqual({ master: 80, ambience: 100, music: 34, cues: 70 })
  })

  it('merges per-practice settings and removes cleared ones', () => {
    const s = store()
    s.getState().setPractice('slow', { rate: 5.5, ratio: 'long' })
    s.getState().setPractice('slow', { minutes: 10 })
    expect(s.getState().practice.slow).toEqual({ rate: 5.5, ratio: 'long', minutes: 10 })
    s.getState().setPractice('slow', { ratio: undefined })
    expect(s.getState().practice.slow).toEqual({ rate: 5.5, minutes: 10 })
    s.getState().setPractice('slow', { rate: undefined, minutes: undefined })
    expect(s.getState().practice).toEqual({})
  })

  it('remembers the slow-breathing warm-up switch and the box seconds per step', () => {
    const s = store()
    s.getState().setPractice('slow', { warmup: false })
    s.getState().setPractice('box', { phaseSec: 5.5 })
    expect(s.getState().practice).toEqual({ slow: { warmup: false }, box: { phaseSec: 5.5 } })
    expect(saved()).toMatchObject({ practice: { slow: { warmup: false }, box: { phaseSec: 5.5 } } })
    // 超出 3–6 秒的收回来
    s.getState().setPractice('box', { phaseSec: 9 })
    expect(s.getState().practice.box).toEqual({ phaseSec: 6 })
  })

  it('saves guidance, cue style and interval bell choices', () => {
    const s = store()
    expect(saved()).toBeNull()
    s.getState().set({ guidance: 'quiet', cueStyle: 'off', intervalBell: 10 })
    expect(saved()).toMatchObject({ guidance: 'quiet', cueStyle: 'off', intervalBell: 10 })
    expect(store().getState()).toMatchObject({ guidance: 'quiet', cueStyle: 'off', intervalBell: 10 })
  })

  it('falls back to the defaults when another tab drops a setting', () => {
    const s = store()
    s.getState().set({ guidance: 'quiet', cueStyle: 'ping' })
    writeFromOtherTab(v2({ theme: 'dark' }))
    expect(s.getState()).toMatchObject({ guidance: 'standard', cueStyle: 'glide', theme: 'dark' })
  })

  it('records one weekly stress rating per day', () => {
    const s = store()
    s.getState().addStressRating(8, '2026-10-19')
    s.getState().addStressRating(6, new Date(2026, 9, 26, 21, 30))
    s.getState().addStressRating(5, '2026-10-19')
    const expected = [
      { date: '2026-10-19', score: 5 },
      { date: '2026-10-26', score: 6 },
    ]
    expect(s.getState().stressRatings).toEqual(expected)
    expect(saved()).toMatchObject({ stressRatings: expected })
  })

  it('ignores an invalid stress rating without losing the one already there', () => {
    const s = store()
    s.getState().addStressRating(8, '2026-10-19')
    const listener = vi.fn()
    s.subscribe(listener)
    s.getState().addStressRating(Number.NaN, '2026-10-19')
    s.getState().addStressRating(200, '2026-10-19')
    s.getState().addStressRating(4, '2026-02-30')
    s.getState().addStressRating(4, new Date(Number.NaN))
    expect(s.getState().stressRatings).toEqual([{ date: '2026-10-19', score: 8 }])
    expect(listener).not.toHaveBeenCalled()
  })

  it('dates a stress rating today by default', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 22, 23, 50))
    const s = store()
    s.getState().addStressRating(7)
    expect(s.getState().stressRatings).toEqual([{ date: '2026-10-22', score: 7 }])
  })

  it('tracks program progress by completed days', () => {
    const s = store()
    s.getState().startProgram('mindfulness-8w', '2026-10-19')
    s.getState().completeProgramDay('mindfulness-8w', 'w1d2', new Date(2026, 9, 21, 21, 30))
    // 补记更早的一天：完成的天照记，最近完成的日期不往回退
    s.getState().completeProgramDay('mindfulness-8w', 'w1d1', '2026-10-19')
    expect(s.getState().programs).toEqual({
      'mindfulness-8w': { startedOn: '2026-10-19', done: ['w1d1', 'w1d2'], lastDoneOn: '2026-10-21' },
    })
    const listener = vi.fn()
    s.subscribe(listener)
    // 已经做完的一天再记一次不算新完成，也不改日期
    s.getState().completeProgramDay('mindfulness-8w', 'w1d1', '2026-10-25')
    s.getState().completeProgramDay('mindfulness-8w', 'w1d9')
    s.getState().completeProgramDay('mindfulness-8w', 'w1d3', 'soon')
    s.getState().completeProgramDay('mindfulness-8w', 'w1d3', new Date(Number.NaN))
    s.getState().startProgram('breathing-4w', 'soon')
    expect(listener).not.toHaveBeenCalled()
    expect(saved()).toMatchObject({ programs: s.getState().programs })
  })

  it('remembers the day the latest program day was done, so today can move on to other practice', () => {
    const s = store()
    s.getState().startProgram('breathing-4w', '2026-10-19')
    s.getState().completeProgramDay('breathing-4w', 'w1d1', '2026-10-19')
    s.getState().completeProgramDay('breathing-4w', 'w1d2', '2026-10-22')
    expect(s.getState().programs['breathing-4w']?.lastDoneOn).toBe('2026-10-22')
    expect(store().getState().programs['breathing-4w']?.lastDoneOn).toBe('2026-10-22')
    // 从头再来时一并清掉
    s.getState().startProgram('breathing-4w', '2026-10-23')
    expect(s.getState().programs['breathing-4w']).toEqual({ startedOn: '2026-10-23', done: [] })
  })

  it('joins a program on its first completed day and restarts or leaves it on request', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 23, 7))
    const s = store()
    s.getState().completeProgramDay('breathing-4w', 'w1d1')
    expect(s.getState().programs['breathing-4w']).toEqual({
      startedOn: '2026-10-23',
      done: ['w1d1'],
      lastDoneOn: '2026-10-23',
    })
    s.getState().startProgram('breathing-4w', new Date(2026, 9, 26))
    expect(s.getState().programs['breathing-4w']).toEqual({ startedOn: '2026-10-26', done: [] })
    s.getState().startProgram('mindfulness-8w')
    expect(s.getState().programs['mindfulness-8w']?.startedOn).toBe('2026-10-23')
    s.getState().leaveProgram('breathing-4w')
    expect(Object.keys(s.getState().programs)).toEqual(['mindfulness-8w'])
  })

  it('resets everything, or only the settings', () => {
    const s = store()
    const screening = { ...NO_CONDITIONS, epilepsy: true }
    s.getState().set({
      theme: 'dark',
      guidance: 'detailed',
      cueStyle: 'bed',
      intervalBell: 10,
      weeklyStress: true,
      checkin: { prePost: true, feeling: false },
      sounds: { sleep: { ambience: 'ocean' } },
      onboarded: true,
      safety: { ackOn: '2026-10-01', screening, monthlyCheck: true, monthlyCheckedOn: '2026-10-05' },
      personalRate: 5.6,
      reminders: PLAN,
    })
    s.getState().addStressRating(9, '2026-10-01')
    s.getState().startProgram('breathing-4w', '2026-10-19')
    s.getState().setPractice('focus', { minutes: 20 })
    s.getState().resetSettings()
    const kept = {
      onboarded: true,
      // 自查的开关是设置，做过自查的日期是经历
      safety: { ackOn: '2026-10-01', screening, monthlyCheck: false, monthlyCheckedOn: '2026-10-05' },
      personalRate: 5.6,
      reminders: PLAN,
      stressRatings: [{ date: '2026-10-01', score: 9 }],
      programs: { 'breathing-4w': { startedOn: '2026-10-19', done: [] } },
    }
    expect(pickPrefs(s.getState())).toEqual({ ...structuredClone(DEFAULT_PREFS), ...kept })
    s.getState().reset()
    expect(pickPrefs(s.getState())).toEqual(DEFAULT_PREFS)
    expect(saved()).toEqual(DEFAULT_PREFS)
  })

  it('keeps working in memory when storage throws (private mode)', () => {
    const s = store(throwingStorage())
    expect(s.getState().theme).toBe('system')
    expect(() => s.getState().set({ theme: 'dark' })).not.toThrow()
    expect(s.getState().theme).toBe('dark')
  })

  it('works without any storage', () => {
    const s = store(null)
    s.getState().setVolume('master', 10)
    s.getState().addStressRating(3, '2026-10-22')
    expect(s.getState().volume.master).toBe(10)
    expect(s.getState().stressRatings).toHaveLength(1)
  })
})

describe('prefs store across tabs', () => {
  it('applies changes made in another tab without writing them back', () => {
    const s = store()
    localStorage.setItem(KEY, JSON.stringify({ theme: 'dark', volume: { master: 30 } }))
    const write = vi.spyOn(Storage.prototype, 'setItem')
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    expect(s.getState().theme).toBe('dark')
    expect(s.getState().volume.master).toBe(30)
    expect(write).not.toHaveBeenCalled()
  })

  it('sanitizes what the other tab wrote', () => {
    const s = store()
    writeFromOtherTab({ theme: 'neon', leadIn: 500 })
    expect(s.getState().theme).toBe('system')
    expect(s.getState().leadIn).toBe(30)
  })

  it('reloads when another tab clears storage, and ignores unrelated keys', () => {
    const s = store()
    s.getState().set({ theme: 'dark' })
    writeFromOtherTab({ theme: 'light' }, 'something.else')
    expect(s.getState().theme).toBe('dark')
    localStorage.clear()
    writeFromOtherTab(null, null)
    expect(s.getState().theme).toBe('system')
  })

  it('resumes saving its own changes after a remote update', () => {
    const s = store()
    writeFromOtherTab({ theme: 'dark' })
    s.getState().set({ haptics: false })
    expect(saved()).toMatchObject({ theme: 'dark', haptics: false })
  })

  it('stops listening after destroy', () => {
    const s = store()
    s.destroy()
    writeFromOtherTab({ theme: 'dark' })
    expect(s.getState().theme).toBe('system')
  })
})

describe('shared prefs', () => {
  it('exposes the app-wide store', () => {
    expect(PREFS_KEY).toBe('huishen.prefs.v1')
    expect(getPrefs()).toBe(prefsStore.getState())
    expect(getPrefs().v).toBe(2)
  })
})
