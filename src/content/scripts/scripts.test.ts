/**
 * 全部引导词的总检，取代原来每份引导词各自的 __checks__。
 *
 * 1. 登记：SCRIPTS 收齐每个 ScriptId；练习目录里每个（练习, 时长）都落在下表的一份引导词和一个时长上。
 * 2. 结构：段落 id 不重复；文字不空（只占时间的空行要写明停顿）；minMinutes、omitAtOrBelow 在时长范围内；
 *    skippable 只写在段落上。
 * 3. 文案：引导词的文字（text、say、提醒）只用汉字和全角标点，没有阿拉伯数字、拉丁字母和 → · / – ~ ( ) 之类的符号
 *    （屏幕上一句一句地读，以后请人录音时也照着念）；没有禁用词（safety.ts 的 findForbidden，加上写作规则里的
 *    必须、应该、频率、屏息 等）；一句不超过 20 字；同一件事用同样的话（如「可以闭上眼睛」）。
 * 4. 内容：开头点出练习名称；安全提示在开头规定的秒数内说出，任何档位、任何时长都说；
 *    冥想类在任何档位、任何时长都讲接纳和「发现走神本身就是练习」，并请人轻轻回来。
 *    v1 是文字引导（PRODUCT.md §0、§5）：v1 提供的冥想类引导词，在开头（或第一段）说一次目光落在屏幕上，
 *    任何档位、任何时长都说；闭眼和轻响最多说一次，而且说在一起；睁着眼做的练习不请人闭眼；
 *    没有只在听的时候才成立的说法（「我会少说一些」「先听一遍」「说到呼吸」）。正念行走和睡前身体扫描 v1 不提供，
 *    引导词留给以后的真人录音，不按这几条检查。
 * 5. 时间线：每份引导词 × 支持的时长 × 三个档位，走引擎的真实路径 buildTimeline（睡前身体扫描按 settle 语气，
 *    和播放时一样）：提示时间严格递增；朗读不压到下一条提示；结尾的话在结束钟声前的留白之前说完；
 *    该说的句子一句不少、顺序不变，多出来的只有本段的提醒；静默不低于各段下限；
 *    标准档人声占比在目标 ±12 个百分点内。打印用时表。
 *    v1 没有语音：每句占的时间不变，现在是读完这一句、再停一会儿的时间；「人声」就是屏幕上有新的一句要读的时间。
 *    另外：语音比估算慢一成时一句也不少；难受时用的引导词在安静档也不减少引导、不留长静默；
 *    跟随节拍的呼吸不分段（段落提示音会混进节拍）。
 *
 * 人声占比的口径（全部引导词统一用这一种）：
 *   人声 = 朗读时长（可读字数 ÷ 语速；settle 语气按这一句放慢后的语速）
 *        + 句后的说话停顿（按句末标点估算：。？… 1.6 秒，，；：、 0.6 秒，没有标点 0.8 秒；
 *          写明的停顿更短时取写明的；不超过到下一条提示的间隔）。
 *   写明的更长停顿超出的部分、只占时间的空行、段落静默、段落提示音前后的间隔、结尾留白都算静默。
 *   理由：practice.notes §1–2 的目标是用每分钟词数 ÷ 含自然停顿的连续语速推算的，模板里的分钟数也只有按这个口径
 *   才对得上（如身体扫描 5 分钟：每处一两句话、再静默约十秒，一处约 28 秒）。
 *   「纯发声」一列只算字数 ÷ 语速，是成品录音做语音活动检测时的对照，通常低十五到二十个百分点（practice.notes §1）。
 *
 * 看表格：npx vitest run src/content/scripts/scripts.test.ts -t 打印用时表 --silent=false
 */
import { describe, expect, it } from 'vitest'
import { adjustedDefaults, isOffered, PRACTICES, scriptIdFor } from '@/content/practices'
import { findForbidden } from '@/content/safety'
import { getScript, SCRIPTS } from '@/content/scripts'
import type {
  GuidanceDetail,
  GuidanceLevel,
  GuidedScript,
  ScriptId,
  ScriptLine,
  ScriptSection,
} from '@/content/types'
import {
  buildTimeline,
  DEFAULT_CHARS_PER_SECOND,
  DEFAULT_END_BUFFER_SEC,
  measureScript,
  pauseAfter,
  spokenChars,
  type TimelineOptions,
} from '@/engine/timeline'
import type { Prosody, Timeline, TimelineCue } from '@/engine/types'

/* ---------- 各引导词的约定 ---------- */

/**
 * meditation：冥想，要讲接纳、发现走神、轻轻回来；micro：一分钟停一停，讲接纳和发现走神；
 * exit：落地练习，是难受时的出口，只把注意力带到外面；paced：跟随节拍的呼吸，人声只是很薄的一层
 */
type Kind = 'meditation' | 'micro' | 'exit' | 'paced'

interface Case {
  kind: Kind
  /** 开头点出的练习名称，要在开场任何档位都说的句子里 */
  name: string
  /**
   * 标准档人声占比目标（%），键是支持的时长（分钟）。数值取 practice.notes 的模板，出处写在每一项上面；
   * 模板没有的时长按相邻模板内插、外推，或按三档表定（设计值，都没有经过试验检验）
   */
  targets: Readonly<Record<number, number>>
  /** 安全提示的原句和最晚开口的秒数：任何档位、任何时长都要在这个时刻之前开始说 */
  safety: readonly (readonly [text: string, withinSec: number])[]
  /** 播放时用的语气 */
  prosody?: Prosody
  /**
   * 难受时用的引导词：安静档与标准档完全相同（全局设成安静也不能留下长静默，practice-baer-2019），
   * 任何档位最长的安静不超过这个秒数
   */
  distress?: { maxSilenceSec: number }
  /** 语音慢一成、说不完时允许整段省略的段落（只在长时长才有的那一段） */
  droppableWhenSlow?: readonly string[]
}

/** 安全提示一般在开头 30 秒内；呼吸类的「轻柔地呼吸」在 10 秒内（PRODUCT §10） */
const SAFETY_SEC = 30
const GENTLE_SEC = 10
/** 结尾的话说完到结束钟声之间的留白 */
const END_BUFFER_SEC = DEFAULT_END_BUFFER_SEC

const CASES: Readonly<Record<ScriptId, Case>> = {
  // §2.3；15、30 分钟按 10、20 分钟的模板内插、外推
  focus: {
    kind: 'meditation',
    name: '专注呼吸',
    targets: { 5: 50, 10: 40, 15: 32, 20: 25, 30: 18 },
    safety: [['练习中如果觉得紧张、不舒服，', SAFETY_SEC]],
  },
  // §2.7；15 分钟在 10、20 分钟的模板之间内插
  'breath-count': {
    kind: 'meditation',
    name: '数息',
    targets: { 5: 25, 10: 18, 15: 15 },
    safety: [['如果头晕、心慌，或者很不舒服，就停下来，', SAFETY_SEC]],
  },
  // §2.1
  'body-scan': {
    kind: 'meditation',
    name: '身体扫描',
    targets: { 5: 70, 10: 60, 20: 50 },
    safety: [['如果留意某个部位让你难受，可以跳过它。', SAFETY_SEC]],
  },
  // §1 三档表：睡前归入「详细」一行（55–80%）
  'body-scan-sleep': {
    kind: 'meditation',
    name: '身体扫描',
    targets: { 10: 65, 20: 65, 30: 65 },
    safety: [['如果留意某个部位让你难受，可以跳过它。', SAFETY_SEC]],
    prosody: 'settle',
    droppableWhenSlow: ['second-pass'],
  },
  // §2.5
  'loving-kindness': {
    kind: 'meditation',
    name: '慈心',
    targets: { 5: 70, 10: 60, 20: 45 },
    safety: [['这类练习有时会让人难过，想起过去的伤心事。', GENTLE_SEC]],
  },
  // §2.5 自我关怀三步（约 4 分钟的模板放大到 5 分钟）
  'self-compassion': {
    kind: 'meditation',
    name: '自我关怀',
    targets: { 5: 65 },
    safety: [['这个练习有时会让人难过，想起过去的伤心事。', GENTLE_SEC]],
  },
  // §2.2：三分钟标准版和十分钟扩展版
  'breathing-space': {
    kind: 'meditation',
    name: '呼吸空间',
    targets: { 3: 55, 10: 40 },
    safety: [['任何时候不舒服，', SAFETY_SEC]],
  },
  // §2.2 入门两步版
  'breathing-space-intro': {
    kind: 'meditation',
    name: '呼吸空间',
    targets: { 5: 45 },
    safety: [['任何时候，都可以调整姿势、睁开眼睛，或者停下来。', SAFETY_SEC]],
  },
  // §2.2 应对版没有给出占比；难受时连续引导，按三档表「详细」一行（55–80%）定
  'breathing-space-coping': {
    kind: 'meditation',
    name: '呼吸空间',
    targets: { 3: 65, 4: 60, 5: 55 },
    safety: [['感觉太强烈时，', SAFETY_SEC]],
    distress: { maxSilenceSec: 30 },
  },
  // §2.4（20 分钟取 25–30% 的中间）
  'open-awareness': {
    kind: 'meditation',
    name: '开放觉察',
    targets: { 5: 55, 10: 40, 20: 28 },
    safety: [['静坐时，对时间的感觉可能会变，', SAFETY_SEC]],
  },
  // §2.6
  walking: {
    kind: 'meditation',
    name: '正念行走',
    targets: { 5: 45, 10: 35 },
    safety: [
      ['找一段平坦、没有障碍的路，能来回走五六步就行。', GENTLE_SEC],
      ['头晕、累了或者心里不舒服，', SAFETY_SEC],
    ],
  },
  // §2.6 STOP
  pause: {
    kind: 'micro',
    name: '停一停',
    targets: { 1: 60 },
    safety: [['下一口气，比平时稍满一点，不必很深。', SAFETY_SEC]],
  },
  // §1 三档表「详细」一行：难受时用的出口，连续而平稳的引导
  grounding: {
    kind: 'exit',
    name: '落地练习',
    targets: { 1: 75 },
    safety: [['呼吸不用刻意调整，自然就好。', GENTLE_SEC]],
    // 句间最长约五秒半，最长的安静是结束钟声前的十秒留白
    distress: { maxSilenceSec: END_BUFFER_SEC + 1 },
  },
  // §2.8：5、10、20 分钟取模板，15 分钟内插，3 分钟按固定的开头外推
  slow: {
    kind: 'paced',
    name: '慢呼吸',
    targets: { 3: 16, 5: 12, 10: 10, 15: 8, 20: 6 },
    safety: [
      ['轻柔地呼吸，不必吸得很深。', GENTLE_SEC],
      ['如果头晕，手指、嘴唇发麻，或者不舒服，', SAFETY_SEC],
    ],
  },
  // §2.8 的 5 分钟模板；3 分钟、1 分钟按固定的开头外推
  'cyclic-sigh': {
    kind: 'paced',
    name: '周期性叹息',
    targets: { 1: 45, 3: 16, 5: 12 },
    safety: [
      ['每一轮先用鼻子，轻轻吸到七八成满，', GENTLE_SEC],
      ['如果头晕，手指、嘴唇发麻，或者不舒服，', SAFETY_SEC],
    ],
  },
  box: {
    kind: 'paced',
    name: '箱式呼吸',
    targets: { 3: 16, 5: 12 },
    safety: [
      ['轻柔地呼吸，不必吸得很深。', GENTLE_SEC],
      ['如果头晕、心慌、胸口发紧，或者不舒服，', SAFETY_SEC],
    ],
  },
}

/* ---------- 规则 ---------- */

const CPS = DEFAULT_CHARS_PER_SECOND
const EPS = 1e-6
/** 实际语音可能比估算慢：慢一成时也要一句不少 */
const SLOW_FACTOR = 0.9
/** 标准档人声占比允许偏离目标的百分点 */
const TOLERANCE = 12
/** 一句话最多的可读字数（写作要求一般 8–18 字，个别带逗号的句子可到 20 字） */
const MAX_LINE_CHARS = 20

const LEVELS: readonly GuidanceLevel[] = ['quiet', 'standard', 'detailed']
const LEVEL_NAME: Readonly<Record<GuidanceLevel, string>> = {
  quiet: '安静',
  standard: '标准',
  detailed: '详细',
}
const DETAIL_RANK: Readonly<Record<GuidanceDetail, number>> = { core: 0, standard: 1, detailed: 2 }
const LEVEL_RANK: Readonly<Record<GuidanceLevel, number>> = { quiet: 0, standard: 1, detailed: 2 }

/** 朗读的文字只许有汉字和这几个全角标点；数字写成汉字，引号只用「」 */
const SPOKEN_TEXT = /^[\p{Script=Han}，。、；：？「」]+$/u

/** findForbidden 之外，写作规则不许在引导词里出现的说法，以及固定术语的别名 */
const BANNED: readonly string[] = [
  '必须',
  '应该',
  '频率',
  '我们',
  '屏住',
  '屏息',
  '深吸',
  '深呼吸',
  '吸到最满',
  '吸足',
  '循环叹息',
  '方块呼吸',
  '慢节律呼吸',
  '共振呼吸',
  '呼吸计数',
  '正念呼吸',
  '慈爱',
  '慈悲冥想',
  '自我同情',
  '自悯',
]

/** 同一件事用同样的话：左边的说法统一写成右边的 */
const VARIANTS: readonly (readonly [RegExp, string])[] = [
  [/眼睛可以闭上|眼睛闭上，/u, '可以闭上眼睛'],
  [/随时可以调整姿势/u, '任何时候，都可以调整姿势'],
  [/从头到尾/u, '从开始到结束'],
]

/** 接纳（meditation-lindsay-2018） */
const ACCEPTANCE = /允许|不评判|不需要评判|不需要改变|不用改变|不需要赶走|不用赶/u
/** 发现走神本身就是练习，或者等价的说法（meditation-hasenkamp-2012） */
const NOTICING = /本身就是练习|就是回神|一次回神|已经回神/u
/** 轻轻放下，回来 */
const LETTING_GO = /轻轻(放下|回到|回来)/u

/* ---------- 文字引导（PRODUCT.md §0、§5） ---------- */

const scriptsOf = (pick: (p: (typeof PRACTICES)[number]) => boolean): ReadonlySet<ScriptId> =>
  new Set(PRACTICES.filter(pick).flatMap(p => p.durations.flatMap(d => scriptIdFor(p.id, d) ?? [])))

/** v1 提供的练习用到的引导词。正念行走、睡前身体扫描 v1 不提供，引导词留给以后的真人录音 */
const OFFERED_SCRIPTS = scriptsOf(p => isOffered(p.id))
/** 练习本身睁着眼做的引导词（practices.ts 的 adjustedDefaults(…).eyesOpen）：不请人闭眼 */
const EYES_OPEN_SCRIPTS = scriptsOf(p => isOffered(p.id) && adjustedDefaults(p.id).eyesOpen)

/** 目光落在屏幕上：文字引导怎么看 */
const GAZE = /落在屏幕上|看着屏幕/u
const CLOSE_EYES = /闭上眼睛|闭眼/u
/** 新的一句出现时的那一声轻提示（设置里的「新的一句出现时轻提示」） */
const CUE = /轻响/u
/** 只在听的时候才成立的说法：引导词现在是读的 */
const HEARD_ONLY: readonly string[] = [
  '听我',
  '我的声音',
  '跟着声音',
  '跟着我',
  '听一遍',
  '我会',
  '我不再',
  '说到',
  '少说',
]

/* ---------- 筛选与测量 ---------- */

const IDS = Object.keys(CASES) as ScriptId[]

const said = (l: ScriptLine): string => (l.say ?? l.text).trim()

const spokenAt = (l: ScriptLine, minutes: number, level: GuidanceLevel): boolean =>
  DETAIL_RANK[l.detail ?? 'core'] <= LEVEL_RANK[level] && (l.minMinutes ?? 0) <= minutes

const keptSections = (s: GuidedScript, minutes: number): ScriptSection[] =>
  s.sections.filter(x => x.omitAtOrBelow === undefined || x.omitAtOrBelow < minutes)

const allLines = (s: GuidedScript): ScriptLine[] => [
  ...s.opening,
  ...s.sections.flatMap(x => x.intro),
  ...s.closing,
]

const durationsOf = (id: ScriptId): number[] => Object.keys(CASES[id].targets).map(Number)

interface Expected {
  line: ScriptLine
  /** 段落里的句子才有；开场和结尾为 null */
  sectionId: string | null
}

/** 对照用：这个时长、这个档位应当说出的句子，按顺序；只占时间的空行不算 */
function expectedLines(s: GuidedScript, minutes: number, level: GuidanceLevel): Expected[] {
  const pick = (lines: readonly ScriptLine[], sectionId: string | null): Expected[] =>
    lines
      .filter(l => spokenAt(l, minutes, level) && spokenChars(said(l)) > 0)
      .map(line => ({ line, sectionId }))
  return [
    ...pick(s.opening, null),
    ...keptSections(s, minutes).flatMap(x => pick(x.intro, x.id)),
    ...pick(s.closing, null),
  ]
}

const optionsOf = (id: ScriptId, level: GuidanceLevel): TimelineOptions => ({
  level,
  prosody: CASES[id].prosody ?? 'steady',
})

/** 引擎给一句话留的朗读时间：字幕和朗读文字取较长的一个；settle 语气按这一句放慢后的语速 */
const occupiedSec = (c: TimelineCue): number =>
  Math.max(spokenChars(c.text ?? ''), spokenChars(c.say ?? '')) / (CPS * (c.rate ?? 1))

/** 实际朗读的秒数 */
const voicedSec = (c: TimelineCue): number => spokenChars(c.say ?? c.text ?? '') / (CPS * (c.rate ?? 1))

interface Row {
  id: ScriptId
  minutes: number
  level: GuidanceLevel
  timeline: Timeline
  /** 人声秒数：朗读加句后的说话停顿 */
  speechSec: number
  /** 纯发声秒数 */
  voiceSec: number
  /** 两次朗读之间最长的安静（含开头和最后一句之后） */
  longestSilence: number
  speaks: number
  reminders: number
  /** 应当说、却没排进时间线的句子 */
  missing: string[]
  /** 既不是应说的句子、也不是所在段落提醒的朗读 */
  unexpected: string[]
  /** 最后一句朗读（按引擎留的时间）结束的时刻 */
  lastEnd: number
  /** 话太多，各段的静默被压到下限以下 */
  compressed: boolean
}

function measure(id: ScriptId, minutes: number, level: GuidanceLevel): Row {
  const script = SCRIPTS[id]
  const opts = optionsOf(id, level)
  const timeline = buildTimeline(script, minutes, opts)
  const expected = expectedLines(script, minutes, level)
  const reminderTexts = new Map(
    script.sections.map(s => [s.id, new Set((s.reminders ?? []).map(r => r.trim()))] as const),
  )
  const unexpected: string[] = []
  let k = 0
  let reminders = 0
  let speechSec = 0
  let voiceSec = 0
  let longestSilence = 0
  let quietFrom = 0
  let lastEnd = 0
  let speaks = 0
  for (const [i, c] of timeline.cues.entries()) {
    if (c.kind !== 'speak') continue
    const text = c.text ?? ''
    const section = c.sectionId ?? null
    const want = expected[k]
    let written: number | undefined
    if (want && want.line.text.trim() === text && want.sectionId === section) {
      written = want.line.pause
      k++
    } else if (section !== null && want?.sectionId !== section && reminderTexts.get(section)?.has(text)) {
      reminders++
    } else unexpected.push(text)
    const voice = voicedSec(c)
    const natural = pauseAfter(c.say ?? text)
    const talkPause = written === undefined ? natural : Math.min(Math.max(0, written), natural)
    const next = timeline.cues[i + 1]?.t ?? timeline.duration
    speechSec += voice + Math.max(0, Math.min(talkPause, next - (c.t + voice)))
    voiceSec += voice
    longestSilence = Math.max(longestSilence, c.t - quietFrom)
    quietFrom = c.t + voice
    lastEnd = c.t + occupiedSec(c)
    speaks++
  }
  longestSilence = Math.max(longestSilence, timeline.duration - quietFrom)
  const m = measureScript(script, minutes, opts)
  return {
    id,
    minutes,
    level,
    timeline,
    speechSec,
    voiceSec,
    longestSilence,
    speaks,
    reminders,
    missing: expected.slice(k).map(e => e.line.text),
    unexpected,
    lastEnd,
    compressed: m.silenceSec < m.minSilenceSec - EPS,
  }
}

const ROWS: readonly Row[] = IDS.flatMap(id =>
  durationsOf(id).flatMap(minutes => LEVELS.map(level => measure(id, minutes, level))),
)

const shareOf = (r: Row): number => (r.speechSec / r.timeline.duration) * 100
const voiceShareOf = (r: Row): number => (r.voiceSec / r.timeline.duration) * 100

const spokenTexts = (r: Row): string[] =>
  r.timeline.cues.filter(c => c.kind === 'speak').map(c => c.say ?? c.text ?? '')

/* ---------- 打印 ---------- */

function table(): string {
  const head = ['引导词', '时长', '档位', '人声秒', '人声占比', '纯发声', '目标', '最长静默', '朗读条数']
  const body = ROWS.map(r => {
    const target = r.level === 'standard' ? `${CASES[r.id].targets[r.minutes]}% ±${TOLERANCE}` : ''
    return [
      r.id,
      `${r.minutes} 分`,
      LEVEL_NAME[r.level],
      r.speechSec.toFixed(0),
      `${shareOf(r).toFixed(1)}%`,
      `${voiceShareOf(r).toFixed(1)}%`,
      target,
      `${r.longestSilence.toFixed(0)} 秒`,
      String(r.speaks),
    ]
  })
  const width = (s: string): number => [...s].reduce((n, ch) => n + (/[一-鿿]/u.test(ch) ? 2 : 1), 0)
  const widths = head.map((h, i) => Math.max(width(h), ...body.map(row => width(row[i] ?? ''))))
  const fmt = (cells: readonly string[]): string =>
    cells.map((c, i) => c + ' '.repeat(Math.max(0, (widths[i] ?? 0) - width(c)))).join('  ')
  return [
    `引导词时间线（每秒 ${CPS} 字，结尾留白 ${END_BUFFER_SEC} 秒；人声 = 朗读 + 句后的说话停顿）`,
    fmt(head),
    ...body.map(fmt),
  ].join('\n')
}

/* ---------- 测试 ---------- */

/**
 * safety.test.ts 会把 scripts/ 下的每个文件都导入一遍来扫描禁用词，本文件也在其中；只在本文件自己运行时登记测试，
 * 免得同样的测试在那边再跑一遍。拿不到当前文件路径时照常登记（宁可跑两遍，不能漏跑）
 */
const testPath = expect.getState().testPath
const importedElsewhere = typeof testPath === 'string' && !testPath.endsWith('scripts.test.ts')

describe.skipIf(importedElsewhere)('引导词', () => {
  it('打印用时表', () => {
    console.log(table())
    expect(ROWS.length).toBe(IDS.reduce((n, id) => n + durationsOf(id).length * LEVELS.length, 0))
  })

  describe('登记', () => {
    it('SCRIPTS 收齐每个 ScriptId，键和引导词的 id 一致', () => {
      expect(Object.keys(SCRIPTS).sort()).toEqual([...IDS].sort())
      for (const id of IDS) {
        expect(SCRIPTS[id].id).toBe(id)
        expect(getScript(id)).toBe(SCRIPTS[id])
      }
      expect(() => getScript('toString' as ScriptId)).toThrow(RangeError)
    })

    it('练习目录里每个（练习, 时长）都对上一份引导词和表里的一个时长', () => {
      const used = new Set<string>()
      for (const p of PRACTICES) {
        if (!p.scriptId) continue
        for (const d of p.durations) {
          const sid = scriptIdFor(p.id, d)
          expect(sid, `${p.id} ${d} 分钟`).toBeDefined()
          if (!sid) continue
          expect(durationsOf(sid), `${p.id} ${d} 分钟 → ${sid}`).toContain(d)
          used.add(sid)
        }
      }
      expect([...used].sort()).toEqual([...IDS].sort())
    })

    it('表里的时长都在引导词支持的范围内', () => {
      for (const id of IDS) {
        const s = SCRIPTS[id]
        for (const d of durationsOf(id)) {
          expect(d, id).toBeGreaterThanOrEqual(s.minMinutes)
          expect(d, id).toBeLessThanOrEqual(s.maxMinutes)
        }
      }
    })
  })

  describe.each(IDS)('%s', id => {
    const script = SCRIPTS[id]
    const c = CASES[id]
    const rows = ROWS.filter(r => r.id === id)
    const lines = allLines(script)
    const reminders = script.sections.flatMap(s => s.reminders ?? [])

    it('结构：时长范围、段落 id、空行、minMinutes 和 omitAtOrBelow 的范围、skippable 只在段落上', () => {
      expect(Number.isInteger(script.minMinutes) && script.minMinutes >= 1).toBe(true)
      expect(Number.isInteger(script.maxMinutes) && script.maxMinutes >= script.minMinutes).toBe(true)
      expect(script.title.trim()).not.toBe('')
      expect(script.opening.length).toBeGreaterThan(0)
      expect('skippable' in script).toBe(false)
      const ids = script.sections.map(s => s.id)
      expect(new Set(ids).size, '段落 id 重复').toBe(ids.length)
      for (const s of script.sections) {
        expect(s.id.trim(), s.id).not.toBe('')
        expect(s.title.trim(), s.id).not.toBe('')
        expect(Number.isFinite(s.weight) && s.weight >= 0, `${s.id} 权重`).toBe(true)
        if (s.minSilence !== undefined)
          expect(Number.isFinite(s.minSilence) && s.minSilence >= 0, `${s.id} 静默下限`).toBe(true)
        if (s.omitAtOrBelow !== undefined) {
          expect(Number.isInteger(s.omitAtOrBelow), s.id).toBe(true)
          expect(s.omitAtOrBelow, `${s.id} 在最短时长也省略不了`).toBeGreaterThanOrEqual(script.minMinutes)
          expect(s.omitAtOrBelow, `${s.id} 在任何时长都被省略`).toBeLessThan(script.maxMinutes)
        }
        expect(s.intro.length + (s.reminders?.length ?? 0), `${s.id} 是空段`).toBeGreaterThan(0)
      }
      for (const l of lines) {
        const where = `「${l.text}」`
        expect('skippable' in l, `${where} skippable 只能写在段落上`).toBe(false)
        expect(l.text, `${where} 首尾有空白`).toBe(l.text.trim())
        if (l.text === '') {
          // 只占时间的空行：不朗读，靠写明的停顿把下一句推到想要的时刻
          expect(l.say, `${where} 空行不该有 say`).toBeUndefined()
          expect((l.pause ?? 0) > 0, '空行要写明停顿').toBe(true)
        }
        if (l.pause !== undefined) expect(Number.isFinite(l.pause) && l.pause >= 0, where).toBe(true)
        if (l.say !== undefined) {
          expect(l.say, `${where} 的 say 和字幕相同`).not.toBe(l.text)
          expect(l.text, `${where} 有 say 却没有字幕`).not.toBe('')
        }
        if (l.minMinutes !== undefined) {
          expect(Number.isInteger(l.minMinutes), where).toBe(true)
          expect(l.minMinutes, `${where} 的 minMinutes 不起作用`).toBeGreaterThan(script.minMinutes)
          expect(l.minMinutes, `${where} 在任何时长都不说`).toBeLessThanOrEqual(script.maxMinutes)
        }
      }
      for (const r of reminders) expect(spokenChars(r), '空提醒').toBeGreaterThan(0)
    })

    it('文案：只用汉字和全角标点，没有禁用词，一句不超过 20 字，同一件事用同样的话', () => {
      const spoken = [
        ...lines.flatMap(l => (l.text === '' ? [] : [l.text, ...(l.say ? [l.say] : [])])),
        ...reminders,
      ]
      for (const t of spoken) {
        expect(t, `「${t}」有数字、字母或半角符号`).toMatch(SPOKEN_TEXT)
        expect(spokenChars(t), `「${t}」太长`).toBeLessThanOrEqual(MAX_LINE_CHARS)
        expect(t.split('「').length, `「${t}」引号不成对`).toBe(t.split('」').length)
        for (const [variant, canonical] of VARIANTS)
          expect(variant.test(t), `「${t}」：写成「${canonical}」`).toBe(false)
      }
      const shown = [script.title, ...script.sections.map(s => s.title), ...spoken]
      for (const t of shown) {
        expect(findForbidden(t), `「${t}」`).toEqual([])
        for (const w of BANNED) expect(t.includes(w), `「${t}」含「${w}」`).toBe(false)
      }
    })

    if (OFFERED_SCRIPTS.has(id)) {
      if (c.kind === 'meditation' || c.kind === 'micro') {
        it('文字引导：开头说一次目光落在屏幕上，任何档位、任何时长都说', () => {
          const gaze = lines.filter(l => GAZE.test(l.text))
          expect(
            gaze.map(l => l.text),
            '只说一次',
          ).toHaveLength(1)
          const line = gaze[0]
          const early = [...script.opening, ...(script.sections[0]?.intro ?? [])]
          expect(line !== undefined && early.includes(line), '在开头或第一段').toBe(true)
          expect(line?.detail ?? 'core', '任何档位').toBe('core')
          expect(line?.minMinutes, '任何时长').toBeUndefined()
        })
      }

      it('文字引导：轻响最多说一次，和闭眼说在一起；睁着眼做的练习不请人闭眼', () => {
        const cue = lines.flatMap((l, i) => (CUE.test(l.text) ? [i] : []))
        expect(cue.length).toBeLessThanOrEqual(1)
        for (const i of cue) {
          const at = lines[i]
          const eyes = at && CLOSE_EYES.test(at.text) ? at : lines[i - 1]
          expect(eyes?.text ?? '', `「${at?.text}」前后要说可以闭眼`).toMatch(CLOSE_EYES)
          // 两句在同样的档位、时长下说，不会只说一半
          expect([eyes?.detail, eyes?.minMinutes]).toEqual([at?.detail, at?.minMinutes])
        }
        if (EYES_OPEN_SCRIPTS.has(id)) {
          const closing = [...lines.map(l => l.text), ...reminders].filter(t => CLOSE_EYES.test(t))
          expect(closing, '睁着眼做的练习').toEqual([])
        }
      })

      it('文字引导：没有只在听的时候才成立的说法', () => {
        const texts = [...lines.flatMap(l => [l.text, ...(l.say ? [l.say] : [])]), ...reminders]
        for (const t of texts) {
          for (const w of HEARD_ONLY) expect(t.includes(w), `「${t}」含「${w}」`).toBe(false)
        }
      })
    }

    it(`开头点出练习名称「${c.name}」，任何档位都说`, () => {
      const core = script.opening.filter(l => (l.detail ?? 'core') === 'core' && l.minMinutes === undefined)
      expect(core.some(l => l.text.includes(c.name))).toBe(true)
    })

    it.each(c.safety.map(([text, within]) => [text, within] as const))(
      '安全提示「%s」在开头 %d 秒内说出，任何档位、任何时长都说',
      (text, within) => {
        for (const r of rows) {
          const cue = r.timeline.cues.find(x => x.kind === 'speak' && x.text === text)
          expect(cue, `${r.minutes} 分钟 ${LEVEL_NAME[r.level]}档没说`).toBeDefined()
          expect(
            cue?.t ?? Number.POSITIVE_INFINITY,
            `${r.minutes} 分钟 ${LEVEL_NAME[r.level]}档`,
          ).toBeLessThan(within)
        }
      },
    )

    if (c.kind === 'meditation' || c.kind === 'micro') {
      it('任何档位、任何时长都讲接纳和「发现走神本身就是练习」', () => {
        for (const r of rows) {
          const all = spokenTexts(r).join('')
          const where = `${r.minutes} 分钟 ${LEVEL_NAME[r.level]}档`
          expect(all, `${where} 没讲接纳`).toMatch(ACCEPTANCE)
          expect(all, `${where} 没讲发现走神`).toMatch(NOTICING)
          if (c.kind === 'meditation') expect(all, `${where} 没请人轻轻回来`).toMatch(LETTING_GO)
        }
      })
    }

    if (c.kind === 'paced') {
      it('不分段：段落提示音会混进节拍', () => {
        expect(script.sections).toEqual([])
      })
    }

    const distress = c.distress
    if (distress) {
      it(`难受时用：安静档与标准档相同，最长的安静不超过 ${distress.maxSilenceSec} 秒`, () => {
        for (const minutes of durationsOf(id)) {
          const [quiet, standard] = (['quiet', 'standard'] as const).map(level =>
            rows.find(r => r.minutes === minutes && r.level === level),
          )
          expect(quiet?.timeline, `${minutes} 分钟`).toEqual(standard?.timeline)
        }
        for (const r of rows)
          expect(r.longestSilence, `${r.minutes} 分钟 ${LEVEL_NAME[r.level]}档`).toBeLessThanOrEqual(
            distress.maxSilenceSec,
          )
      })
    }

    it('语音慢一成时一句也不少，话音不重叠，也不盖住结束钟声', () => {
      const droppable = new Set(c.droppableWhenSlow ?? [])
      const cps = CPS * SLOW_FACTOR
      for (const minutes of durationsOf(id)) {
        for (const level of LEVELS) {
          const where = `${minutes} 分钟 ${LEVEL_NAME[level]}档`
          const tl = buildTimeline(script, minutes, { ...optionsOf(id, level), charsPerSecond: cps })
          const said = tl.cues.filter(x => x.kind === 'speak').map(x => x.text ?? '')
          let from = 0
          const missing: string[] = []
          for (const e of expectedLines(script, minutes, level)) {
            if (e.sectionId !== null && droppable.has(e.sectionId)) continue
            const at = said.indexOf(e.line.text, from)
            if (at < 0) missing.push(e.line.text)
            else from = at + 1
          }
          expect(missing, where).toEqual([])
          for (const [i, cue] of tl.cues.entries()) {
            if (cue.kind !== 'speak') continue
            const end = cue.t + occupiedSec(cue) / SLOW_FACTOR
            expect(end, `${where}「${cue.text}」`).toBeLessThanOrEqual(
              (tl.cues[i + 1]?.t ?? tl.duration) + EPS,
            )
          }
        }
      }
    })

    describe.each(rows.map(r => [`${r.minutes} 分钟 · ${LEVEL_NAME[r.level]}`, r] as const))('%s', (_, r) => {
      const { cues, duration } = r.timeline

      it('提示时间严格递增，朗读不压到下一条提示，结尾的话在结束钟声前的留白之前说完', () => {
        expect(duration).toBe(r.minutes * 60)
        for (const [i, cue] of cues.entries()) {
          const prev = cues[i - 1]
          if (prev) expect(cue.t, `第 ${i} 条`).toBeGreaterThan(prev.t)
          expect(cue.t).toBeGreaterThanOrEqual(0)
          const next = cues[i + 1]
          if (cue.kind === 'speak' && next)
            expect(cue.t + occupiedSec(cue), `「${cue.text}」压到下一条`).toBeLessThanOrEqual(next.t + EPS)
        }
        expect(r.speaks).toBeGreaterThan(0)
        expect(r.lastEnd, '最后一句说完的时刻').toBeLessThanOrEqual(duration - END_BUFFER_SEC + EPS)
      })

      it('该说的句子一句不少、顺序不变，多出来的只有本段的提醒；静默不低于各段下限', () => {
        expect(r.missing, '没排进去的句子').toEqual([])
        expect(r.unexpected, '多出的朗读').toEqual([])
        expect(r.timeline.sections.map(s => s.id)).toEqual(keptSections(script, r.minutes).map(s => s.id))
        expect(r.compressed, '静默被压到下限以下').toBe(false)
      })

      if (r.level === 'standard') {
        const target = c.targets[r.minutes] ?? Number.NaN
        it(`标准档人声占比在目标 ${target}% ±${TOLERANCE} 个百分点内`, () => {
          expect(Math.abs(shareOf(r) - target), `${shareOf(r).toFixed(1)}%`).toBeLessThanOrEqual(TOLERANCE)
        })
      }
    })
  })

  it('档位之间：详细档说得不比标准档少，安静档不比标准档多', () => {
    for (const id of IDS) {
      for (const minutes of durationsOf(id)) {
        const [q, s, d] = LEVELS.map(level =>
          ROWS.find(r => r.id === id && r.minutes === minutes && r.level === level),
        )
        const where = `${id} ${minutes} 分钟`
        expect(q && s && d, where).toBeTruthy()
        if (!q || !s || !d) continue
        expect(d.voiceSec, where).toBeGreaterThanOrEqual(s.voiceSec - EPS)
        expect(q.voiceSec, where).toBeLessThanOrEqual(s.voiceSec + EPS)
      }
    }
  })
})
