import { describe, expect, it, vi } from 'vitest'
import { dayKey } from '@/lib/date'
import { TODAY } from './copy'
import {
  adjustedDefaults,
  type CatalogPracticeId,
  copingOptions,
  isCatalogPracticeId,
  isDiscouraged,
  isHidden,
  isOffered,
  PRACTICE_BY_ID,
  PRACTICES,
  SCREENING_ITEMS,
  type ScreeningAnswers,
  type ScreeningItem,
} from './practices'
import { breathing4wProgram } from './programs/breathing-4w'
import { mindfulness8wProgram } from './programs/mindfulness-8w'
import { HEALTH_CHECK } from './safety'
import { getScript } from './scripts'
import {
  dateLine,
  HARD_MOMENT,
  hardMoment,
  type ProgramState,
  programDay,
  QUICK_PICKS,
  quickPicks,
  type Recommendation,
  type RecommendInput,
  recommend,
  TIME_SLOTS,
  type TodayPick,
  WELCOME_BACK_DAYS,
  welcomeBack,
} from './today'
import type { PracticeId, ProgramId } from './types'

/**
 * 真实的健康情况检查只隐藏箱式呼吸和开放觉察。为了走到「主练习被隐藏、又没有能顶替的练习」这类分支，
 * 测试可以登记一个回答对象，让它另外隐藏指定的练习；其他回答照常交给 practices.ts 判断
 */
const { EXTRA_HIDDEN } = vi.hoisted(() => ({ EXTRA_HIDDEN: new Map<object, readonly string[]>() }))

vi.mock('./practices', async importOriginal => {
  const actual = await importOriginal<typeof import('./practices')>()
  return {
    ...actual,
    isHidden: (id: PracticeId, screening?: ScreeningAnswers | null): boolean =>
      (screening ? (EXTRA_HIDDEN.get(screening)?.includes(id) ?? false) : false) ||
      actual.isHidden(id, screening),
  }
})

/** 一份另外隐藏这些练习的回答（其余各项都是「没有」） */
function hiding(...ids: PracticeId[]): ScreeningAnswers {
  const answers: ScreeningAnswers = {}
  EXTRA_HIDDEN.set(answers, ids)
  return answers
}

/** 2026 年 10 月某一天的本地时刻；22 日是星期四，霜降前一日 */
const at = (hour: number, minute = 0, date = 22): Date => new Date(2026, 9, date, hour, minute)

const input = (over: Partial<RecommendInput> = {}): RecommendInput => ({
  now: at(9),
  program: null,
  lastPracticeAt: null,
  screening: null,
  ...over,
})

const rec = (over: Partial<RecommendInput> = {}): Recommendation => recommend(input(over))

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

/** 按先后完成的前 n 天的键 */
const firstDays = (n: number): string[] => range(n).map(i => `w${Math.floor(i / 7) + 1}d${(i % 7) + 1}`)

/** 完成了前 n 天的计划，与 data 层存的形状相同 */
const progress = (programId: ProgramId, completed: number, lastDoneOn?: string): ProgramState => ({
  programId,
  done: firstDays(completed),
  ...(lastDoneOn === undefined ? {} : { lastDoneOn }),
})

const picks = (r: Recommendation): TodayPick[] => [r, ...r.alternatives]
const key = (p: { practiceId: string; minutes: number }): string => `${p.practiceId}:${p.minutes}`

const PROGRAM_DAYS: Record<ProgramId, number> = { 'mindfulness-8w': 56, 'breathing-4w': 28 }

/** 练习目录里的可选时长 */
const durationsOf = (id: PracticeId): readonly number[] =>
  isCatalogPracticeId(id) ? PRACTICE_BY_ID[id].durations : []

const NONE: Record<ScreeningItem, boolean> = {
  pregnancy: false,
  heart: false,
  respiratory: false,
  psychosis: false,
  bipolar: false,
  epilepsy: false,
  trauma: false,
  panic: false,
}

/** 健康情况检查的一种回答（与 data/types.ts 的 Screening 同形）：mask 的第 i 位对应 SCREENING_ITEMS[i] */
function screeningOf(mask: number): Record<ScreeningItem, boolean> {
  const out = { ...NONE }
  for (const [i, item] of SCREENING_ITEMS.entries()) out[item] = (mask & (1 << i)) !== 0
  return out
}

/** 全部 256 种回答 */
const ALL_SCREENINGS = range(1 << SCREENING_ITEMS.length).map(screeningOf)

/**
 * 这份回答下不该推荐的练习：v1 不提供的（正念行走、睡前身体扫描），practices.ts 隐藏的和不推荐的、
 * 健康情况检查告诉用户会隐藏的（safety.ts 各项的 hides，两边不一致时这里也能发现），以及「现在有点难」不给的周期性叹息
 */
function notForThem(s: Record<ScreeningItem, boolean>): Set<PracticeId> {
  const out = new Set<PracticeId>()
  for (const item of HEALTH_CHECK.items) if (s[item.id]) for (const id of item.hides) out.add(id)
  for (const p of PRACTICES)
    if (!isOffered(p.id) || isHidden(p.id, s) || isDiscouraged(p.id, s)) out.add(p.id)
  if (!copingOptions(s).some(o => o.id === 'cyclic-sigh')) out.add('cyclic-sigh')
  return out
}

describe('按时段推荐', () => {
  it.each([
    [0, 0, 'sleep', 45, '夜里'],
    [4, 59, 'sleep', 45, '夜里'],
    [5, 0, 'focus', 10, '早上'],
    [10, 59, 'focus', 10, '早上'],
    [11, 0, 'slow', 5, '午间'],
    [13, 59, 'slow', 5, '午间'],
    [14, 0, 'breath-count', 10, '下午'],
    [17, 59, 'breath-count', 10, '下午'],
    [18, 0, 'body-scan', 10, '晚上'],
    [21, 59, 'body-scan', 10, '晚上'],
    [22, 0, 'sleep', 45, '夜里'],
    [23, 59, 'sleep', 45, '夜里'],
  ] as const)('%i:%i → %s %i 分钟（%s）', (hour, minute, practiceId, minutes, reason) => {
    const r = rec({ now: at(hour, minute) })
    expect(r).toMatchObject({ practiceId, minutes, reason, source: 'time', programDay: null })
    expect(r.plan).toBeUndefined()
  })

  it('每个时段的主推荐与 PRODUCT.md §4 一致', () => {
    expect(TIME_SLOTS.morning[0]).toEqual({ practiceId: 'focus', minutes: 10 })
    expect(TIME_SLOTS.midday[0]).toEqual({ practiceId: 'slow', minutes: 5 })
    expect(TIME_SLOTS.afternoon[0]).toEqual({ practiceId: 'breath-count', minutes: 10 })
    expect(TIME_SLOTS.evening[0]).toEqual({ practiceId: 'body-scan', minutes: 10 })
    expect(TIME_SLOTS.night[0]).toEqual({ practiceId: 'sleep', minutes: 45 })
  })

  it('深夜不推荐自我关怀：一个人在床上想烦心事，勾起的难过最难消化', () => {
    expect(TIME_SLOTS.night.map(c => c.practiceId)).not.toContain('self-compassion')
  })

  it('v1 不提供的练习（正念行走、睡前身体扫描）不在任何时段里；即使写进列表也不推荐', () => {
    for (const [slot, list] of Object.entries(TIME_SLOTS)) {
      for (const c of list) expect(isOffered(c.practiceId), `${slot} ${key(c)}`).toBe(true)
    }
    for (const hour of range(24)) {
      for (const p of picks(rec({ now: at(hour) })))
        expect(isOffered(p.practiceId), `${hour} 点 ${key(p)}`).toBe(true)
    }
    for (const p of [...QUICK_PICKS, ...HARD_MOMENT.items.flatMap(i => (i.kind === 'practice' ? [i] : []))])
      expect(isOffered(p.practiceId), key(p)).toBe(true)
  })

  it.each(Object.entries(TIME_SLOTS))('%s：换的是做法，不是时长；不推荐开放觉察和箱式呼吸', (_, list) => {
    expect(list.length).toBeGreaterThanOrEqual(4)
    expect(new Set(list.map(c => c.practiceId)).size).toBe(list.length)
    for (const c of list) {
      expect(['open-awareness', 'box']).not.toContain(c.practiceId)
      expect(durationsOf(c.practiceId), key(c)).toContain(c.minutes)
      // 经常练比每次练很久重要：不推荐比默认更长的时长
      expect(c.minutes, key(c)).toBeLessThanOrEqual(
        PRACTICE_BY_ID[c.practiceId as CatalogPracticeId].defaultMinutes,
      )
    }
  })

  it('「换一个」不含主推荐，也不重复，至少三项', () => {
    for (const hour of range(24)) {
      const r = rec({ now: at(hour) })
      const keys = picks(r).map(key)
      expect(new Set(keys).size, `${hour} 点`).toBe(keys.length)
      expect(r.alternatives.length, `${hour} 点`).toBeGreaterThanOrEqual(3)
      expect(r.alternatives.every(p => p.reason === r.reason)).toBe(true)
    }
  })
})

describe('计划', () => {
  it('有计划时先给计划的这一天，之后是保底日、可选练习，再是当前时段的练习', () => {
    const r = rec({ now: at(8), program: progress('mindfulness-8w', 9) })
    expect(r).toMatchObject({
      practiceId: 'focus',
      minutes: 10,
      reason: '八周正念 · 第 2 周第 3 天',
      source: 'program',
      plan: { programId: 'mindfulness-8w', day: 'w2d3', role: 'day' },
    })
    expect(r.alternatives[0]).toMatchObject({ practiceId: 'focus', minutes: 5, reason: '八周正念 · 保底日' })
    expect(r.alternatives[1]).toMatchObject({
      practiceId: 'breathing-space',
      minutes: 3,
      reason: '八周正念 · 可选练习',
      plan: { role: 'extra', day: 'w2d3' },
    })
    // 早上的专注呼吸 10 分钟和计划的主练习重复，只留计划那一项
    const rest = r.alternatives.slice(2)
    expect(rest.map(p => p.reason)).toEqual(rest.map(() => '早上'))
    expect(rest.map(key)).not.toContain('focus:10')
    expect(rest.every(p => p.plan === undefined)).toBe(true)
  })

  it('理由写成「八周正念 · 第 3 周第 2 天」', () => {
    expect(rec({ program: progress('mindfulness-8w', 15) }).reason).toBe('八周正念 · 第 3 周第 2 天')
  })

  it('任何时段都先给计划的这一天', () => {
    for (const hour of range(24)) {
      const r = rec({ now: at(hour), program: progress('mindfulness-8w', 16) })
      expect(r, `${hour} 点`).toMatchObject({ practiceId: 'body-scan', minutes: 10, source: 'program' })
    }
  })

  it('进度只看完成了哪几天，与日期无关；漏了几天不重排，也不说落后', () => {
    const dates = [at(9), new Date(2026, 11, 30, 9), new Date(2027, 2, 1, 9)]
    for (const now of dates) {
      for (const last of [undefined, '2026-09-01', dayKey(new Date(now.getTime() - 86_400_000))]) {
        const r = rec({ now, program: progress('mindfulness-8w', 20, last) })
        expect(r.reason).toBe('八周正念 · 第 3 周第 7 天')
        for (const p of picks(r)) expect(p.reason).not.toMatch(/落后|补|错过|漏|没练/u)
      }
    }
  })

  it('完成的天不连续时，回到第一个还没完成的那一天；不认识的键忽略', () => {
    const state: ProgramState = { programId: 'mindfulness-8w', done: ['w1d1', 'w1d3', 'w2d1'] }
    expect(programDay(state, at(9))).toMatchObject({ key: 'w1d2', week: 1, day: 2, dayNumber: 2 })
    const odd: ProgramState = { programId: 'breathing-4w', done: ['w1d1', 'w9d1', 'x', 'W1D2', 'w1d1'] }
    expect(programDay(odd, at(9))).toMatchObject({ key: 'w1d2' })
  })

  it('给出这一天的键、周次、提示和总天数', () => {
    expect(programDay(progress('mindfulness-8w', 7), at(9))).toEqual({
      programId: 'mindfulness-8w',
      title: '八周正念',
      key: 'w2d1',
      week: 2,
      day: 1,
      dayNumber: 8,
      totalDays: 56,
      weekTitle: mindfulness8wProgram.weeks[1]?.title,
      tip: mindfulness8wProgram.weeks[1]?.tips[0],
      firstDayOfWeek: true,
      doneToday: false,
    })
    expect(programDay(progress('breathing-4w', 27), at(9))).toMatchObject({ key: 'w4d7', totalDays: 28 })
    expect(programDay({ programId: 'unknown' as ProgramId, done: [] }, at(9))).toBeNull()
  })

  it('每一天的提示都对得上计划里的那一条', () => {
    for (const [id, program] of [
      ['mindfulness-8w', mindfulness8wProgram],
      ['breathing-4w', breathing4wProgram],
    ] as const) {
      for (const done of range(PROGRAM_DAYS[id])) {
        const day = programDay(progress(id, done), at(9))
        expect(day?.tip).toBe(program.weeks[Math.floor(done / 7)]?.tips[done % 7])
        expect(day?.tip).not.toBe('')
      }
    }
  })

  it('今天已经练完一天：主推荐回到按时段，计划显示下一次', () => {
    const today = dayKey(at(20))
    const r = rec({ now: at(20), program: progress('mindfulness-8w', 10, today) })
    expect(r).toMatchObject({ practiceId: 'body-scan', minutes: 10, reason: '晚上', source: 'time' })
    expect(r.programDay).toMatchObject({ doneToday: true, week: 2, day: 4 })
    expect(picks(r).every(p => p.plan === undefined)).toBe(true)

    const yesterday = dayKey(at(20, 0, 21))
    expect(rec({ now: at(20), program: progress('mindfulness-8w', 10, yesterday) }).source).toBe('program')
    // 一天都没完成时不可能「今天已练完」
    expect(rec({ now: at(20), program: progress('mindfulness-8w', 0, today) }).source).toBe('program')
  })

  it('练完全部天数后回到按时段推荐', () => {
    const r = rec({ now: at(9), program: progress('mindfulness-8w', PROGRAM_DAYS['mindfulness-8w']) })
    expect(r).toMatchObject({ source: 'time', programDay: null, practiceId: 'focus' })
    expect(rec({ program: progress('mindfulness-8w', 55) }).reason).toBe('八周正念 · 第 8 周第 7 天')
  })

  it('四周呼吸：带上每周的速度，参数是复制的', () => {
    const r = rec({ now: at(12), program: progress('breathing-4w', 0) })
    expect(r).toMatchObject({
      practiceId: 'slow',
      minutes: 5,
      params: { rate: 7 },
      reason: '四周呼吸 · 第 1 周第 1 天',
    })
    expect(r.alternatives[0]).toMatchObject({
      practiceId: 'slow',
      minutes: 3,
      params: { rate: 7 },
      reason: '四周呼吸 · 保底日',
    })
    // 午间的慢呼吸 5 分钟（默认速度）与计划重复，不再出现
    expect(picks(r).filter(p => key(p) === 'slow:5')).toHaveLength(1)
    const params = r.params as Record<string, number | string>
    params.rate = 99
    expect(breathing4wProgram.weeks[0]?.daily.params).toEqual({ rate: 7 })
  })

  it('四周呼吸第 4 周第 1 天：先做舒适节律探索，再做 3 分钟短版', () => {
    const r = rec({ program: progress('breathing-4w', 21) })
    expect(r).toMatchObject({
      practiceId: 'pace-finder',
      minutes: 7,
      reason: '四周呼吸 · 第 4 周第 1 天',
      source: 'program',
    })
    expect(r.alternatives[0]).toMatchObject({ practiceId: 'slow', minutes: 3, params: { rate: 'personal' } })
    expect(r.alternatives[0]?.plan?.role).toBe('day')
    expect(r.alternatives[1]).toMatchObject({ practiceId: 'slow', minutes: 10, params: { rate: 'personal' } })

    const next = rec({ program: progress('breathing-4w', 22) })
    expect(next).toMatchObject({ practiceId: 'slow', minutes: 10, reason: '四周呼吸 · 第 4 周第 2 天' })
    expect(next.alternatives).toContainEqual(
      expect.objectContaining({ practiceId: 'pace-finder', minutes: 7, reason: '四周呼吸 · 可选练习' }),
    )
  })

  it('主练习和保底日都算完成这一天，可选练习不少于 5 分钟才算', () => {
    const counts = (r: Recommendation): [string, boolean | undefined][] =>
      picks(r).flatMap(p => (p.plan ? [[key(p), p.plan.countsAsDay] as [string, boolean]] : []))
    expect(counts(rec({ program: progress('mindfulness-8w', 9) }))).toEqual([
      ['focus:10', true],
      ['focus:5', true],
      ['breathing-space:3', false],
    ])
    // 第 8 周自选：前几周的主练习都在可选练习里，练哪一项都算
    expect(counts(rec({ program: progress('mindfulness-8w', 49) }))).toEqual([
      ['focus:10', true],
      ['focus:5', true],
      ['body-scan:10', true],
      ['open-awareness:10', true],
      ['loving-kindness:10', true],
      ['self-compassion:5', true],
      ['breathing-space:3', false],
    ])
    // 四周呼吸的保底日只有 3 分钟，也算这一天
    expect(counts(rec({ program: progress('breathing-4w', 3) }))).toEqual([
      ['slow:5', true],
      ['slow:3', true],
    ])
  })

  it('八周正念第 7 周没有保底日：自我关怀之后是可选的专注呼吸', () => {
    const r = rec({ program: progress('mindfulness-8w', 45) })
    expect(r).toMatchObject({ practiceId: 'self-compassion', minutes: 5 })
    expect(r.alternatives.slice(0, 2).map(key)).toEqual(['focus:5', 'breathing-space:3'])
  })

  it('推荐的时长都是练习提供的时长', () => {
    const where = (p: TodayPick, label: string): string => `${label}：${key(p)}`
    for (const id of ['mindfulness-8w', 'breathing-4w'] as const) {
      for (const done of range(PROGRAM_DAYS[id])) {
        for (const p of picks(rec({ program: progress(id, done) }))) {
          expect(durationsOf(p.practiceId), where(p, `${id} 第 ${done + 1} 天`)).toContain(p.minutes)
        }
      }
    }
    for (const p of [...QUICK_PICKS, ...HARD_MOMENT.items.flatMap(i => (i.kind === 'practice' ? [i] : []))]) {
      expect(durationsOf(p.practiceId), key(p)).toContain(p.minutes)
    }
  })
})

describe('健康情况检查', () => {
  it('第 5 周隐藏开放觉察时，用可选练习里的专注呼吸顶替这一天', () => {
    expect(rec({ program: progress('mindfulness-8w', 28) })).toMatchObject({
      practiceId: 'open-awareness',
      minutes: 10,
    })
    const only = rec({ program: progress('mindfulness-8w', 28), screening: hiding('open-awareness') })
    expect(only).toMatchObject({ practiceId: 'focus', minutes: 10, plan: { role: 'day', day: 'w5d1' } })

    // 真实的回答里，隐藏开放觉察的两种情况都会把默认时长调短到 5 分钟
    for (const answer of [{ psychosis: true }, { bipolar: true }]) {
      const r = rec({ program: progress('mindfulness-8w', 28), screening: answer })
      expect(r).toMatchObject({
        practiceId: 'focus',
        minutes: 5,
        reason: '八周正念 · 第 5 周第 1 天',
        source: 'program',
        plan: { role: 'day', day: 'w5d1' },
      })
      expect(picks(r).map(p => p.practiceId)).not.toContain('open-awareness')
    }
  })

  it('常有创伤闪回时，第 5 周不推荐开放觉察，由专注呼吸 5 分钟顶替这一天，与健康情况检查的说明一致', () => {
    const r = rec({ program: progress('mindfulness-8w', 28), screening: { trauma: true } })
    expect(r).toMatchObject({
      practiceId: 'focus',
      minutes: 5,
      reason: '八周正念 · 第 5 周第 1 天',
      source: 'program',
      plan: { role: 'day', day: 'w5d1' },
    })
    expect(picks(r).map(p => p.practiceId)).not.toContain('open-awareness')
    const trauma = HEALTH_CHECK.items.find(i => i.id === 'trauma')?.adaptation ?? ''
    expect(trauma).toContain('「今日」也会改推它')
    // 第 8 周自选：可选练习里的开放觉察也不推荐
    const week8 = rec({ program: progress('mindfulness-8w', 49), screening: { trauma: true } })
    expect(picks(week8).map(p => p.practiceId)).not.toContain('open-awareness')
  })

  it('时长被调短时，计划里的慢呼吸 10 分钟也调到 5 分钟（慢呼吸的默认本来就是 5 分钟）', () => {
    for (const screening of [{ trauma: true }, { psychosis: true }, { bipolar: true }]) {
      const r = rec({ program: progress('breathing-4w', 14), screening })
      expect(r, JSON.stringify(screening)).toMatchObject({
        practiceId: 'slow',
        minutes: 5,
        params: { rate: 6 },
        reason: '四周呼吸 · 第 3 周第 1 天',
      })
    }
    expect(rec({ program: progress('breathing-4w', 14) })).toMatchObject({ practiceId: 'slow', minutes: 10 })
  })

  it('有惊恐发作时，主推荐和「只有几分钟」里的慢呼吸带同样的节拍；计划自己的速度优先', () => {
    const screening = { panic: true }
    const main = rec({ now: at(12), screening })
    expect(main).toMatchObject({ practiceId: 'slow', minutes: 5, params: { rate: 6, ratio: 'long' } })
    const quick = quickPicks(screening).find(p => p.practiceId === 'slow')
    expect(quick?.params).toEqual(main.params)
    const hard = hardMoment(screening).items.find(i => i.kind === 'practice' && i.practiceId === 'slow')
    expect(hard && hard.kind === 'practice' ? hard.params : undefined).toEqual(main.params)
    // 四周呼吸第 1 周是每分钟 7 次：保留计划的速度，只补上呼长吸短
    const plan = rec({ now: at(12), program: progress('breathing-4w', 0), screening })
    expect(plan).toMatchObject({ practiceId: 'slow', params: { rate: 7, ratio: 'long' } })
    expect(breathing4wProgram.weeks[0]?.daily.params).toEqual({ rate: 7 })
    // 没有调整时不带参数
    expect(rec({ now: at(12) }).params).toBeUndefined()
  })

  it('有创伤经历时，默认时长被调短的练习也推荐调短后的时长', () => {
    const r = rec({ now: at(9), screening: { trauma: true } })
    expect(r).toMatchObject({ practiceId: 'focus', minutes: 5, source: 'time' })
    const p = rec({ program: progress('mindfulness-8w', 0), screening: { trauma: true } })
    expect(p).toMatchObject({ practiceId: 'focus', minutes: 5, reason: '八周正念 · 第 1 周第 1 天' })
    expect(picks(p).filter(x => x.practiceId === 'focus')).toHaveLength(1)
    // 声音不受影响
    expect(rec({ now: at(23), screening: { trauma: true } })).toMatchObject({
      practiceId: 'sleep',
      minutes: 45,
    })
  })

  it('有惊恐发作时，哪里都不推荐周期性叹息，换成轻而慢的慢呼吸', () => {
    const screening = { panic: true }
    for (const hour of range(24)) {
      expect(picks(rec({ now: at(hour), screening })).map(p => p.practiceId)).not.toContain('cyclic-sigh')
    }
    const quick = quickPicks(screening)
    expect(quick.map(key)).toEqual(['pause:1', 'breathing-space:3', 'slow:5'])
    expect(quick[2]).toMatchObject({
      label: '慢呼吸',
      duration: '5 分钟',
      params: { rate: 6, ratio: 'long' },
    })
    const hard = hardMoment(screening)
    expect(hard.items[0]).toMatchObject({
      kind: 'practice',
      practiceId: 'slow',
      minutes: 3,
      duration: '3 分钟',
    })
    expect(hard.items[0]).toMatchObject({ label: '慢呼吸', params: { rate: 6, ratio: 'long' } })
  })

  it('任何回答、任何计划进度、任何时段：不推荐不该推荐的练习，时长照调整后的，「换一个」不重复', () => {
    const programs: (ProgramState | null)[] = [
      ...range(PROGRAM_DAYS['mindfulness-8w'] + 1).map(d => progress('mindfulness-8w', d)),
      ...range(PROGRAM_DAYS['breathing-4w'] + 1).map(d => progress('breathing-4w', d)),
    ]
    const problems: string[] = []
    let checked = 0
    const check = (
      r: Recommendation,
      s: Record<ScreeningItem, boolean>,
      bad: Set<PracticeId>,
      where: string,
    ): void => {
      const list = picks(r)
      for (const p of list) {
        if (bad.has(p.practiceId)) problems.push(`${where}：推荐了 ${p.practiceId}`)
        if (!isCatalogPracticeId(p.practiceId)) {
          problems.push(`${where}：${p.practiceId} 不在目录里`)
          continue
        }
        const adjusted = adjustedDefaults(p.practiceId, s)
        if (!adjusted.durations.includes(p.minutes)) problems.push(`${where}：${key(p)} 不在可选时长里`)
        if (adjusted.shortened && p.minutes > adjusted.defaultMinutes)
          problems.push(`${where}：${key(p)} 超过调短后的默认`)
        // 健康情况调整过节拍的，推荐带着调整后的节拍（计划自己的速度除外）
        const paced = adjusted.paced
        if (paced?.type === 'resonance' && paced !== PRACTICE_BY_ID[p.practiceId].paced) {
          if (p.params?.ratio !== paced.ratio) problems.push(`${where}：${key(p)} 没带调整后的节拍`)
          if (!p.plan && p.params?.rate !== paced.rate) problems.push(`${where}：${key(p)} 速度不对`)
        }
      }
      if (new Set(list.map(key)).size !== list.length) problems.push(`${where}：有重复`)
      if (r.alternatives.length < 3) problems.push(`${where}：「换一个」不足三项`)
      checked++
    }
    for (const s of ALL_SCREENINGS) {
      const bad = notForThem(s)
      const answer = SCREENING_ITEMS.filter(item => s[item]).join('+') || '无'
      for (const hour of [0, 9, 12, 15, 20]) {
        for (const lastPracticeAt of [null, '2026-10-01']) {
          check(
            recommend({ now: at(hour), program: null, lastPracticeAt, screening: s }),
            s,
            bad,
            `${answer} ${hour} 点`,
          )
        }
      }
      for (const program of programs) {
        const where = `${answer} ${program?.programId} 完成 ${program?.done.length} 天`
        check(recommend({ now: at(9), program, lastPracticeAt: null, screening: s }), s, bad, where)
      }
      const quick = quickPicks(s)
      if (quick.length !== 3 || quick.some(p => bad.has(p.practiceId))) problems.push(`${answer}：只有几分钟`)
      const hard = hardMoment(s).items
      if (hard.length !== 4 || hard.some(i => i.kind === 'practice' && bad.has(i.practiceId))) {
        problems.push(`${answer}：现在有点难`)
      }
    }
    expect(problems).toEqual([])
    expect(checked).toBeGreaterThan(20_000)
  })

  it('主练习被隐藏、又没有够时长的练习顶替时，按时段推荐在前，计划里剩下的练习排在后面', () => {
    const r = rec({ now: at(9), program: progress('mindfulness-8w', 16), screening: hiding('body-scan') })
    expect(r).toMatchObject({ practiceId: 'focus', minutes: 10, reason: '早上', source: 'time' })
    expect(r.alternatives.at(-1)).toMatchObject({
      practiceId: 'breathing-space',
      minutes: 3,
      reason: '八周正念 · 可选练习',
      plan: { role: 'extra' },
    })
    expect(picks(r).map(p => p.practiceId)).not.toContain('body-scan')
  })

  it('与时段推荐重复的计划练习，留在先出现的位置，但带上计划的信息', () => {
    const r = rec({ now: at(12), program: progress('mindfulness-8w', 16), screening: hiding('body-scan') })
    expect(r.alternatives[0]).toMatchObject({
      practiceId: 'breathing-space',
      minutes: 3,
      reason: '八周正念 · 可选练习',
      plan: { programId: 'mindfulness-8w', role: 'extra' },
    })
    expect(picks(r).filter(p => key(p) === 'breathing-space:3')).toHaveLength(1)
  })

  it('不认识的练习 id 不推荐', () => {
    for (const s of [null, { panic: true }]) {
      for (const p of [
        ...quickPicks(s),
        ...hardMoment(s).items.flatMap(i => (i.kind === 'practice' ? [i] : [])),
      ]) {
        expect(isCatalogPracticeId(p.practiceId)).toBe(true)
      }
    }
  })
})

describe('欢迎回来', () => {
  it('满 3 天才算，按本地日历日计，不按小时', () => {
    expect(WELCOME_BACK_DAYS).toBe(3)
    const now = at(0, 1)
    expect(welcomeBack(null, now)).toBe(false)
    expect(welcomeBack('2026-10-20', now)).toBe(false)
    expect(welcomeBack('2026-10-19', now)).toBe(true)
    // 只隔了两天多一点，但已经跨过三个日历日
    expect(welcomeBack(at(23, 59, 19), now)).toBe(true)
    expect(welcomeBack(at(0, 0, 20), at(23, 59))).toBe(false)
    expect(welcomeBack(at(8, 0, 19).toISOString(), at(9))).toBe(true)
    expect(welcomeBack('2025-01-01', now)).toBe(true)
  })

  it('时间无效或在将来时不算', () => {
    expect(welcomeBack('不是日期', at(9))).toBe(false)
    expect(welcomeBack(new Date(Number.NaN), at(9))).toBe(false)
    expect(welcomeBack('2026-11-30', at(9))).toBe(false)
  })

  it('第一行改为「欢迎回来。先做 1 分钟？」，不写隔了几天；原来的推荐排到「换一个」的第一位', () => {
    const r = rec({ now: at(20), lastPracticeAt: '2026-10-10' })
    expect(r).toMatchObject({
      practiceId: 'pause',
      minutes: 1,
      reason: '欢迎回来。先做 1 分钟？',
      source: 'welcome-back',
    })
    expect(r.reason.replace('1 分钟', '')).not.toMatch(/\d|天/u)
    expect(r.alternatives[0]).toMatchObject({ practiceId: 'body-scan', minutes: 10, reason: '晚上' })

    const p = rec({ now: at(20), lastPracticeAt: '2026-10-10', program: progress('mindfulness-8w', 9) })
    expect(p.source).toBe('welcome-back')
    expect(p.alternatives[0]).toMatchObject({
      practiceId: 'focus',
      minutes: 10,
      reason: '八周正念 · 第 2 周第 3 天',
    })
    expect(p.programDay).toMatchObject({ week: 2, day: 3 })
  })

  it('一分钟停一停不能推荐时换成别的 1 分钟练习；从没练过或刚练过时不说欢迎回来', () => {
    const r = rec({ lastPracticeAt: '2026-10-10', screening: hiding('pause') })
    expect(r).toMatchObject({ practiceId: 'cyclic-sigh', minutes: 1, source: 'welcome-back' })
    const panic = rec({ lastPracticeAt: '2026-10-10', screening: { panic: true } })
    expect(panic).toMatchObject({ practiceId: 'pause', minutes: 1, source: 'welcome-back' })
    expect(rec({ lastPracticeAt: null }).source).toBe('time')
    expect(rec({ lastPracticeAt: '2026-10-21' }).source).toBe('time')
  })
})

describe('日期行', () => {
  it('写出日期、星期和临近的节气', () => {
    expect(dateLine(at(20))).toBe('10月22日 星期四 · 霜降前一日')
    expect(dateLine(at(8, 0, 23))).toBe('10月23日 星期五 · 霜降')
    expect(dateLine(at(8, 0, 10))).toBe('10月10日 星期六')
  })
})

describe('快捷面板', () => {
  it('「只有几分钟」：一分钟停一停、三分钟呼吸空间、周期性叹息 5 分钟', () => {
    expect(QUICK_PICKS.map(key)).toEqual(['pause:1', 'breathing-space:3', 'cyclic-sigh:5'])
    expect(QUICK_PICKS.map(p => p.label)).toEqual(['一分钟停一停', '三分钟呼吸空间', '周期性叹息'])
    expect(QUICK_PICKS.map(p => p.duration)).toEqual(['1 分钟', '3 分钟', '5 分钟'])
    expect(quickPicks(null)).toEqual(QUICK_PICKS)
  })

  it('「只有几分钟」每一行显示结构，较长的说明留给读屏；结构与引导词的段落一致', () => {
    expect(QUICK_PICKS.map(p => p.structure)).toEqual([
      '停 · 吸 · 观 · 行',
      '觉察 · 集中 · 扩展',
      '鼻吸 · 补吸 · 长呼',
    ])
    for (const p of QUICK_PICKS) expect(p.hint.endsWith('。'), p.label).toBe(true)
    // 一分钟停一停、三分钟呼吸空间的结构就是各自引导词的段落名
    for (const id of ['pause', 'breathing-space'] as const) {
      const pick = QUICK_PICKS.find(p => p.practiceId === id)
      expect(pick?.structure.split(' · '), id).toEqual(getScript(id).sections.map(x => x.title))
    }
    // 换成轻而慢的慢呼吸时，结构写的是它的节拍
    const panic = quickPicks({ panic: true })
    expect(panic.map(p => p.structure)).toEqual([
      '停 · 吸 · 观 · 行',
      '觉察 · 集中 · 扩展',
      '吸 4 秒 · 呼 6 秒',
    ])
  })

  it('「现在有点难」：周期性叹息 1 分钟、三分钟呼吸空间 · 应对版、落地练习 60 秒、求助方式', () => {
    expect(HARD_MOMENT.title).toBe('现在有点难')
    expect(HARD_MOMENT.items.map(i => (i.kind === 'practice' ? key(i) : i.to))).toEqual([
      'cyclic-sigh:1',
      'breathing-space-coping:3',
      'grounding:1',
      '/help',
    ])
    expect(HARD_MOMENT.items.map(i => i.label)).toEqual([
      '周期性叹息',
      '三分钟呼吸空间 · 应对版',
      '落地练习',
      '求助方式',
    ])
    expect(HARD_MOMENT.items.map(i => (i.kind === 'practice' ? i.duration : ''))).toEqual([
      '1 分钟',
      '3 分钟',
      '60 秒',
      '',
    ])
    expect(hardMoment(null)).toEqual(HARD_MOMENT)
  })

  it('今日页上那一行的提示：默认是设计稿的那一句；换了练习或顺序时跟着面板走', () => {
    expect(HARD_MOMENT.rowHint).toBe(TODAY.hard.rowHint)
    expect(hardMoment({ panic: true }).rowHint).toBe('慢呼吸 · 落地练习 · 求助电话')
    expect(hardMoment({ trauma: true }).rowHint).toBe('落地练习 · 周期性叹息 · 求助电话')
    for (const s of ALL_SCREENINGS) expect(hardMoment(s).rowHint.endsWith(TODAY.hard.phones)).toBe(true)
  })

  it('练习和顺序跟 practices.ts 的 copingOptions 走，求助方式始终在最后', () => {
    for (const s of ALL_SCREENINGS) {
      const items = hardMoment(s).items
      expect(items.flatMap(i => (i.kind === 'practice' ? [key(i)] : []))).toEqual(
        copingOptions(s).map(o => key({ practiceId: o.id, minutes: o.minutes })),
      )
      expect(items.at(-1)).toEqual({ kind: 'link', to: '/help', ...TODAY.hard.help })
    }
  })
})
