/**
 * 练习目录的自检：目录完整、时长和等级符合 PRODUCT §2、文案规则、证据 id 都在证据库里、
 * 引导词的时长范围覆盖可选时长、健康情况检查带来的隐藏和调整，
 * 以及和 safety.ts、今日页、两个计划之间的约定。
 */
import { describe, expect, it } from 'vitest'
import type { Screening } from '@/data/types'
import { describePattern } from '@/engine/patterns'
import {
  adjustedDefaults,
  CATEGORY_LABEL,
  type CatalogPractice,
  type CatalogPracticeId,
  catalogueSections,
  copingOptions,
  isCatalogPracticeId,
  isDiscouraged,
  isHidden,
  isOffered,
  LIGHT_SLOW_PACE,
  PRACTICE_BY_ID,
  PRACTICES,
  SCREENING_ITEMS,
  type ScreeningAnswers,
  type ScreeningItem,
  scriptIdFor,
  soundModeOf,
  V1_UNAVAILABLE,
} from './practices'
import { breathing4wProgram } from './programs/breathing-4w'
import { mindfulness8wProgram } from './programs/mindfulness-8w'
import {
  BREATH_OPENING_LINE,
  findForbidden,
  HEALTH_CHECK,
  type ScreeningKey,
  TECHNIQUE_WARNINGS,
} from './safety'
import { bodyScanScript } from './scripts/body-scan'
import { bodyScanSleepScript } from './scripts/body-scan-sleep'
import { breathCountScript } from './scripts/breath-count'
import { boxScript, cyclicSighScript, slowScript } from './scripts/breathing'
import {
  breathingSpaceCopingScript,
  breathingSpaceIntroScript,
  breathingSpaceScript,
} from './scripts/breathing-space'
import { focusScript } from './scripts/focus'
import { groundingScript } from './scripts/grounding'
import { lovingKindnessScript } from './scripts/loving-kindness'
import { openAwarenessScript } from './scripts/open-awareness'
import { pauseScript } from './scripts/pause'
import { selfCompassionScript } from './scripts/self-compassion'
import { walkingScript } from './scripts/walking'
import { HARD_MOMENT, QUICK_PICKS, TIME_SLOTS } from './today'
import type { Category, Grade, GuidedScript, PracticeId, PracticeKind, ProgramItem, ScriptId } from './types'

interface Spec {
  category: Category
  kind: PracticeKind
  durations: number[]
  defaultMinutes: number
  grade: Grade | null
}

/**
 * PRODUCT §2 的表格。最后三项 PRODUCT 没有写，取值的理由见 practices.ts 各条目的注释：
 * 睡前身体扫描按引导词的 10 / 20 / 30 分钟、默认取今日页深夜推荐的 10 分钟；应对版按引导词 3–5 分钟、默认 3 分钟；
 * 落地练习 60 秒。两种听声音的等级是按声音证据定的
 */
const SPEC: Record<CatalogPracticeId, Spec> = {
  focus: {
    category: 'meditation',
    kind: 'focus',
    durations: [5, 10, 15, 20, 30],
    defaultMinutes: 10,
    grade: 'B',
  },
  'breath-count': {
    category: 'meditation',
    kind: 'count',
    durations: [5, 10, 15],
    defaultMinutes: 10,
    grade: 'C',
  },
  'body-scan': {
    category: 'meditation',
    kind: 'guided',
    durations: [5, 10, 20],
    defaultMinutes: 10,
    grade: 'C',
  },
  'breathing-space': {
    category: 'meditation',
    kind: 'guided',
    durations: [3, 5],
    defaultMinutes: 3,
    grade: 'C',
  },
  'loving-kindness': {
    category: 'meditation',
    kind: 'guided',
    durations: [5, 10, 20],
    defaultMinutes: 10,
    grade: 'B',
  },
  'self-compassion': {
    category: 'meditation',
    kind: 'guided',
    durations: [5],
    defaultMinutes: 5,
    grade: 'B',
  },
  'open-awareness': {
    category: 'meditation',
    kind: 'guided',
    durations: [5, 10, 20],
    defaultMinutes: 10,
    grade: 'C',
  },
  walking: { category: 'meditation', kind: 'guided', durations: [5, 10], defaultMinutes: 5, grade: 'D' },
  pause: { category: 'meditation', kind: 'guided', durations: [1], defaultMinutes: 1, grade: 'D' },
  timer: {
    category: 'meditation',
    kind: 'timer',
    durations: [1, 3, 5, 10, 15, 20, 30, 45, 60],
    defaultMinutes: 5,
    grade: null,
  },
  slow: {
    category: 'breathing',
    kind: 'paced',
    durations: [3, 5, 10, 15, 20],
    defaultMinutes: 5,
    grade: 'B',
  },
  'cyclic-sigh': {
    category: 'breathing',
    kind: 'paced',
    durations: [1, 3, 5],
    defaultMinutes: 5,
    grade: 'C',
  },
  box: { category: 'breathing', kind: 'paced', durations: [3, 5], defaultMinutes: 5, grade: 'C' },
  'pace-finder': {
    category: 'breathing',
    kind: 'assessment',
    durations: [7],
    defaultMinutes: 7,
    grade: null,
  },
  listen: { category: 'sound', kind: 'sound', durations: [10, 20, 30], defaultMinutes: 20, grade: 'C' },
  sleep: { category: 'sound', kind: 'sound', durations: [15, 30, 45, 60, 0], defaultMinutes: 45, grade: 'D' },
  'body-scan-sleep': {
    category: 'meditation',
    kind: 'guided',
    durations: [10, 20, 30],
    defaultMinutes: 10,
    grade: 'C',
  },
  'breathing-space-coping': {
    category: 'meditation',
    kind: 'guided',
    durations: [3, 5],
    defaultMinutes: 3,
    grade: 'C',
  },
  grounding: { category: 'meditation', kind: 'guided', durations: [1], defaultMinutes: 1, grade: 'D' },
}

const ALL_IDS = Object.keys(SPEC) as CatalogPracticeId[]
const HELPER_IDS: readonly CatalogPracticeId[] = ['breathing-space-coping', 'grounding']
/** v1 不提供、等真人录音的两项（PRODUCT.md §2） */
const NOT_IN_V1: readonly CatalogPracticeId[] = ['walking', 'body-scan-sleep']
const LEGACY_IDS = ['resonance', 'extended-exhale', 'rf-assessment', 'soundscape'] as const

const SCRIPTS: Record<ScriptId, GuidedScript> = {
  focus: focusScript,
  'breath-count': breathCountScript,
  'body-scan': bodyScanScript,
  'body-scan-sleep': bodyScanSleepScript,
  'loving-kindness': lovingKindnessScript,
  'self-compassion': selfCompassionScript,
  'breathing-space': breathingSpaceScript,
  'breathing-space-intro': breathingSpaceIntroScript,
  'breathing-space-coping': breathingSpaceCopingScript,
  'open-awareness': openAwarenessScript,
  walking: walkingScript,
  pause: pauseScript,
  grounding: groundingScript,
  slow: slowScript,
  'cyclic-sigh': cyclicSighScript,
  box: boxScript,
}

const only = (item: ScreeningItem): ScreeningAnswers => ({ [item]: true })
const EVERYTHING: ScreeningAnswers = Object.fromEntries(SCREENING_ITEMS.map(item => [item, true]))
const NONE: Screening = {
  pregnancy: false,
  heart: false,
  respiratory: false,
  psychosis: false,
  bipolar: false,
  epilepsy: false,
  trauma: false,
  panic: false,
}
/** 只勾了一项的完整答卷，形状和 Prefs.safety.screening 一样 */
const screeningWith = (item: ScreeningItem): Screening => ({ ...NONE, [item]: true })

/* ---------- 目录完整 ---------- */

describe('目录', () => {
  it('每个练习都在，且只出现一次；旧 id 不在目录里', () => {
    const ids = PRACTICES.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([...ALL_IDS].sort())
    expect(Object.keys(PRACTICE_BY_ID).sort()).toEqual([...ALL_IDS].sort())
    for (const id of ALL_IDS) expect(PRACTICE_BY_ID[id].id).toBe(id)
    for (const p of PRACTICES) expect(PRACTICE_BY_ID[p.id]).toBe(p)
    for (const legacy of LEGACY_IDS) {
      expect(Object.hasOwn(PRACTICE_BY_ID, legacy)).toBe(false)
      expect(isCatalogPracticeId(legacy)).toBe(false)
    }
    expect(isCatalogPracticeId('focus')).toBe(true)
    expect(isCatalogPracticeId('toString')).toBe(false)
  })

  it('类别、类型、时长、默认时长和等级按 PRODUCT §2', () => {
    for (const p of PRACTICES) {
      const spec = SPEC[p.id]
      expect({ id: p.id, category: p.category, kind: p.kind }).toEqual({
        id: p.id,
        category: spec.category,
        kind: spec.kind,
      })
      expect({ id: p.id, durations: p.durations, defaultMinutes: p.defaultMinutes, grade: p.grade }).toEqual({
        id: p.id,
        durations: spec.durations,
        defaultMinutes: spec.defaultMinutes,
        grade: spec.grade,
      })
    }
  })

  it('时长从短到长、不重复，包含默认时长；只有声音类可以有 0（不限）且放在最后', () => {
    for (const p of PRACTICES) {
      expect(p.durations, p.id).toContain(p.defaultMinutes)
      expect(new Set(p.durations).size, p.id).toBe(p.durations.length)
      const timed = p.durations.filter(d => d !== 0)
      expect(timed, p.id).toEqual([...timed].sort((a, b) => a - b))
      for (const d of timed) expect(Number.isInteger(d) && d > 0, `${p.id} ${d}`).toBe(true)
      if (p.durations.includes(0)) {
        expect(p.kind, p.id).toBe('sound')
        expect(p.durations.at(-1), p.id).toBe(0)
        expect(p.defaultMinutes, p.id).not.toBe(0)
      }
    }
  })

  it('等级有效：只有工具类（静坐计时、舒适节律探索）没有等级', () => {
    const grades: (Grade | null)[] = ['A', 'B', 'C', 'D', null]
    for (const p of PRACTICES) {
      expect(grades, p.id).toContain(p.grade)
      expect(p.grade === null, p.id).toBe(p.kind === 'timer' || p.kind === 'assessment')
    }
  })

  it('节拍参数：慢呼吸吸 4.5 · 呼 6.5，周期性叹息 2.5 / 1 / 7，箱式呼吸 4-4-4-4', () => {
    expect(PRACTICE_BY_ID.slow.paced).toEqual({ type: 'resonance', rate: 5.5, ratio: 'long' })
    expect(PRACTICE_BY_ID['cyclic-sigh'].paced).toEqual({ type: 'sigh', cycle: 10.5 })
    expect(PRACTICE_BY_ID.box.paced).toEqual({ type: 'phases', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 })
    // 用引擎核对这些参数实际的意思
    expect(describePattern(PRACTICE_BY_ID.slow.paced!)).toBe('吸 4.5 秒，呼 6.5 秒 · 每分钟 5.5 次')
    expect(describePattern(PRACTICE_BY_ID['cyclic-sigh'].paced!)).toBe(
      '鼻吸 2.5 秒 → 再吸 1 秒 → 嘴呼 7 秒 · 每分钟 5.7 轮',
    )
    expect(describePattern(LIGHT_SLOW_PACE)).toBe('吸 4 秒，呼 6 秒 · 每分钟 6 次')
    const withPace = PRACTICES.filter(p => p.paced).map(p => p.id)
    expect(withPace).toEqual(['slow', 'cyclic-sigh', 'box'])
  })

  it('默认声音：水声优先，睡前用雨声、不放音乐；要听周围声音的、测量和计时不放背景声', () => {
    for (const p of PRACTICES) {
      expect(['none', 'rain', 'stream', 'ocean'], p.id).toContain(p.sound.ambience)
      expect(p.sound.music, p.id).toBe('none')
    }
    for (const id of ['sleep', 'body-scan-sleep'] as const) {
      expect(['rain', 'brown']).toContain(PRACTICE_BY_ID[id].sound.ambience)
      expect(soundModeOf(id)).toBe('sleep')
    }
    const quiet = PRACTICES.filter(p => p.sound.ambience === 'none').map(p => p.id)
    expect(quiet).toEqual([
      'breath-count',
      'open-awareness',
      'walking',
      'pause',
      'timer',
      'pace-finder',
      'grounding',
    ])
    expect(PRACTICE_BY_ID.listen.sound.ambience).toBe('stream')
    expect(soundModeOf('listen')).toBe('relax')
    expect(soundModeOf('focus')).toBe('relax')
  })

  it('目录是冻结的常量，安全提示是自己的一份', () => {
    expect(Object.isFrozen(PRACTICE_BY_ID)).toBe(true)
    expect(Object.isFrozen(PRACTICES)).toBe(true)
    expect(Object.isFrozen(PRACTICE_BY_ID.focus)).toBe(true)
    expect(Object.isFrozen(PRACTICE_BY_ID.focus.steps)).toBe(true)
    expect(Object.isFrozen(PRACTICE_BY_ID.focus.safety)).toBe(true)
    expect(Object.isFrozen(PRACTICE_BY_ID.slow.paced)).toBe(true)
    expect(PRACTICE_BY_ID.focus.safety).not.toBe(TECHNIQUE_WARNINGS.focus)
  })
})

/* ---------- 引导词 ---------- */

describe('引导词', () => {
  it('名称与引导词一致，每个可选时长都在引导词支持的范围里', () => {
    for (const p of PRACTICES) {
      if (!p.scriptId) continue
      expect(p.name, p.id).toContain(SCRIPTS[p.scriptId].title)
      for (const d of p.durations) {
        const sid = scriptIdFor(p.id, d)
        expect(sid, `${p.id} ${d}`).toBeDefined()
        const script = SCRIPTS[sid!]
        expect(script.id).toBe(sid)
        expect(d, `${p.id} ${d} 分钟 → ${sid}`).toBeGreaterThanOrEqual(script.minMinutes)
        expect(d, `${p.id} ${d} 分钟 → ${sid}`).toBeLessThanOrEqual(script.maxMinutes)
      }
    }
  })

  it('三分钟呼吸空间选 5 分钟时读入门两步版', () => {
    expect(scriptIdFor('breathing-space', 3)).toBe('breathing-space')
    expect(scriptIdFor('breathing-space', 5)).toBe('breathing-space-intro')
    expect(scriptIdFor('focus', 5)).toBe('focus')
    expect(scriptIdFor('timer', 5)).toBeUndefined()
  })

  it('有引导词的练习都配上了；计时、测定和声音没有引导词', () => {
    for (const p of PRACTICES) {
      const none = p.kind === 'timer' || p.kind === 'assessment' || p.kind === 'sound'
      expect(p.scriptId === undefined, p.id).toBe(none)
    }
    const used = PRACTICES.flatMap(p => p.durations.map(d => scriptIdFor(p.id, d)))
    for (const sid of Object.keys(SCRIPTS)) expect(used, sid).toContain(sid)
  })

  it('做法里的说法和朗读的一致：周期性叹息吸到七八成，数息点左边和右边', () => {
    const spoken = (s: GuidedScript): string =>
      [...s.opening, ...s.sections.flatMap(x => x.intro), ...s.closing].map(l => l.text).join('')
    expect(spoken(cyclicSighScript)).toContain('七八成满')
    expect(PRACTICE_BY_ID['cyclic-sigh'].steps.join('')).toContain('七八成满')
    expect(PRACTICE_BY_ID['cyclic-sigh'].description).toContain('七八成满')
    expect(spoken(breathCountScript)).toContain('点左边')
    expect(PRACTICE_BY_ID['breath-count'].steps.join('')).toContain('点左边')
    expect(spoken(breathCountScript)).toContain('数到这里就好')
    expect(PRACTICE_BY_ID['breath-count'].steps.join('')).toContain('数到这里就好')
  })
})

/* ---------- 文案 ---------- */

/**
 * 禁用说法以 safety.ts 的 findForbidden 为准（PRODUCT §10–11，全应用一份规则：「治疗失眠」不行，
 * 「心理治疗」可以）。这里再补几个它没收的夸张词，和固定术语的别名
 */
const EXTRA_FORBIDDEN = ['最好', '最佳', '神奇', '100%', '遇见更好的自己', '让我们一起']
const OFF_GLOSSARY = ['循环叹息', '方块呼吸', '慢节律呼吸', '慈爱冥想', '共振呼吸', '呼吸计数']

const copyOf = (p: CatalogPractice): string[] => [
  p.name,
  p.short,
  p.todayLine,
  p.description,
  ...p.steps,
  ...p.evidenceClaims.map(c => c.claim),
  p.evidenceSummary,
  ...p.safety,
]

/** 所有健康情况组合下可能出现的补充提示 */
const allNotes = (): string[] => {
  const notes = new Set<string>()
  for (const id of ALL_IDS) {
    for (const s of [EVERYTHING, ...SCREENING_ITEMS.map(only)]) {
      for (const n of adjustedDefaults(id, s).notes) notes.add(n)
    }
  }
  return [...notes]
}

const ALL_COPY = [
  ...PRACTICES.flatMap(copyOf),
  ...allNotes(),
  ...Object.values(CATEGORY_LABEL),
  ...catalogueSections().flatMap(s => s.groups.flatMap(g => (g.title ? [g.title] : []))),
]

const HAN = '\\p{Script=Han}'
/** 中文与数字、拉丁字母之间要留空格（PRODUCT §11） */
const TIGHT = new RegExp(`${HAN}[A-Za-z0-9%]|[A-Za-z0-9%]${HAN}`, 'u')
const GRADE_WORD: Record<Grade, string> = { A: '强', B: '中等', C: '有限', D: '不足' }
const count = (s: string, ch: string): number => s.split(ch).length - 1

/** 两段文字里最长的相同片段（按字计） */
function longestShared(a: string, b: string): string {
  let best = ''
  for (let i = 0; i < a.length; i++) {
    for (let j = i + best.length + 1; j <= a.length; j++) {
      const piece = a.slice(i, j)
      if (!b.includes(piece)) break
      best = piece
    }
  }
  return best
}

describe('文案', () => {
  it('没有禁用的说法，术语固定', () => {
    for (const s of ALL_COPY) {
      expect(findForbidden(s), s).toEqual([])
      for (const w of [...EXTRA_FORBIDDEN, ...OFF_GLOSSARY]) expect(s, `「${w}」：${s}`).not.toContain(w)
    }
    // 自己的文案连「不比……治疗」这样的比较也不用，写「专门针对失眠的方法」；详情页上的安全提示也一样
    for (const p of PRACTICES) {
      for (const s of copyOf(p)) expect(s, s).not.toMatch(/治疗|疗法/)
    }
  })

  it('全角标点，没有感叹号和表情符号，中文与数字、字母之间留空格', () => {
    for (const s of ALL_COPY) {
      expect(s, s).not.toMatch(/[!！]/)
      expect(s, s).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(s, s).not.toMatch(/[,;:?()"']/)
      // 半角句点只出现在小数里
      expect(s, s).not.toMatch(/(?<!\d)\.|\.(?!\d)/)
      expect(s, s).not.toMatch(TIGHT)
      expect(s, s).toBe(s.trim())
      expect(s, s).not.toContain('  ')
      expect(count(s, '「'), s).toBe(count(s, '」'))
      expect(count(s, '（'), s).toBe(count(s, '）'))
    }
  })

  it('一句话说明不超过 18 个字，不带句号', () => {
    for (const p of PRACTICES) {
      expect([...p.short.replaceAll(' ', '')].length, p.short).toBeLessThanOrEqual(18)
      expect(p.short, p.id).not.toMatch(/[。，；]$/)
    }
  })

  it('介绍 2–4 句；做法 3–5 步；证据摘要一句；安全提示至少一条，都以句号结尾', () => {
    for (const p of PRACTICES) {
      const sentences = count(p.description, '。')
      expect(sentences, p.id).toBeGreaterThanOrEqual(2)
      expect(sentences, p.id).toBeLessThanOrEqual(4)
      expect(p.description.endsWith('。'), p.id).toBe(true)
      expect(p.steps.length, p.id).toBeGreaterThanOrEqual(3)
      expect(p.steps.length, p.id).toBeLessThanOrEqual(5)
      for (const step of p.steps) expect(step.endsWith('。'), step).toBe(true)
      expect(count(p.evidenceSummary, '。'), p.evidenceSummary).toBe(1)
      expect(p.evidenceSummary.endsWith('。'), p.id).toBe(true)
      expect(p.safety.length, p.id).toBeGreaterThan(0)
      for (const line of p.safety) expect(line.endsWith('。'), line).toBe(true)
    }
  })

  it('介绍里「证据：……」的说法与等级一致，工具类不写', () => {
    for (const p of PRACTICES) {
      const labels = [...p.description.matchAll(/证据：(强|中等|有限|不足)/g)].map(m => m[1])
      expect(labels, p.id).toEqual(p.grade ? [GRADE_WORD[p.grade]] : [])
    }
  })

  it('证据摘要写明和什么比；介绍不照抄证据摘要', () => {
    for (const p of PRACTICES) {
      expect(p.evidenceSummary, p.id).toMatch(/比|对照/)
      const shared = longestShared(p.description, p.evidenceSummary)
      expect([...shared].length, `${p.id}：「${shared}」`).toBeLessThan(15)
    }
  })

  it('今日页的一句：一两句话、以句号结尾，不长于两行，不照抄一句话说明', () => {
    for (const p of PRACTICES) {
      const sentences = count(p.todayLine, '。')
      expect(sentences, p.id).toBeGreaterThanOrEqual(1)
      expect(sentences, p.id).toBeLessThanOrEqual(2)
      expect(p.todayLine.endsWith('。'), p.id).toBe(true)
      expect([...p.todayLine.replaceAll(' ', '')].length, p.todayLine).toBeLessThanOrEqual(40)
      expect(p.todayLine, p.id).not.toBe(p.short)
    }
    // 设计稿的样句（DESIGN.md §13.2）
    expect(PRACTICE_BY_ID['body-scan'].todayLine).toBe(
      '从左腿开始，一处一处往上，留意身体的感觉。可以躺着练，睡着了也没关系。',
    )
    // 慢呼吸的那一句就是呼吸练习开头的提醒；节律会变，所以不写秒数
    expect(PRACTICE_BY_ID.slow.todayLine.endsWith(BREATH_OPENING_LINE)).toBe(true)
    expect(PRACTICE_BY_ID.slow.todayLine).not.toMatch(/\d/)
  })

  it('身体扫描的今日一句，第一个部位就是引导词里第一处身体部位（进度图的第一级）', () => {
    for (const [id, script] of [
      ['body-scan', bodyScanScript],
      ['body-scan-sleep', bodyScanSleepScript],
    ] as const) {
      // 进度图的标签是段落名，长于两个字时取第一个词；第一段是呼吸
      const first = script.sections.find(x => x.title !== '呼吸')?.title ?? ''
      const label = first.length > 2 ? first.slice(0, 2) : first
      expect(PRACTICE_BY_ID[id].todayLine, id).toContain(`从${label}开始`)
    }
  })

  it('安全提示就是 safety.ts 里这项练习的那几条（只有一个来源）', () => {
    for (const p of PRACTICES) expect(p.safety, p.id).toEqual(TECHNIQUE_WARNINGS[p.id])
  })

  it('呼吸练习都提醒轻柔、不必吸深，以及不在水中、驾驶时练', () => {
    const breathing = PRACTICES.filter(p => p.category === 'breathing')
    expect(breathing.map(p => p.id)).toEqual(['slow', 'cyclic-sigh', 'box', 'pace-finder'])
    for (const p of breathing) {
      // 周期性叹息本来就要吸到七八成再补一口，第一条改说「吸气要轻」，与引导词一致（待产品确认）
      if (p.id === 'cyclic-sigh') expect(p.safety[0]).toMatch(/^吸气要轻.*七八成满/)
      else expect(p.safety[0]?.startsWith(BREATH_OPENING_LINE), p.id).toBe(true)
      expect(
        p.safety.some(s => s.includes('不要在水中') && s.includes('驾驶')),
        p.id,
      ).toBe(true)
      expect(
        p.safety.some(s => s.includes('发麻')),
        p.id,
      ).toBe(true)
    }
    const box = PRACTICE_BY_ID.box.safety
    expect(box.some(s => s.includes('不要用力憋气'))).toBe(true)
    expect(box.some(s => s.includes('怀孕') && s.includes('慢阻肺'))).toBe(true)
  })
})

/* ---------- 证据 ---------- */

interface Claim {
  id: string
  weight?: string
  rejected: boolean
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

/** 证据库可能是数组，也可能是 { claims: [...] } 或以 id 为键的对象；被否决的条目标为 rejected */
function claimsIn(json: unknown): Claim[] {
  let items: unknown[] = []
  const rejectedIds = new Set<string>()
  if (Array.isArray(json)) items = json
  else if (isRecord(json)) {
    if (Array.isArray(json.claims)) items = json.claims
    else
      items = Object.entries(json).map(([key, v]) =>
        isRecord(v) && v.id === undefined ? { ...v, id: key } : v,
      )
    if (Array.isArray(json.rejected)) {
      for (const r of json.rejected as unknown[]) {
        if (typeof r === 'string') rejectedIds.add(r)
        else if (isRecord(r) && typeof r.id === 'string') rejectedIds.add(r.id)
      }
    }
  }
  return items.flatMap((item): Claim[] => {
    if (!isRecord(item) || typeof item.id !== 'string') return []
    const v = item.verification
    const verdict = isRecord(v) && typeof v.verdict === 'string' ? v.verdict : item.status
    return [
      {
        id: item.id,
        weight: typeof item.evidence_weight === 'string' ? item.evidence_weight : undefined,
        rejected: verdict === 'rejected' || item.rejected === true || rejectedIds.has(item.id),
      },
    ]
  })
}

/** 研究组定稿的证据库（已提交到仓库）；读不到时下面的测试失败，不跳过 */
const FINAL = import.meta.glob('../../docs/research/evidence.json', { eager: true, import: 'default' })
const CLAIMS = new Map(
  Object.values(FINAL)
    .flatMap(claimsIn)
    .map(c => [c.id, c] as const),
)
const RANK: Record<string, number> = { high: 0, moderate: 1, low: 2, 'very-low': 3 }

describe('证据 id', () => {
  it('读到了证据库', () => {
    expect(CLAIMS.size).toBeGreaterThan(100)
  })

  it('每项 2–5 个，不重复，格式正确', () => {
    for (const p of PRACTICES) {
      expect(p.evidence.length, p.id).toBeGreaterThanOrEqual(2)
      expect(p.evidence.length, p.id).toBeLessThanOrEqual(5)
      expect(new Set(p.evidence).size, p.id).toBe(p.evidence.length)
      for (const id of p.evidence)
        expect(id).toMatch(/^(meditation|breathing|sound|safety|ux|practice)-[a-z0-9-]+$/)
    }
  })

  it('都在证据库里，没有被否决的', () => {
    for (const p of PRACTICES) {
      for (const id of p.evidence) {
        const claim = CLAIMS.get(id)
        expect(claim, `${p.id}：${id}`).toBeDefined()
        expect(claim?.rejected, `${p.id}：${id}`).toBe(false)
      }
    }
  })

  it('按证据强弱排列，强的在前', () => {
    for (const p of PRACTICES) {
      const ranks = p.evidence.map(id => RANK[CLAIMS.get(id)?.weight ?? ''] ?? Number.POSITIVE_INFINITY)
      expect(ranks, `${p.id}：${p.evidence.join(', ')}`).toEqual([...ranks].sort((a, b) => a - b))
    }
  })
})

/* ---------- 详情页的结论 ---------- */

describe('结论（evidenceClaims）', () => {
  it('每项 1–4 条，一条一句、以句号结尾；等级有效，至少一条与练习的等级相同', () => {
    for (const p of PRACTICES) {
      expect(p.evidenceClaims.length, p.id).toBeGreaterThanOrEqual(1)
      expect(p.evidenceClaims.length, p.id).toBeLessThanOrEqual(4)
      for (const c of p.evidenceClaims) {
        expect(count(c.claim, '。'), c.claim).toBe(1)
        expect(c.claim.endsWith('。'), c.claim).toBe(true)
        expect(['A', 'B', 'C', 'D'], c.claim).toContain(c.grade)
        // 不再有「证据：……」的括注：等级单独显示在每条下面
        expect(c.claim, c.claim).not.toMatch(/证据：/)
      }
      if (p.grade)
        expect(
          p.evidenceClaims.map(c => c.grade),
          p.id,
        ).toContain(p.grade)
    }
  })

  it('引用的 id 都在这项练习的 evidence 里，不重复；每条至少一个', () => {
    for (const p of PRACTICES) {
      for (const c of p.evidenceClaims) {
        expect(c.cites.length, c.claim).toBeGreaterThan(0)
        expect(new Set(c.cites).size, c.claim).toBe(c.cites.length)
        for (const id of c.cites) expect(p.evidence, `${p.id}：${id}`).toContain(id)
      }
    }
  })

  it('至少一条写明和什么比', () => {
    for (const p of PRACTICES)
      expect(
        p.evidenceClaims.some(c => /比|对照/.test(c.claim)),
        p.id,
      ).toBe(true)
  })

  it('慢呼吸照设计稿拆成两条，都是 B（DESIGN.md §14.3）', () => {
    expect(PRACTICE_BY_ID.slow.evidenceClaims).toEqual([
      {
        claim: '慢呼吸时心率变异性增大（练习时增幅中等，练完后增幅较小）。',
        grade: 'B',
        cites: ['breathing-laborde-2022-meta'],
      },
      {
        claim:
          '一项 400 人的安慰剂对照试验里，每分钟 5.5 次在压力、焦虑、抑郁和幸福感上，都不比每分钟 12 次的轻柔呼吸更好。',
        grade: 'B',
        cites: ['breathing-fincham-2023-rct'],
      },
    ])
  })

  it('课程的结果和单独练这一项的结果分开说，各带各的等级', () => {
    // 老师带领的课程与不练习相比为 A，只用应用为 B（meditation.notes §2；PRODUCT.md §0「文案要分开说」）
    expect(PRACTICE_BY_ID.focus.evidenceClaims.map(c => c.grade)).toEqual(['A', 'B', 'B'])
    // 单独练身体扫描：正念水平 C，健康指标 D
    expect(PRACTICE_BY_ID['body-scan'].evidenceClaims.map(c => c.grade)).toEqual(['C', 'D'])
  })

  it('旧的一句话摘要由各条结论连成，留给还没改过来的代码', () => {
    for (const p of PRACTICES) {
      expect(p.evidenceSummary, p.id).toBe(
        `${p.evidenceClaims.map(c => c.claim.replace(/。$/, '')).join('；')}。`,
      )
    }
  })
})

/* ---------- 分组 ---------- */

describe('练习页的分组', () => {
  it('冥想、呼吸、声音三组；声音里分放松和睡前；辅助练习和 v1 不提供的练习不进目录', () => {
    const sections = catalogueSections()
    expect(sections.map(s => s.title)).toEqual(['冥想', '呼吸', '声音'])
    expect(sections.map(s => s.category)).toEqual(['meditation', 'breathing', 'sound'])
    // 睡前身体扫描 v1 不提供，「睡前」里只有听声音
    expect(sections[2]?.groups).toEqual([
      { title: '放松', ids: ['listen'] },
      { title: '睡前', ids: ['sleep'] },
    ])
    expect(sections[0]?.groups.flatMap(g => g.ids)).toEqual([
      'focus',
      'breath-count',
      'body-scan',
      'breathing-space',
      'loving-kindness',
      'self-compassion',
      'open-awareness',
      'pause',
      'timer',
    ])
    const listed = sections.flatMap(s => s.groups.flatMap(g => g.ids))
    expect(new Set(listed).size).toBe(listed.length)
    expect([...listed].sort()).toEqual(
      ALL_IDS.filter(id => !HELPER_IDS.includes(id) && !NOT_IN_V1.includes(id)).sort(),
    )
    expect(listed).toHaveLength(15)
    // 全部练习的顺序：目录里的顺序，再接辅助练习；v1 不提供的两项也在数据里，排在原来的位置
    expect(PRACTICES.map(p => p.id).filter(isOffered)).toEqual([...listed, ...HELPER_IDS])
    for (const s of sections.slice(0, 2)) {
      for (const id of s.groups.flatMap(g => g.ids)) expect(PRACTICE_BY_ID[id].category).toBe(s.category)
    }
  })

  it('按健康情况去掉隐藏的练习', () => {
    const ids = (s?: ScreeningAnswers | null) =>
      catalogueSections(s).flatMap(x => x.groups.flatMap(g => g.ids))
    expect(ids(null)).toEqual(ids())
    expect(ids({ psychosis: true })).not.toContain('open-awareness')
    expect(ids({ pregnancy: true })).not.toContain('box')
    expect(ids({ trauma: true })).toEqual(ids())
    expect(ids(EVERYTHING).length).toBe(ids().length - 2)
  })

  it('每一类记下隐藏了哪些练习，界面据此写一句说明', () => {
    const hidden = (s?: ScreeningAnswers | null) => catalogueSections(s).map(x => [x.category, x.hidden])
    expect(hidden()).toEqual([
      ['meditation', []],
      ['breathing', []],
      ['sound', []],
    ])
    expect(hidden(EVERYTHING)).toEqual([
      ['meditation', ['open-awareness']],
      ['breathing', ['box']],
      ['sound', []],
    ])
    expect(hidden({ trauma: true })).toEqual(hidden())
  })
})

/* ---------- v1 提供哪些练习 ---------- */

describe('v1 提供的练习（PRODUCT.md §0、§2）', () => {
  it('正念行走和睡前身体扫描暂不提供：只有这一处名单，isOffered 照它回答', () => {
    expect([...V1_UNAVAILABLE].sort()).toEqual([...NOT_IN_V1].sort())
    for (const id of ALL_IDS) expect(isOffered(id), id).toBe(!NOT_IN_V1.includes(id))
    for (const id of [...LEGACY_IDS, 'toString', '']) expect(isOffered(id), id).toBe(false)
  })

  it('数据和引导词都留着，等真人录音', () => {
    for (const id of NOT_IN_V1) {
      expect(PRACTICE_BY_ID[id].id).toBe(id)
      expect(PRACTICE_BY_ID[id].scriptId, id).toBeDefined()
      expect(PRACTICES.map(p => p.id)).toContain(id)
    }
  })

  it('练习页和「现在有点难」在任何健康情况下都不列它们，也不算作隐藏', () => {
    for (const s of [undefined, null, EVERYTHING, ...SCREENING_ITEMS.map(only)]) {
      const sections = catalogueSections(s)
      const shown = sections.flatMap(x => [...x.groups.flatMap(g => g.ids), ...x.hidden])
      for (const id of NOT_IN_V1) expect(shown, id).not.toContain(id)
      for (const o of copingOptions(s)) expect(isOffered(o.id), o.id).toBe(true)
    }
  })
})

/* ---------- 健康情况检查 ---------- */

describe('健康情况检查', () => {
  it('题目与 data/types.ts 的 Screening 一致，可以直接传入', () => {
    type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
    const sameKeys: Same<keyof Screening, ScreeningItem> = true
    expect(sameKeys).toBe(true)
    expect([...SCREENING_ITEMS].sort()).toEqual(Object.keys(NONE).sort())
    expect(catalogueSections(NONE)).toEqual(catalogueSections())
    for (const id of ALL_IDS) {
      expect(isHidden(id, NONE)).toBe(false)
      expect(adjustedDefaults(id, NONE)).toEqual(adjustedDefaults(id))
    }
  })

  it('开放觉察在有精神病性症状或双相时隐藏；箱式呼吸在孕期、心脑血管病、哮喘或慢阻肺时隐藏；其余不隐藏', () => {
    const expected = (id: CatalogPracticeId, item: ScreeningItem): boolean =>
      (id === 'open-awareness' && (item === 'psychosis' || item === 'bipolar')) ||
      (id === 'box' && (item === 'pregnancy' || item === 'heart' || item === 'respiratory'))
    for (const id of ALL_IDS) {
      expect(isHidden(id), id).toBe(false)
      expect(isHidden(id, null), id).toBe(false)
      expect(isHidden(id, {}), id).toBe(false)
      for (const item of SCREENING_ITEMS)
        expect(isHidden(id, only(item)), `${id} ${item}`).toBe(expected(id, item))
    }
    for (const legacy of LEGACY_IDS) expect(isHidden(legacy, EVERYTHING)).toBe(false)
  })

  it('常有创伤闪回时，开放觉察看得到，但不推荐；其余情况都不影响', () => {
    for (const id of ALL_IDS) {
      expect(isDiscouraged(id), id).toBe(false)
      for (const item of SCREENING_ITEMS)
        expect(isDiscouraged(id, only(item)), `${id} ${item}`).toBe(
          id === 'open-awareness' && item === 'trauma',
        )
    }
    expect(isHidden('open-awareness', only('trauma'))).toBe(false)
    expect(catalogueSections(only('trauma'))).toEqual(catalogueSections())
  })

  it('与 safety.ts 的健康情况检查一致：同样的八项，隐藏的练习和写给用户的说明对得上', () => {
    type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
    const sameKeys: Same<ScreeningKey, ScreeningItem> = true
    expect(sameKeys).toBe(true)
    expect(HEALTH_CHECK.items.map(i => i.id).sort()).toEqual([...SCREENING_ITEMS].sort())
    for (const item of HEALTH_CHECK.items) {
      const s = screeningWith(item.id)
      const hidden = ALL_IDS.filter(id => isHidden(id, s))
      expect(hidden, item.id).toEqual(
        ALL_IDS.filter(id => (item.hides as readonly PracticeId[]).includes(id)),
      )
      // 说明里提到周期性叹息，当且仅当「现在有点难」真的换掉了它
      const swapped = !copingOptions(s).some(o => o.id === 'cyclic-sigh')
      expect(item.adaptation.includes('周期性叹息'), item.id).toBe(swapped)
    }
  })

  it('没做检查时，默认值就是目录里的', () => {
    for (const p of PRACTICES) {
      const d = adjustedDefaults(p.id)
      expect(d.durations).toEqual(p.durations)
      expect(d.defaultMinutes).toBe(p.defaultMinutes)
      expect(d.paced).toEqual(p.paced)
      expect(d.notes).toEqual([])
      expect(d.guidance).toBeUndefined()
      expect(d.shortened).toBe(false)
    }
    const eyesOpen = PRACTICES.filter(p => adjustedDefaults(p.id).eyesOpen).map(p => p.id)
    expect(eyesOpen).toEqual(['breath-count', 'walking', 'breathing-space-coping', 'grounding'])
  })

  it('任何组合下，时长都是原来的子集、顺序不变，默认时长在其中', () => {
    for (const p of PRACTICES) {
      for (const s of [EVERYTHING, ...SCREENING_ITEMS.map(only)]) {
        const d = adjustedDefaults(p.id, s)
        expect(d.durations.length, p.id).toBeGreaterThan(0)
        expect(d.durations, p.id).toEqual(p.durations.filter(x => d.durations.includes(x)))
        expect(d.durations, p.id).toContain(d.defaultMinutes)
      }
    }
  })

  it('有创伤、幻觉妄想或双相时：每次不超过 10 分钟，默认更短，睁眼，引导更连续；睡前身体扫描只缩短', () => {
    for (const item of ['trauma', 'psychosis', 'bipolar'] as const) {
      for (const p of PRACTICES) {
        const d = adjustedDefaults(p.id, only(item))
        if (p.category === 'sound' || p.id === 'grounding') {
          expect(d, `${p.id} ${item}`).toEqual(adjustedDefaults(p.id))
          continue
        }
        expect(Math.max(...d.durations), `${p.id} ${item}`).toBeLessThanOrEqual(10)
        expect(d.defaultMinutes, `${p.id} ${item}`).toBeLessThanOrEqual(p.defaultMinutes)
        expect(d.shortened, `${p.id} ${item}`).toBe(true)
        expect(d.notes.length, `${p.id} ${item}`).toBeGreaterThan(0)
        // 躺在床上、为了入睡：不改成睁眼，也不改成说个不停的详细档
        const bedtime = soundModeOf(p.id) === 'sleep'
        expect(d.eyesOpen, `${p.id} ${item}`).toBe(!bedtime)
        expect(d.guidance, `${p.id} ${item}`).toBe(p.scriptId && !bedtime ? 'detailed' : undefined)
        // 补充提示不和默认打架：没改成睁眼的，提示里也不叫人睁着眼睛练
        if (!d.eyesOpen) expect(d.notes.join(''), `${p.id} ${item}`).not.toContain('睁着眼睛')
      }
    }
    const trauma = only('trauma')
    expect(adjustedDefaults('focus', trauma)).toMatchObject({ durations: [5, 10], defaultMinutes: 5 })
    expect(adjustedDefaults('timer', trauma)).toMatchObject({ durations: [1, 3, 5, 10], defaultMinutes: 5 })
    expect(adjustedDefaults('body-scan-sleep', trauma)).toMatchObject({ durations: [10], defaultMinutes: 10 })
    expect(adjustedDefaults('pace-finder', trauma)).toMatchObject({ durations: [7], defaultMinutes: 7 })
    expect(adjustedDefaults('breathing-space', trauma)).toMatchObject({
      durations: [3, 5],
      defaultMinutes: 3,
    })
    expect(adjustedDefaults('slow', trauma)).toMatchObject({ durations: [3, 5, 10], defaultMinutes: 5 })
    expect(adjustedDefaults('focus', trauma).notes.join('')).toContain('创伤')
    expect(adjustedDefaults('focus', only('bipolar')).notes.join('')).toContain('医生')
    // 双相另外写出躁狂的早期信号；只有幻觉妄想时不写
    expect(adjustedDefaults('focus', only('bipolar')).notes.join('')).toContain('睡得很少却不觉得累')
    expect(adjustedDefaults('focus', only('psychosis')).notes.join('')).not.toContain('睡得很少')
  })

  it('有精神病性症状或双相时，没有引导的静坐计时最长 5 分钟', () => {
    for (const item of ['psychosis', 'bipolar'] as const) {
      expect(adjustedDefaults('timer', only(item))).toMatchObject({ durations: [1, 3, 5], defaultMinutes: 5 })
    }
    expect(adjustedDefaults('timer', only('trauma')).durations).toContain(10)
  })

  it('有惊恐发作时：慢呼吸默认轻而慢（每分钟 6 次），冥想建议睁眼、用外部的锚点', () => {
    const panic = only('panic')
    expect(adjustedDefaults('slow', panic).paced).toEqual(LIGHT_SLOW_PACE)
    expect(adjustedDefaults('slow', panic).durations).toEqual(PRACTICE_BY_ID.slow.durations)
    expect(adjustedDefaults('cyclic-sigh', panic).paced).toEqual(PRACTICE_BY_ID['cyclic-sigh'].paced)
    const focus = adjustedDefaults('focus', panic)
    expect(focus.eyesOpen).toBe(true)
    expect(focus.shortened).toBe(false)
    expect(focus.notes.join('')).toMatch(/双脚|声音/)
    expect(focus.durations).toEqual(PRACTICE_BY_ID.focus.durations)
    // 本来就睁眼做的练习，不再叫人睁眼；行走的锚点本来就是脚底；睡前身体扫描不改成睁眼
    expect(adjustedDefaults('breath-count', panic).notes.join('')).not.toContain('睁着眼睛')
    expect(adjustedDefaults('walking', panic).notes).toEqual([])
    expect(adjustedDefaults('body-scan-sleep', panic)).toMatchObject({ eyesOpen: false, notes: [] })
    // 同一件事不说两遍：周期性叹息的安全提示里已经有「有惊恐发作的话，先用轻柔的慢呼吸」
    expect(PRACTICE_BY_ID['cyclic-sigh'].safety.some(s => s.includes('惊恐') && s.includes('慢呼吸'))).toBe(
      true,
    )
    expect(adjustedDefaults('cyclic-sigh', panic)).toMatchObject({ notes: [], eyesOpen: true })
  })

  it('需要轻柔呼吸的情况下，周期性叹息建议先做慢呼吸', () => {
    for (const item of ['epilepsy', 'pregnancy', 'heart', 'respiratory'] as const) {
      expect(adjustedDefaults('cyclic-sigh', only(item)).notes.join(''), item).toContain('慢呼吸')
    }
    for (const item of ['trauma', 'psychosis', 'bipolar'] as const) {
      expect(adjustedDefaults('cyclic-sigh', only(item)).notes.join(''), item).not.toContain('慢呼吸')
    }
  })

  it('癫痫、孕期、心脑血管病、肺部疾病：呼吸练习加提示，冥想不变', () => {
    const expectedWord: Record<'epilepsy' | 'pregnancy' | 'heart' | 'respiratory', string> = {
      epilepsy: '神经科',
      pregnancy: '憋气',
      heart: '憋气',
      respiratory: '吸入药物',
    }
    for (const [item, word] of Object.entries(expectedWord) as [ScreeningItem, string][]) {
      for (const p of PRACTICES) {
        const d = adjustedDefaults(p.id, only(item))
        if (p.category === 'breathing') expect(d.notes.join(''), `${p.id} ${item}`).toContain(word)
        else expect(d, `${p.id} ${item}`).toEqual(adjustedDefaults(p.id))
      }
    }
  })

  it('补充提示不重复，也不重复这项练习本来的安全提示', () => {
    for (const p of PRACTICES) {
      for (const s of [EVERYTHING, ...SCREENING_ITEMS.map(only)]) {
        const notes = adjustedDefaults(p.id, s).notes
        expect(new Set(notes).size, p.id).toBe(notes.length)
        for (const n of notes) expect(p.safety, p.id).not.toContain(n)
      }
    }
  })
})

/* ---------- 现在有点难 ---------- */

describe('「现在有点难」', () => {
  it('默认：周期性叹息 1 分钟、呼吸空间应对版 3 分钟、落地练习 1 分钟', () => {
    expect(copingOptions()).toEqual([
      { id: 'cyclic-sigh', minutes: 1 },
      { id: 'breathing-space-coping', minutes: 3 },
      { id: 'grounding', minutes: 1 },
    ])
    expect(copingOptions(null)).toEqual(copingOptions())
  })

  it('惊恐发作、癫痫、孕期、心脑血管或肺部疾病时，换成 3 分钟轻而慢的慢呼吸', () => {
    for (const item of ['panic', 'epilepsy', 'pregnancy', 'heart', 'respiratory'] as const) {
      expect(copingOptions(only(item))[0], item).toEqual({ id: 'slow', minutes: 3, paced: LIGHT_SLOW_PACE })
    }
  })

  it('有创伤闪回、幻觉妄想或双相时，落地练习排第一，其余两项照常', () => {
    for (const item of ['trauma', 'psychosis', 'bipolar'] as const) {
      const [grounding, ...rest] = copingOptions(only(item))
      expect(grounding, item).toEqual({ id: 'grounding', minutes: 1 })
      expect(rest, item).toEqual(copingOptions().filter(o => o.id !== 'grounding'))
    }
    // 两种情况叠加：落地练习在前，呼吸换成慢呼吸
    expect(copingOptions({ trauma: true, panic: true }).map(o => o.id)).toEqual([
      'grounding',
      'slow',
      'breathing-space-coping',
    ])
  })

  it('给的时长都是这项练习可选的，也不会是被隐藏的练习', () => {
    for (const s of [undefined, EVERYTHING, ...SCREENING_ITEMS.map(only)]) {
      for (const launch of copingOptions(s)) {
        expect(PRACTICE_BY_ID[launch.id].durations).toContain(launch.minutes)
        expect(isHidden(launch.id, s)).toBe(false)
      }
    }
  })
})

/* ---------- 与今日页、计划的约定 ---------- */

describe('今日页和计划用到的练习', () => {
  /** 用到的练习都在目录里，时长是这项练习可选的 */
  const expectValid = (practiceId: PracticeId, minutes: number, where: string): void => {
    expect(isCatalogPracticeId(practiceId), `${where}：${practiceId}`).toBe(true)
    if (!isCatalogPracticeId(practiceId)) return
    expect(PRACTICE_BY_ID[practiceId].durations, `${where}：${practiceId} ${minutes} 分钟`).toContain(minutes)
  }

  it('今日页的推荐、「只有几分钟」和「现在有点难」', () => {
    for (const [slot, choices] of Object.entries(TIME_SLOTS)) {
      for (const c of choices) expectValid(c.practiceId, c.minutes, `今日 ${slot}`)
    }
    for (const c of QUICK_PICKS) expectValid(c.practiceId, c.minutes, '只有几分钟')
    for (const item of HARD_MOMENT.items) {
      if (item.kind === 'practice') expectValid(item.practiceId, item.minutes, '现在有点难')
    }
  })

  it('八周正念和四周呼吸的每一天', () => {
    for (const program of [mindfulness8wProgram, breathing4wProgram]) {
      for (const week of program.weeks) {
        const items: ProgramItem[] = [week.daily, ...(week.short ? [week.short] : []), ...(week.extra ?? [])]
        for (const item of items)
          expectValid(item.practiceId, item.minutes, `${program.id} 第 ${week.week} 周`)
      }
    }
  })
})
