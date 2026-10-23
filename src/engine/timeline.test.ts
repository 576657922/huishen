import { describe, expect, it } from 'vitest'
import type { GuidanceDetail, GuidanceLevel, GuidedScript, ScriptLine, ScriptSection } from '@/content/types'
import { clamp, sum } from '@/lib/math'
import { mulberry32 } from '@/lib/random'
import {
  BODY_SCAN_SCRIPT,
  BREATHING_SPACE_SCRIPT,
  EDGE_CASE_SCRIPT,
  FIXTURE_SCRIPTS,
  LAYERED_SCRIPT,
  LOVING_KINDNESS_SCRIPT,
} from '@/test/fakes/scripts'
import {
  BARE_PAUSE_SEC,
  buildTimeline,
  CLAUSE_PAUSE_SEC,
  DEFAULT_CHARS_PER_SECOND,
  DEFAULT_END_BUFFER_SEC,
  lineIncluded,
  lineSec,
  measureScript,
  OPENING_DELAY_SEC,
  pauseAfter,
  REMINDER_EDGE_SEC,
  REMINDER_MIN_SILENCE_SEC,
  REMINDER_SPACING_SEC,
  readingSec,
  SECTION_CUE_LEAD_SEC,
  SENTENCE_PAUSE_SEC,
  SETTLE_END_RATE,
  SETTLE_END_VOLUME,
  settleTone,
  speakSec,
  spokenChars,
  type TimelineOptions,
} from './timeline'
import type { Timeline, TimelineCue } from './types'

const EPS = 1e-6
const LEVELS: readonly GuidanceLevel[] = ['quiet', 'standard', 'detailed']

const cpsOf = (opts: TimelineOptions): number => opts.charsPerSecond ?? DEFAULT_CHARS_PER_SECOND
const endBufferOf = (opts: TimelineOptions): number => opts.endBufferSec ?? DEFAULT_END_BUFFER_SEC

/**
 * 一句话读完（说完）的时刻：按时间线给的 dur。说得完时 dur 就是按语速估算的读完秒数（朗读读 say、字幕显示 text，
 * 按较长的一个算）；整体压缩时更短
 */
const speechEnd = (c: TimelineCue): number => c.t + (c.dur ?? Number.NaN)

/** 按语速估算的读完秒数（不压缩时 dur 应当等于它） */
const nominalDur = (c: TimelineCue, cps: number): number =>
  Math.max(spokenChars(c.text ?? ''), spokenChars(c.say ?? '')) / (cps * (c.rate ?? 1))

/** 这个档位、这个时长下会说的句子，按字幕文字 */
const spokenLines = (lines: readonly ScriptLine[], minutes: number, level: GuidanceLevel): string[] =>
  lines
    .filter(l => lineIncluded(l, minutes, level))
    .flatMap(l => {
      const said = (l.say ?? l.text).trim()
      return spokenChars(said) > 0 ? [l.text.trim() || said] : []
    })

const introEnd = (t0: number, s: ScriptSection, minutes: number, level: GuidanceLevel, cps: number): number =>
  t0 +
  SECTION_CUE_LEAD_SEC +
  sum(s.intro.filter(l => lineIncluded(l, minutes, level)).map(l => lineSec(l, cps)))

/** 任何输入都必须成立：时间严格递增、话音互不重叠、不盖住结束钟声、段落首尾相接 */
function expectWellFormed(tl: Timeline, opts: TimelineOptions): void {
  expectWithin(tl, opts, tl.duration)
}

/** 时间严格递增、话音互不重叠，每条提示和话音都在 limit 之前；每句都带着 dur，不超过按语速估算的秒数 */
function expectWithin(tl: Timeline, opts: TimelineOptions, limit: number): void {
  const cps = cpsOf(opts)
  let prev = Number.NEGATIVE_INFINITY
  for (const [i, c] of tl.cues.entries()) {
    expect(c.t).toBeGreaterThan(prev)
    expect(c.t).toBeGreaterThanOrEqual(0)
    expect(c.t).toBeLessThan(limit + EPS)
    if (c.kind === 'speak') {
      expect(spokenChars(c.say ?? c.text ?? '')).toBeGreaterThan(0)
      expect(c.dur).toBeGreaterThan(0)
      expect(c.dur).toBeLessThanOrEqual(nominalDur(c, cps) + EPS)
      expect(speakSec(c)).toBe(c.dur)
      expect(speechEnd(c)).toBeLessThanOrEqual(limit + EPS)
      const next = tl.cues[i + 1]
      if (next) expect(speechEnd(c)).toBeLessThanOrEqual(next.t + EPS)
    }
    prev = c.t
  }
  // 结尾的话开始的时刻：第一句结尾的话，没有结尾的话时为总时长
  expect(tl.closingT).toBeGreaterThanOrEqual(0)
  expect(tl.closingT).toBeLessThanOrEqual(tl.duration)
  if (tl.closingT !== tl.duration)
    expect(tl.cues.some(c => c.kind === 'speak' && c.t === tl.closingT)).toBe(true)
  for (const [i, s] of tl.sections.entries()) {
    expect(s.t1).toBeGreaterThanOrEqual(s.t0)
    expect(s.t1).toBeLessThanOrEqual(limit + EPS)
    const next = tl.sections[i + 1]
    if (next) expect(next.t0).toBeCloseTo(s.t1, 9)
  }
}

/**
 * 话说得完（含占用留白才说得完）时还要成立：每句都按顺序说到、静默不低于下限、提醒的间隔合规；
 * 不占用留白时，一切都在留白之前
 */
function expectComplete(script: GuidedScript, minutes: number, tl: Timeline, opts: TimelineOptions): void {
  const cps = cpsOf(opts)
  const level = opts.level ?? 'detailed'
  const m = measureScript(script, minutes, opts)
  const clamped = clamp(minutes, script.minMinutes, script.maxMinutes)
  const included = script.sections.filter(s => s.omitAtOrBelow === undefined || s.omitAtOrBelow < clamped)
  expect(tl.duration).toBeCloseTo(clamped * 60, 9)
  expect(m.silenceSec).toBeGreaterThanOrEqual(-endBufferOf(opts) - EPS)
  if (m.silenceSec >= 0) expectWithin(tl, opts, tl.duration - endBufferOf(opts))
  expect(m.sectionIds).toEqual(included.map(s => s.id))
  expect(tl.sections.map(s => s.id)).toEqual(m.sectionIds)

  // 按顺序走一遍：要么是下一句该说的话（或段落提示），要么是当前段落的提醒
  type Expected = { kind: 'speak'; text: string } | { kind: 'section'; id: string }
  const lines = (ls: readonly ScriptLine[]) =>
    spokenLines(ls, clamped, level).map(text => ({ kind: 'speak' as const, text }))
  const expected: Expected[] = [
    ...lines(script.opening),
    ...included.flatMap(s => [{ kind: 'section' as const, id: s.id }, ...lines(s.intro)]),
    ...lines(script.closing),
  ]
  let k = 0
  let current: ScriptSection | null = null
  for (const c of tl.cues) {
    // 说得完时不压缩：每句的 dur 就是按语速估算的读完秒数
    if (c.kind === 'speak') expect(c.dur).toBeCloseTo(nominalDur(c, cps), 9)
    const want = expected[k]
    if (want?.kind === 'section' && c.kind === 'section' && c.sectionId === want.id) {
      current = included.find(s => s.id === want.id) ?? null
      expect(tl.sections.find(s => s.id === want.id)?.t0).toBe(c.t)
      k++
    } else if (want?.kind === 'speak' && c.kind === 'speak' && c.text === want.text) {
      k++
    } else {
      expect(c.kind).toBe('speak')
      expect(current?.reminders?.map(r => r.trim())).toContain(c.text)
      expect(c.sectionId).toBe(current?.id)
    }
  }
  expect(k).toBe(expected.length)

  for (const [i, s] of tl.sections.entries()) {
    const section = included[i]
    if (!section) throw new Error('段落对不上')
    const quietFrom = introEnd(s.t0, section, clamped, level, cps)
    const silence = s.t1 - quietFrom
    expect(silence).toBeGreaterThanOrEqual(-EPS)
    // 让出留白时各段已经没有静默
    if (m.silenceSec < 0) expect(silence).toBeCloseTo(0, 6)
    if (m.silenceSec >= m.minSilenceSec)
      expect(silence).toBeGreaterThanOrEqual((section.minSilence ?? 0) - EPS)
    const reminders = tl.cues.filter(c => c.kind === 'speak' && c.t > quietFrom - EPS && c.t < s.t1)
    if (silence < REMINDER_MIN_SILENCE_SEC - EPS) expect(reminders).toEqual([])
    let edge = quietFrom
    for (const [j, r] of reminders.entries()) {
      expect(r.t - edge).toBeGreaterThanOrEqual((j === 0 ? REMINDER_EDGE_SEC : REMINDER_SPACING_SEC) - EPS)
      edge = r.t + lineSec({ text: r.text ?? '' }, cps)
    }
    if (reminders.length > 0) expect(s.t1 - edge).toBeGreaterThanOrEqual(REMINDER_EDGE_SEC - EPS)
  }
}

describe('speech estimates', () => {
  it('counts only spoken characters', () => {
    expect(spokenChars('你好，世界。')).toBe(4)
    expect(spokenChars('5 分钟')).toBe(3)
    expect(spokenChars('Hi there')).toBe(7)
    expect(spokenChars('……')).toBe(0)
    expect(spokenChars('')).toBe(0)
  })

  it.each([
    ['放松。', SENTENCE_PAUSE_SEC],
    ['真的吗？', SENTENCE_PAUSE_SEC],
    ['好！', SENTENCE_PAUSE_SEC],
    ['慢慢地……', SENTENCE_PAUSE_SEC],
    ['「先安静地坐一会儿。」', SENTENCE_PAUSE_SEC],
    ['Breathe in.', SENTENCE_PAUSE_SEC],
    ['吸气，', CLAUSE_PAUSE_SEC],
    ['第一；', CLAUSE_PAUSE_SEC],
    ['默念：', CLAUSE_PAUSE_SEC],
    ['声音、', CLAUSE_PAUSE_SEC],
    ['没有标点', BARE_PAUSE_SEC],
    ['', BARE_PAUSE_SEC],
  ])('pauses after %j for %d s', (text, pause) => {
    expect(pauseAfter(text)).toBe(pause)
  })

  it('uses explicit pauses and the given speed', () => {
    expect(lineSec({ text: '一二三四五六。' }, 3)).toBeCloseTo(2 + SENTENCE_PAUSE_SEC, 12)
    expect(lineSec({ text: '一二三四五六。', pause: 4 }, 3)).toBeCloseTo(6, 12)
    expect(lineSec({ text: '一二三', pause: -2 }, 3)).toBeCloseTo(1, 12)
    expect(lineSec({ text: '一二三四五六七八九。' })).toBeCloseTo(9 / DEFAULT_CHARS_PER_SECOND + 1.6, 12)
  })

  it('times the longer of the caption and the spoken text', () => {
    expect(lineSec({ text: '点「数乱了」。', say: '点下方那个按钮。' }, 2)).toBeCloseTo(
      7 / 2 + SENTENCE_PAUSE_SEC,
      12,
    )
    expect(lineSec({ text: '这是数息练习。', say: '数呼吸。' }, 2)).toBeCloseTo(
      6 / 2 + SENTENCE_PAUSE_SEC,
      12,
    )
    // 停顿按朗读的文字估算
    expect(lineSec({ text: '吸气', say: '吸气，' }, 2)).toBeCloseTo(1 + CLAUSE_PAUSE_SEC, 12)
  })
})

describe('lineIncluded', () => {
  const at = (detail: GuidanceDetail | undefined, level: GuidanceLevel, minutes = 5, minMinutes?: number) =>
    lineIncluded(
      { text: '一句。', ...(detail ? { detail } : {}), ...(minMinutes ? { minMinutes } : {}) },
      minutes,
      level,
    )

  it('keeps core lines at every level and richer lines only at richer levels', () => {
    expect(LEVELS.map(level => at(undefined, level))).toEqual([true, true, true])
    expect(LEVELS.map(level => at('core', level))).toEqual([true, true, true])
    expect(LEVELS.map(level => at('standard', level))).toEqual([false, true, true])
    expect(LEVELS.map(level => at('detailed', level))).toEqual([false, false, true])
  })

  it('keeps long-version lines only from their minutes on', () => {
    expect(at(undefined, 'quiet', 9.9, 10)).toBe(false)
    expect(at(undefined, 'quiet', 10, 10)).toBe(true)
    expect(at('standard', 'quiet', 20, 10)).toBe(false)
  })

  it('defaults to saying everything', () => {
    expect(lineIncluded({ text: '一句。', detail: 'detailed' }, 5)).toBe(true)
  })
})

describe('buildTimeline', () => {
  const SIMPLE: GuidedScript = {
    id: 'breathing-space',
    title: '测试',
    minMinutes: 1,
    maxMinutes: 60,
    opening: [{ text: '一二三四五六七八九十。' }],
    sections: [
      { id: 'a', title: '甲', weight: 1, intro: [{ text: '一二三，', pause: 1 }] },
      { id: 'b', title: '乙', weight: 3, intro: [] },
    ],
    closing: [{ text: '再见', pause: 0 }],
  }

  it('lays out a small script exactly', () => {
    const tl = buildTimeline(SIMPLE, 2, { charsPerSecond: 2 })
    // 开场 1 + 6.6；甲：提示音 1.5 + 2.5；乙：提示音 1.5；结尾 1；弹性 120 − 10 − 14.1 = 95.9，按 1:3 分
    const aQuiet = 95.9 / 4
    const bStart = 7.6 + 1.5 + 2.5 + aQuiet
    expect(tl.duration).toBe(120)
    expect(tl.cues.map(c => [c.kind, c.text ?? c.sectionId])).toEqual([
      ['speak', '一二三四五六七八九十。'],
      ['section', 'a'],
      ['speak', '一二三，'],
      ['section', 'b'],
      ['speak', '再见'],
    ])
    const times = tl.cues.map(c => c.t)
    const expectedTimes = [OPENING_DELAY_SEC, 7.6, 9.1, bStart, 109]
    for (const [i, t] of expectedTimes.entries()) expect(times[i]).toBeCloseTo(t, 9)
    expect(tl.sections).toHaveLength(2)
    expect(tl.sections[0]).toMatchObject({ id: 'a', title: '甲', t0: 7.6 })
    expect(tl.sections[0]?.t1).toBeCloseTo(bStart, 9)
    expect(tl.sections[1]?.t1).toBeCloseTo(109, 9)
  })

  it('tags speech inside sections with the section, not the opening or closing', () => {
    const tl = buildTimeline(BREATHING_SPACE_SCRIPT, 3)
    const speaks = tl.cues.filter(c => c.kind === 'speak')
    expect(speaks[0]).not.toHaveProperty('sectionId')
    expect(speaks.at(-1)).not.toHaveProperty('sectionTitle')
    const intro = speaks.find(c => c.text === '把注意力收拢到呼吸上，')
    expect(intro).toMatchObject({ sectionId: 'gather', sectionTitle: '聚焦呼吸' })
    const sectionCue = tl.cues.find(c => c.kind === 'section')
    expect(sectionCue).toMatchObject({ sectionId: 'aware', sectionTitle: '觉察' })
  })

  it('clamps the duration into the range the script supports', () => {
    expect(buildTimeline(BREATHING_SPACE_SCRIPT, 1).duration).toBe(180)
    expect(buildTimeline(BREATHING_SPACE_SCRIPT, 100).duration).toBe(360)
    expect(buildTimeline(BREATHING_SPACE_SCRIPT, 4.5).duration).toBe(270)
  })

  it('omits sections at or below their threshold', () => {
    const ids = (m: number) => buildTimeline(BODY_SCAN_SCRIPT, m).sections.map(s => s.id)
    expect(ids(10)).not.toContain('thighs')
    expect(ids(11)).toContain('thighs')
    expect(ids(12)).not.toContain('arms')
    expect(ids(13)).toContain('arms')
    expect(ids(6)).toEqual(ids(8))
  })

  it('splits silence by weight and lifts sections to their floor', () => {
    const script: GuidedScript = {
      ...SIMPLE,
      sections: [
        { id: 'a', title: '甲', weight: 1, intro: [] },
        { id: 'b', title: '乙', weight: 1, intro: [] },
        { id: 'c', title: '丙', weight: 0.01, minSilence: 60, intro: [] },
      ],
    }
    const tl = buildTimeline(script, 10)
    const silence = tl.sections.map(s => s.t1 - s.t0 - SECTION_CUE_LEAD_SEC)
    expect(silence[2]).toBeCloseTo(60, 9)
    expect(silence[0]).toBeCloseTo(silence[1] ?? 0, 9)
    const m = measureScript(script, 10)
    expect(sum(silence)).toBeCloseTo(m.silenceSec, 9)
  })

  it('shares silence equally when every weight is zero', () => {
    const script: GuidedScript = {
      ...SIMPLE,
      sections: [
        { id: 'a', title: '甲', weight: 0, intro: [] },
        { id: 'b', title: '乙', weight: 0, intro: [] },
      ],
    }
    const tl = buildTimeline(script, 5)
    const [a, b] = tl.sections.map(s => s.t1 - s.t0)
    expect(a).toBeCloseTo(b ?? 0, 9)
  })

  it('compresses silence proportionally when the floors do not fit', () => {
    const script: GuidedScript = {
      ...SIMPLE,
      sections: [
        { id: 'a', title: '甲', weight: 5, minSilence: 100, intro: [] },
        { id: 'b', title: '乙', weight: 1, minSilence: 300, intro: [] },
      ],
    }
    const tl = buildTimeline(script, 3, { charsPerSecond: 2 })
    const [a, b] = tl.sections.map(s => s.t1 - s.t0 - SECTION_CUE_LEAD_SEC)
    expect((b ?? 0) / (a ?? 1)).toBeCloseTo(3, 9)
    const closing = tl.cues.at(-1)
    expect(closing?.t).toBeCloseTo(180 - DEFAULT_END_BUFFER_SEC - 1, 9)
    expectWellFormed(tl, { charsPerSecond: 2 })
  })

  it('spaces reminders evenly in long silences and cycles through them', () => {
    const script: GuidedScript = {
      ...SIMPLE,
      opening: [],
      closing: [],
      sections: [{ id: 'a', title: '甲', weight: 1, intro: [], reminders: ['一。', '二。', '三。'] }],
    }
    const tl = buildTimeline(script, 10, { charsPerSecond: 2 })
    const reminders = tl.cues.filter(c => c.kind === 'speak')
    // 静默 600 − 10 − 1 − 1.5 = 587.5 秒，每条 2.1 秒；均分后每段安静不少于 45 秒，最多 11 条
    expect(reminders).toHaveLength(11)
    expect(reminders.map(r => r.text)).toEqual([...'一二三一二三一二三一二'].map(n => `${n}。`))
    const gaps = reminders.slice(1).map((r, i) => r.t - (reminders[i]?.t ?? 0) - 2.1)
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0] ?? 0, 9)
    expect(gaps[0]).toBeGreaterThanOrEqual(REMINDER_SPACING_SEC)
    expectComplete(script, 10, tl, { charsPerSecond: 2 })
  })

  it('puts a single reminder in the middle of a silence just long enough', () => {
    const script: GuidedScript = {
      ...SIMPLE,
      opening: [],
      closing: [],
      sections: [{ id: 'a', title: '甲', weight: 1, intro: [], reminders: ['回到呼吸。'] }],
    }
    // 静默 = 60 × m − 10 − 1 − 1.5
    const at = (minutes: number) => buildTimeline(script, minutes).cues.filter(c => c.kind === 'speak')
    expect(at(1.45)).toHaveLength(0) // 74.5 秒
    const one = at(1.5) // 77.5 秒
    expect(one).toHaveLength(1)
    const dur = lineSec({ text: '回到呼吸。' })
    expect(one[0]?.t).toBeCloseTo(2.5 + (77.5 - dur) / 2, 9)
  })

  it('stays well formed when the speech does not fit', () => {
    const chatty: GuidedScript = {
      ...SIMPLE,
      maxMinutes: 1,
      opening: Array.from({ length: 30 }, (_, i) => ({ text: `第${i}句，这是一句很长很长的开场白。` })),
    }
    const tl = buildTimeline(chatty, 1)
    expect(tl.duration).toBe(60)
    expectWellFormed(tl, {})
    // core 的开场一句也不省略：段落都省掉之后，整体压缩说话的时间；用时估算如实报告说不完
    const said = tl.cues.filter(c => c.kind === 'speak').map(c => c.text)
    expect(said).toEqual([...chatty.opening.map(l => l.text), '再见'])
    expect(tl.sections).toEqual([])
    expect(measureScript(chatty, 1).silenceSec).toBeLessThan(0)
  })

  it('marks where the closing lines start, and the duration when there are none', () => {
    const tl = buildTimeline(SIMPLE, 2, { charsPerSecond: 2 })
    expect(tl.closingT).toBeCloseTo(109, 9)
    expect(tl.cues.find(c => c.t === tl.closingT)?.text).toBe('再见')
    expect(tl.sections.at(-1)?.t1).toBeCloseTo(109, 9)
    expect(buildTimeline({ ...SIMPLE, closing: [] }, 2).closingT).toBe(120)
    // 结尾先是只占时间的空行时，从第一句真正出现的话算起
    const spaced = buildTimeline(
      {
        ...SIMPLE,
        closing: [
          { text: '', pause: 4 },
          { text: '再见', pause: 0 },
        ],
      },
      2,
      {
        charsPerSecond: 2,
      },
    )
    expect(spaced.closingT).toBeCloseTo(109, 9)
    expect(spaced.sections.at(-1)?.t1).toBeCloseTo(105, 9)
  })

  it('gives each line the seconds it takes to read, without the pause after it', () => {
    const tl = buildTimeline(SIMPLE, 2, { charsPerSecond: 2 })
    const speaks = tl.cues.filter(c => c.kind === 'speak')
    expect(speaks.map(c => c.dur)).toEqual([5, 1.5, 1])
    expect(readingSec({ text: '一二三，' }, 2)).toBe(1.5)
    expect(lineSec({ text: '一二三，', pause: 1 }, 2)).toBe(2.5)
    // 手写的提示没有 dur 时按默认语速估算
    expect(speakSec({ text: '回到呼吸。' })).toBeCloseTo(4 / DEFAULT_CHARS_PER_SECOND, 12)
    expect(speakSec({ text: '短。', say: '长一些的话。', dur: 2 })).toBe(2)
    expect(speakSec({ text: '短。', say: '长一些的话。' })).toBeCloseTo(5 / DEFAULT_CHARS_PER_SECOND, 12)
  })

  it('rejects invalid input', () => {
    expect(() => buildTimeline(SIMPLE, Number.NaN)).toThrow(RangeError)
    expect(() => buildTimeline({ ...SIMPLE, minMinutes: 10, maxMinutes: 5 }, 7)).toThrow(RangeError)
    expect(() => buildTimeline({ ...SIMPLE, minMinutes: 0 }, 7)).toThrow(RangeError)
    expect(() => buildTimeline(SIMPLE, 5, { charsPerSecond: 0 })).toThrow(RangeError)
    expect(() => buildTimeline(SIMPLE, 5, { endBufferSec: -1 })).toThrow(RangeError)
    expect(() => buildTimeline(SIMPLE, 5, { level: 'loud' as GuidanceLevel })).toThrow(RangeError)
    expect(() => measureScript(SIMPLE, 5, { level: 'loud' as GuidanceLevel })).toThrow(RangeError)
  })

  it('measures the script consistently with the layout', () => {
    const m = measureScript(LOVING_KINDNESS_SCRIPT, 5)
    expect(m).toMatchObject({ minutes: 5, duration: 300, sectionIds: ['self', 'dear', 'all'] })
    expect(m.silenceSec).toBeCloseTo(300 - DEFAULT_END_BUFFER_SEC - m.speechSec, 9)
    expect(m.minSilenceSec).toBe(85)
  })
})

describe('guidance level and long-version lines', () => {
  const LEVELED: GuidedScript = {
    id: 'focus',
    title: '分档',
    minMinutes: 1,
    maxMinutes: 60,
    opening: [
      { text: '核心。' },
      { text: '标准。', detail: 'standard' },
      { text: '详细。', detail: 'detailed' },
      { text: '长版才说。', minMinutes: 10 },
      { text: '长版标准。', detail: 'standard', minMinutes: 10 },
    ],
    sections: [
      {
        id: 'a',
        title: '甲',
        weight: 1,
        intro: [{ text: '甲段核心。' }, { text: '甲段详细。', detail: 'detailed' }],
      },
    ],
    closing: [{ text: '结尾标准。', detail: 'standard' }, { text: '结尾核心。' }],
  }
  const said = (opts: TimelineOptions, minutes = 5): Array<string | undefined> =>
    buildTimeline(LEVELED, minutes, opts)
      .cues.filter(c => c.kind === 'speak')
      .map(c => c.text)

  it('says only the lines of the chosen level', () => {
    expect(said({ level: 'quiet' })).toEqual(['核心。', '甲段核心。', '结尾核心。'])
    expect(said({ level: 'standard' })).toEqual([
      '核心。',
      '标准。',
      '甲段核心。',
      '结尾标准。',
      '结尾核心。',
    ])
    expect(said({ level: 'detailed' })).toEqual([
      '核心。',
      '标准。',
      '详细。',
      '甲段核心。',
      '甲段详细。',
      '结尾标准。',
      '结尾核心。',
    ])
    expect(said({})).toEqual(said({ level: 'detailed' }))
  })

  it('says long-version lines only from their minutes on, judged on the clamped duration', () => {
    expect(said({}, 9)).not.toContain('长版才说。')
    expect(said({}, 10)).toContain('长版才说。')
    expect(said({ level: 'quiet' }, 10)).toContain('长版才说。')
    expect(said({ level: 'quiet' }, 10)).not.toContain('长版标准。')
    // 请求 5 分钟，脚本最短 12 分钟：按 12 分钟排，长版的句子也说
    const long = buildTimeline({ ...LEVELED, minMinutes: 12 }, 5)
    expect(long.cues.map(c => c.text)).toContain('长版才说。')
  })

  it('measures exactly what it lays out', () => {
    const speech = (level: GuidanceLevel): number => measureScript(LEVELED, 5, { level }).speechSec
    expect(speech('quiet')).toBeLessThan(speech('standard'))
    expect(speech('standard')).toBeLessThan(speech('detailed'))
    for (const level of LEVELS) {
      const tl = buildTimeline(LEVELED, 5, { level })
      const closing = tl.cues.filter(c => c.kind === 'speak').at(-1)
      // 结尾贴着留白：说完的时刻 = 时长 − 留白 − 最后一句的停顿
      expect(closing && closing.t + lineSec({ text: closing.text ?? '' })).toBeCloseTo(
        tl.duration - DEFAULT_END_BUFFER_SEC,
        9,
      )
      expectComplete(LEVELED, 5, tl, { level })
    }
  })
})

describe('spoken text that differs from the caption', () => {
  it('reads say, shows text and leaves say out when both are the same', () => {
    const script: GuidedScript = {
      id: 'breath-count',
      title: '数息',
      minMinutes: 1,
      maxMinutes: 10,
      opening: [
        { text: '点「数乱了」。', say: '点下方那个按钮。' },
        { text: '同样的话。', say: '同样的话。' },
        { text: '', say: '只读不显示。' },
      ],
      sections: [],
      closing: [],
    }
    const [a, b, c] = buildTimeline(script, 2, { charsPerSecond: 2 }).cues
    // 读完的秒数按字数较多的一个（朗读的 7 个字）
    expect(a).toEqual({
      t: OPENING_DELAY_SEC,
      kind: 'speak',
      text: '点「数乱了」。',
      say: '点下方那个按钮。',
      dur: 3.5,
    })
    expect(b).toEqual({
      t: expect.closeTo(OPENING_DELAY_SEC + 3.5 + SENTENCE_PAUSE_SEC, 9),
      kind: 'speak',
      text: '同样的话。',
      dur: 2,
    })
    // 字幕不能空着，用朗读的文字
    expect(c).toMatchObject({ kind: 'speak', text: '只读不显示。' })
    expect(c).not.toHaveProperty('say')
  })
})

describe('when the speech does not fit', () => {
  const line = (n: number, text = '静'): ScriptLine => ({ text: `${text.repeat(n)}。`, pause: 0 })
  // 语速 1 字/秒：n 个字的句子正好说 n 秒
  const opts: TimelineOptions = { charsPerSecond: 1 }
  const sectionOf = (id: string, sec: number, extra: Partial<ScriptSection> = {}): ScriptSection => ({
    id,
    title: id,
    weight: 1,
    intro: [line(sec)],
    ...extra,
  })
  const base: GuidedScript = {
    id: 'focus',
    title: '太长',
    minMinutes: 1,
    maxMinutes: 1,
    opening: [line(2, '开'), line(2, '场')],
    sections: [],
    closing: [line(2, '结'), line(2, '尾')],
  }
  const ids = (tl: Timeline): string[] => tl.sections.map(s => s.id)

  it('uses the quiet before the end bell first and keeps every line', () => {
    // 1 + 4 + 11.5 × 4 + 4 = 55 秒：比留白之前的 50 秒多 5 秒，结尾的话占用一半留白
    const script: GuidedScript = { ...base, sections: ['a', 'b', 'c', 'd'].map(id => sectionOf(id, 10)) }
    expect(measureScript(script, 1, opts).silenceSec).toBeCloseTo(-5, 9)
    const tl = buildTimeline(script, 1, opts)
    expect(ids(tl)).toEqual(['a', 'b', 'c', 'd'])
    expectComplete(script, 1, tl, opts)
    expectWellFormed(tl, opts)
    const closing = tl.cues.filter(c => c.kind === 'speak').slice(-2)
    expect(closing.map(c => c.text)).toEqual(['结结。', '尾尾。'])
    expect(closing[0]?.t).toBeCloseTo(51, 9)
    expect(closing[1]?.t).toBeCloseTo(53, 9)
  })

  it('then drops long-version sections first, then later sections', () => {
    const script: GuidedScript = {
      ...base,
      sections: [
        sectionOf('a', 20),
        sectionOf('b', 20, { omitAtOrBelow: 0.5 }),
        sectionOf('c', 20),
        sectionOf('d', 10),
      ],
    }
    // 1 + 4 + 21.5 × 3 + 11.5 + 4 = 85 秒：省掉 b（长版才有）还多 3.5 秒，再省掉最后的 d，剩 52 秒
    expect(measureScript(script, 1, opts).silenceSec).toBeCloseTo(-35, 9)
    const tl = buildTimeline(script, 1, opts)
    expect(ids(tl)).toEqual(['a', 'c'])
    expectWellFormed(tl, opts)
    const said = tl.cues.filter(c => c.kind === 'speak')
    expect(said.slice(0, 2).map(c => c.text)).toEqual(['开开。', '场场。'])
    expect(said.slice(-2).map(c => c.text)).toEqual(['结结。', '尾尾。'])
    expect(said.at(-1)?.t).toBeCloseTo(50, 9)
  })

  it('then compresses the reading time instead of dropping a core opening or closing line', () => {
    // 1 + 56 + 6.5 + 4 = 67.5 秒：省掉段落还多 1 秒；开场和结尾的话都是 core，一句不省，整体压缩到 60 秒
    const squeezed: GuidedScript = { ...base, opening: [line(56)], sections: [sectionOf('a', 5)] }
    const a = buildTimeline(squeezed, 1, opts)
    expect(ids(a)).toEqual([])
    expect(a.cues.map(c => c.text)).toEqual([`${'静'.repeat(56)}。`, '结结。', '尾尾。'])
    expectWellFormed(a, opts)
    const k = 60 / 61
    expect(a.cues[0]?.t).toBeCloseTo(k, 9)
    expect(a.cues[0]?.dur).toBeCloseTo(56 * k, 9)
    expect(a.closingT).toBeCloseTo(57 * k, 9)
    const last = a.cues.at(-1)
    expect((last?.t ?? 0) + (last?.dur ?? 0)).toBeCloseTo(60, 9)

    const twice: GuidedScript = { ...base, opening: [line(30), line(30), line(5)] }
    const b = buildTimeline(twice, 1, opts)
    expect(b.cues.map(c => c.text)).toEqual([
      `${'静'.repeat(30)}。`,
      `${'静'.repeat(30)}。`,
      `${'静'.repeat(5)}。`,
      '结结。',
      '尾尾。',
    ])
    expectWellFormed(b, opts)
  })

  it('compresses even the opening pause when the length is shorter than it', () => {
    const tl = buildTimeline({ ...base, minMinutes: 0.01, maxMinutes: 0.01 }, 0.01)
    expect(tl.duration).toBeCloseTo(0.6, 12)
    expect(tl.cues.map(c => c.text)).toEqual(['开开。', '场场。', '结结。', '尾尾。'])
    expect(tl.sections).toEqual([])
    expectWellFormed(tl, {})
  })

  /** 一句带档位的话；语速 1 字/秒时 n 个字正好 n 秒 */
  const tagged = (n: number, detail: ScriptLine['detail'], text = '细'): ScriptLine => ({
    text: `${text.repeat(n)}。`,
    pause: 0,
    ...(detail ? { detail } : {}),
  })

  it('drops detailed lines, then standard lines, before dropping a section, and never a core line', () => {
    const script: GuidedScript = {
      ...base,
      opening: [line(2, '开'), tagged(4, 'detailed', '详'), tagged(4, 'standard', '标')],
      sections: [
        sectionOf('a', 10, {
          intro: [line(6, '甲'), tagged(4, 'detailed', '详'), tagged(4, 'standard', '标')],
        }),
        sectionOf('b', 10, { intro: [line(6, '乙'), tagged(4, 'standard', '标')] }),
      ],
      closing: [line(2, '结'), tagged(3, 'detailed', '详')],
    }
    const said = (tl: Timeline): string[] => tl.cues.flatMap(c => (c.kind === 'speak' ? [c.text ?? ''] : []))
    // 39 个字，另有开场前 1 秒、两次段落提示音前各 1.5 秒。详细档每秒 1 字：43 秒，在 60 秒里说得完
    expect(said(buildTimeline(script, 1, opts))).toHaveLength(10)
    // 每秒 0.4 字：101.5 秒说不完；去掉「详细」档的 11 个字后 74 秒仍说不完，再去掉「标准」档的 12 个字：44 秒
    const slow: TimelineOptions = { charsPerSecond: 0.4 }
    const tl = buildTimeline(script, 1, slow)
    expect(ids(tl)).toEqual(['a', 'b'])
    expect(said(tl)).toEqual(['开开。', '甲甲甲甲甲甲。', '乙乙乙乙乙乙。', '结结。'])
    expectWellFormed(tl, slow)
    // 每秒 0.6 字：只去掉「详细」档就说得完（50.7 秒），「标准」档的话都留着
    const lighter = buildTimeline(script, 1, { charsPerSecond: 0.6 })
    expect(said(lighter)).toEqual([
      '开开。',
      '标标标标。',
      '甲甲甲甲甲甲。',
      '标标标标。',
      '乙乙乙乙乙乙。',
      '标标标标。',
      '结结。',
    ])
    expectWellFormed(lighter, { charsPerSecond: 0.6 })
  })

  it('shrinks written pauses proportionally before dropping a section', () => {
    // 写明的停顿 2 × 20 秒：1 + 2 + 3.5 × 2 + 40 + 4 = 54 秒，留白 10 秒放不下，让出留白后说得完
    const paused = (id: string): ScriptSection => sectionOf(id, 2, { intro: [{ text: '静静。', pause: 20 }] })
    const script: GuidedScript = { ...base, opening: [line(2, '开')], sections: [paused('a'), paused('b')] }
    const fits = buildTimeline(script, 1, opts)
    expect(ids(fits)).toEqual(['a', 'b'])
    // 再长 16 秒：停顿按比例缩到 (60 − 30) ÷ 40 = 0.75，两段都留着
    const longer: GuidedScript = { ...script, opening: [line(18, '开')] }
    const tl = buildTimeline(longer, 1, opts)
    expect(ids(tl)).toEqual(['a', 'b'])
    expectWellFormed(tl, opts)
    const [a, b] = tl.sections
    expect((b?.t0 ?? 0) - (a?.t0 ?? 0)).toBeCloseTo(1.5 + 2 + 15, 9)
    expect(tl.cues.at(-1)?.t).toBeCloseTo(58, 9)
  })
})

describe('buildTimeline properties', () => {
  const variants: TimelineOptions[] = [
    {},
    { charsPerSecond: 2.5 },
    { charsPerSecond: 5, endBufferSec: 0 },
    { endBufferSec: 20 },
    { level: 'quiet' },
    { level: 'standard', charsPerSecond: 2.5 },
  ]

  for (const script of FIXTURE_SCRIPTS) {
    it(`holds for 「${script.title}」 at every length from 3 to 45 minutes`, () => {
      for (const opts of variants) {
        for (let minutes = 3; minutes <= 45; minutes++) {
          const tl = buildTimeline(script, minutes, opts)
          expectWellFormed(tl, opts)
          expect(measureScript(script, minutes, opts).silenceSec).toBeGreaterThanOrEqual(0)
          expectComplete(script, minutes, tl, opts)
        }
      }
    })
  }

  it('fixture scripts reach a long silence with reminders at full length', () => {
    for (const script of [BODY_SCAN_SCRIPT, LOVING_KINDNESS_SCRIPT, EDGE_CASE_SCRIPT]) {
      const tl = buildTimeline(script, 45)
      const reminders = tl.cues.filter(c => c.kind === 'speak' && c.sectionId !== undefined)
      expect(reminders.length).toBeGreaterThan(script.sections.length)
    }
  })

  it('the layered fixture says more at richer levels and more at longer lengths', () => {
    const count = (minutes: number, level: GuidanceLevel): number =>
      buildTimeline(LAYERED_SCRIPT, minutes, { level }).cues.filter(c => c.kind === 'speak' && !c.sectionId)
        .length
    expect(count(5, 'quiet')).toBeLessThan(count(5, 'standard'))
    expect(count(5, 'standard')).toBeLessThan(count(5, 'detailed'))
    expect(count(10, 'standard')).toBeGreaterThan(count(5, 'standard'))
    const say = buildTimeline(LAYERED_SCRIPT, 5).cues.find(c => c.say)
    expect(say).toMatchObject({ text: '轻点「回神」，再回到呼吸。', say: '轻轻点一下屏幕，再回到呼吸。' })
  })

  it('holds for random scripts', () => {
    const PUNCT = ['。', '，', '？', '！', '……', '：', '、', '', '」', '.']
    const DETAILS: readonly GuidanceDetail[] = ['core', 'standard', 'detailed']
    let serial = 0
    const randomScript = (seed: number): GuidedScript => {
      const rnd = mulberry32(seed)
      const int = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1))
      const text = (): string => `第${serial++}句${'静'.repeat(int(0, 30))}${PUNCT[int(0, PUNCT.length - 1)]}`
      const line = (): ScriptLine => ({
        text: text(),
        ...(rnd() < 0.2 ? { pause: rnd() * 4 } : {}),
        ...(rnd() < 0.3 ? { detail: DETAILS[int(0, 2)] } : {}),
        ...(rnd() < 0.15 ? { minMinutes: int(1, 40) } : {}),
        ...(rnd() < 0.1 ? { say: text() } : {}),
      })
      const lines = (lo: number, hi: number): ScriptLine[] => Array.from({ length: int(lo, hi) }, line)
      const minMinutes = int(1, 10)
      return {
        id: 'open-awareness',
        title: `随机 ${seed}`,
        minMinutes,
        maxMinutes: int(minMinutes, 60),
        opening: lines(0, 4),
        sections: Array.from({ length: int(0, 8) }, (_, i) => ({
          id: `s${i}`,
          title: `段落 ${i}`,
          weight: rnd() < 0.15 ? 0 : rnd() * 3,
          intro: lines(0, 4),
          ...(rnd() < 0.7 ? { reminders: Array.from({ length: int(0, 3) }, text) } : {}),
          ...(rnd() < 0.6 ? { minSilence: int(0, 90) } : {}),
          ...(rnd() < 0.3 ? { omitAtOrBelow: int(1, 40) } : {}),
        })),
        closing: lines(0, 3),
      }
    }
    let checkedComplete = 0
    let checkedOverflow = 0
    for (let seed = 1; seed <= 300; seed++) {
      const script = randomScript(seed)
      const rnd = mulberry32(seed * 7919)
      for (let n = 0; n < 6; n++) {
        // 后两轮语速极慢、时长很短，多半说不完，用来检查省略之后的时间线
        const slow = n >= 4
        const minutes = 0.5 + rnd() * (slow ? 5 : 60)
        const opts: TimelineOptions = {
          charsPerSecond: slow ? 0.2 + rnd() * 0.8 : 2 + rnd() * 4,
          endBufferSec: rnd() * 20,
          ...(rnd() < 0.7 ? { level: LEVELS[Math.floor(rnd() * 3)] } : {}),
        }
        const tl = buildTimeline(script, minutes, opts)
        expectWellFormed(tl, opts)
        // 占用留白才说得完的，也要每句都说到
        if (measureScript(script, minutes, opts).silenceSec >= -endBufferOf(opts)) {
          expectComplete(script, minutes, tl, opts)
          checkedComplete++
        } else {
          // 说不完时可以省略段落、去掉「详细」「标准」档的句子，但 core 的开场和结尾的话一句不少、顺序不变
          const clamped = clamp(minutes, script.minMinutes, script.maxMinutes)
          const core = (lines: readonly ScriptLine[]): string[] =>
            spokenLines(
              lines.filter(l => (l.detail ?? 'core') === 'core'),
              clamped,
              opts.level ?? 'detailed',
            )
          const said = tl.cues.flatMap(c => (c.kind === 'speak' && c.sectionId === undefined ? [c.text] : []))
          let from = 0
          for (const text of [...core(script.opening), ...core(script.closing)]) {
            const at = said.indexOf(text, from)
            expect(at, text).toBeGreaterThanOrEqual(0)
            from = at + 1
          }
          checkedOverflow++
        }
      }
    }
    // 两种情况都要真的检查到：绝大多数说得完，也有不少说不完、要省略的
    expect(checkedComplete).toBeGreaterThan(1000)
    expect(checkedOverflow).toBeGreaterThan(200)
  })
})

describe('skippable sections', () => {
  it('copies the flag from the script and leaves it out when the script does', () => {
    const scan = buildTimeline(BODY_SCAN_SCRIPT, 10)
    for (const s of scan.sections) {
      const source = BODY_SCAN_SCRIPT.sections.find(x => x.id === s.id)
      expect(s.skippable).toBe(source?.skippable)
      if (source?.skippable === undefined) expect(s).not.toHaveProperty('skippable')
    }
    expect(scan.sections.filter(s => s.skippable).length).toBeGreaterThan(3)
    const kindness = buildTimeline(LOVING_KINDNESS_SCRIPT, 20)
    expect(kindness.sections.filter(s => s.skippable).map(s => s.id)).toEqual(['difficult'])
  })
})

describe('prosody', () => {
  /** 每句按自己的语速倍数估算（dur 就是放慢后的读完秒数）：话音互不重叠，都在 limit 之前说完 */
  function expectVoicedWithin(tl: Timeline, opts: TimelineOptions, limit: number): void {
    const cps = cpsOf(opts)
    for (const [i, c] of tl.cues.entries()) {
      if (c.kind !== 'speak') continue
      expect(c.dur).toBeCloseTo(nominalDur(c, cps), 9)
      const end = speechEnd(c)
      expect(end).toBeLessThanOrEqual(limit + EPS)
      const next = tl.cues[i + 1]
      if (next) expect(end).toBeLessThanOrEqual(next.t + EPS)
    }
  }

  it('eases the rate and volume multipliers from 1 down to the settled values', () => {
    expect(settleTone(0)).toEqual({ rate: 1, volume: 1 })
    expect(settleTone(1)).toEqual({ rate: SETTLE_END_RATE, volume: SETTLE_END_VOLUME })
    expect(SETTLE_END_RATE).toBe(0.88)
    expect(SETTLE_END_VOLUME).toBe(0.7)
    expect(settleTone(0.5).rate).toBeCloseTo((1 + SETTLE_END_RATE) / 2, 12)
    // 两端缓：开头一成的时间里几乎不变
    expect(1 - settleTone(0.1).rate).toBeLessThan((1 - SETTLE_END_RATE) * 0.05)
    let prev = settleTone(0)
    for (let q = 0.01; q <= 1; q += 0.01) {
      const tone = settleTone(q)
      expect(tone.rate).toBeLessThanOrEqual(prev.rate)
      expect(tone.volume).toBeLessThanOrEqual(prev.volume)
      prev = tone
    }
  })

  it('adds no multipliers when the voice stays steady', () => {
    for (const prosody of [undefined, 'steady'] as const) {
      const tl = buildTimeline(BODY_SCAN_SCRIPT, 20, prosody ? { prosody } : {})
      for (const c of tl.cues) {
        expect(c).not.toHaveProperty('rate')
        expect(c).not.toHaveProperty('volume')
      }
    }
  })

  it('gets slower and softer towards the end, on spoken lines only', () => {
    const tl = buildTimeline(BODY_SCAN_SCRIPT, 20, { prosody: 'settle' })
    const spoken = tl.cues.filter(c => c.kind === 'speak')
    for (const c of tl.cues.filter(x => x.kind !== 'speak')) {
      expect(c).not.toHaveProperty('rate')
      expect(c).not.toHaveProperty('volume')
    }
    for (const [i, c] of spoken.entries()) {
      expect(c.rate).toBeGreaterThanOrEqual(SETTLE_END_RATE)
      expect(c.rate).toBeLessThanOrEqual(1)
      expect(c.volume).toBeGreaterThanOrEqual(SETTLE_END_VOLUME)
      expect(c.volume).toBeLessThanOrEqual(1)
      const prev = spoken[i - 1]
      if (prev) {
        expect(c.rate).toBeLessThanOrEqual((prev.rate ?? 1) + EPS)
        expect(c.volume).toBeLessThanOrEqual((prev.volume ?? 1) + EPS)
      }
    }
    expect(spoken[0]?.rate).toBeGreaterThan(0.999)
    expect(spoken.at(-1)?.rate).toBeLessThan(0.9)
    expect(spoken.at(-1)?.volume).toBeLessThan(0.75)
  })

  it('keeps every line and leaves room for the slower speech', () => {
    const steady = buildTimeline(BREATHING_SPACE_SCRIPT, 3)
    const settled = buildTimeline(BREATHING_SPACE_SCRIPT, 3, { prosody: 'settle' })
    expect(settled.cues.map(c => c.text)).toEqual(steady.cues.map(c => c.text))
    expectVoicedWithin(settled, {}, settled.duration - DEFAULT_END_BUFFER_SEC)
    // 放慢以后话更长，静默相应变短
    const measured = measureScript(BREATHING_SPACE_SCRIPT, 3, { prosody: 'settle' })
    expect(measured.speechSec).toBeGreaterThan(measureScript(BREATHING_SPACE_SCRIPT, 3).speechSec)
  })

  it('holds for the fixture scripts at every length', () => {
    for (const script of FIXTURE_SCRIPTS) {
      for (const opts of [{ prosody: 'settle' }, { prosody: 'settle', charsPerSecond: 2.5 }] as const) {
        for (let minutes = 3; minutes <= 45; minutes += 3) {
          const tl = buildTimeline(script, minutes, opts)
          const fits = measureScript(script, minutes, opts).silenceSec >= 0
          expectVoicedWithin(tl, opts, fits ? tl.duration - DEFAULT_END_BUFFER_SEC : tl.duration)
          for (const [i, c] of tl.cues.entries()) expect(c.t).toBeGreaterThan(tl.cues[i - 1]?.t ?? -1)
        }
      }
    }
  })

  it('gives reminders the tone of the moment their silence begins', () => {
    const tl = buildTimeline(BODY_SCAN_SCRIPT, 45, { prosody: 'settle' })
    const reminders = tl.cues.filter(
      c => c.kind === 'speak' && BODY_SCAN_SCRIPT.sections.some(s => s.reminders?.includes(c.text ?? '')),
    )
    expect(reminders.length).toBeGreaterThan(5)
    for (const r of reminders) {
      expect(r.rate).toBeGreaterThanOrEqual(SETTLE_END_RATE)
      // 提醒在静默开头那一刻定语气，比自己的时刻略早，所以不会更慢
      expect(r.rate).toBeGreaterThanOrEqual(settleTone(r.t / tl.duration).rate - EPS)
    }
  })

  it('rejects an unknown prosody', () => {
    expect(() =>
      buildTimeline(BREATHING_SPACE_SCRIPT, 3, { prosody: 'loud' as unknown as TimelineOptions['prosody'] }),
    ).toThrow(RangeError)
  })
})
