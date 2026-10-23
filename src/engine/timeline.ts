/**
 * 引导时间线：把引导词排成带时间的提示。v1 是文字引导（PRODUCT §0、§5）：每一句按时刻出现在屏幕上，
 * 时间按冥想引导的语速估算（以后有真人录音时同样适用）。
 * 先按引导详细程度和时长挑出要说的句子；每句的用时按字数估算；剩下的时间作为静默，按段落权重分配；
 * 静默足够长时插入简短的提醒；结尾的话在结束钟声之前说完。
 */
import type { GuidanceDetail, GuidanceLevel, GuidedScript, ScriptLine, ScriptSection } from '@/content/types'
import { clamp, easeInOut, lerp, sum } from '@/lib/math'
import type { Prosody, Timeline, TimelineCue, TimelineSection } from './types'

/** 引导语的估算语速（字/秒）：比日常说话慢，接近冥想引导的语速 */
export const DEFAULT_CHARS_PER_SECOND = 3.6
/** 句末（。！？…）之后的停顿 */
export const SENTENCE_PAUSE_SEC = 1.6
/** 句中（，；：、）之后的停顿 */
export const CLAUSE_PAUSE_SEC = 0.6
/** 没有标点时的停顿 */
export const BARE_PAUSE_SEC = 0.8
/** 结尾的话说完到结束钟声之间至少留的秒数，让人在安静里收尾 */
export const DEFAULT_END_BUFFER_SEC = 10
/** 倒数结束后，第一句话之前留的一口气 */
export const OPENING_DELAY_SEC = 1
/** 段落提示音响过再开口，免得话音和提示音叠在一起 */
export const SECTION_CUE_LEAD_SEC = 1.5
/** 静默至少这么长才插入提醒；短静默本身就是练习的一部分 */
export const REMINDER_MIN_SILENCE_SEC = 75
/** 两次提醒之间至少的安静秒数 */
export const REMINDER_SPACING_SEC = 45
/** 提醒离段落开头和结尾至少的安静秒数 */
export const REMINDER_EDGE_SEC = 20
/** settle 语气在练习结尾时的语速倍数：越往后越慢，到最后约慢 12%（声音研究 §6：语速放慢 15–25%） */
export const SETTLE_END_RATE = 0.88
/** settle 语气在练习结尾时的音量倍数：约低 3 dB */
export const SETTLE_END_VOLUME = 0.7

export interface TimelineOptions {
  /** 估算语速（字/秒），默认 3.6（冥想引导的语速）。以后有录音时按录音的语速给 */
  charsPerSecond?: number
  /**
   * 结尾的话说完到结束钟声至少留的秒数，默认 10。
   * 语速慢、话说不完时先让出这段留白，结束钟声之前仍然说完；连留白也不够才按 trimToFit 的次序删减
   */
  endBufferSec?: number
  /**
   * 引导详细程度：core 任何档位都说，standard 在标准和详细档说，detailed 只在详细档说。
   * 不填时每一句都说（等同 detailed），预先按档位筛好、仍带着 detail 标记的脚本因此照常可排
   */
  level?: GuidanceLevel
  /**
   * 语气，默认 steady。settle 给每句话加上语速和音量倍数，随练习进程从 1 缓缓降到
   * SETTLE_END_RATE、SETTLE_END_VOLUME（睡前越说越慢、越轻）；排时间时按放慢后的语速估算，话音仍不会重叠
   */
  prosody?: Prosody
}

/** 一句话的语气：相对用户设置的语速和音量倍数 */
export interface Tone {
  rate: number
  volume: number
}

/** settle 语气在练习进行到 q（0–1）时的语速和音量倍数：两端缓、中间快地往下降 */
export function settleTone(q: number): Tone {
  const k = easeInOut(q)
  return { rate: lerp(1, SETTLE_END_RATE, k), volume: lerp(1, SETTLE_END_VOLUME, k) }
}

/** 一份引导词在某个时长下的用时估算，供内容校验使用 */
export interface ScriptMeasure {
  /** 实际采用的分钟数（已夹在脚本支持的范围内） */
  minutes: number
  /** 总秒数 */
  duration: number
  /** 采用的段落 id（已去掉短时长下省略的段） */
  sectionIds: string[]
  /** 说话（显示每一句）和段落提示音前后的间隔一共占用的秒数 */
  speechSec: number
  /**
   * 可分给静默的秒数。为负表示话说不完：不低于 −留白 时结尾的话会占用留白；
   * 再低 buildTimeline 就要删减（先去掉「详细」「标准」档的句子，见 trimToFit）
   */
  silenceSec: number
  /** 各段要求的最少静默之和；silenceSec 低于它时静默会被等比压缩 */
  minSilenceSec: number
}

/** 比较时长时容忍的浮点误差：按下限分到的静默可能算出 74.999…，不该因此少一条提醒 */
const TIME_EPS = 1e-6

const SPOKEN_CHAR = /[\p{L}\p{N}]/gu
const TRAILING_CLOSERS = /[\s"'」』”’）)》〉】\]]+$/u
const SENTENCE_END = /[。！？…!?.]$/u
const CLAUSE_END = /[，；：、,;:]$/u

const DETAIL_RANK: Readonly<Record<GuidanceDetail, number>> = { core: 0, standard: 1, detailed: 2 }
const LEVEL_RANK: Readonly<Record<GuidanceLevel, number>> = { quiet: 0, standard: 1, detailed: 2 }

/** 会被读出来（读到）的字数：汉字、字母、数字，不含标点和空白 */
export function spokenChars(text: string): number {
  return text.match(SPOKEN_CHAR)?.length ?? 0
}

/** 按句末标点估算一句话之后的停顿；引号、括号不影响判断 */
export function pauseAfter(text: string): number {
  const tail = text.replace(TRAILING_CLOSERS, '')
  if (SENTENCE_END.test(tail)) return SENTENCE_PAUSE_SEC
  if (CLAUSE_END.test(tail)) return CLAUSE_PAUSE_SEC
  return BARE_PAUSE_SEC
}

/** 在某个档位、某个时长（分钟）下要不要说这一句 */
export function lineIncluded(line: ScriptLine, minutes: number, level: GuidanceLevel = 'detailed'): boolean {
  return DETAIL_RANK[line.detail ?? 'core'] <= LEVEL_RANK[level] && minutes >= (line.minMinutes ?? 0)
}

/**
 * 读完（说完）一句话的估算秒数，不含句后的停顿。朗读用 say、字幕显示 text，两者字数可能不同，
 * 按较长的一个计时，哪一种都不会压到下一句
 */
export function readingSec(
  line: Pick<ScriptLine, 'text' | 'say'>,
  cps: number = DEFAULT_CHARS_PER_SECOND,
): number {
  return Math.max(spokenChars(line.text), spokenChars(line.say ?? '')) / cps
}

/** 句后的停顿：写明了 pause 就照写的（乘上 scale，话说不完时按比例缩短），否则按句末标点估算 */
function pauseOf(line: ScriptLine, scale = 1): number {
  return line.pause === undefined ? pauseAfter(line.say ?? line.text) : Math.max(0, line.pause) * scale
}

/** 一句话连同其后停顿的估算秒数（readingSec 加上停顿） */
export function lineSec(line: ScriptLine, cps: number = DEFAULT_CHARS_PER_SECOND): number {
  return readingSec(line, cps) + pauseOf(line)
}

/**
 * 时间线上一句话读完要的秒数：buildTimeline 排出的提示带着 dur；手写的没有时按字数和默认语速估算。
 * 会话据此判断这一句之前安静了多久，播放器据此在读完之后让字变淡
 */
export function speakSec(cue: Pick<TimelineCue, 'text' | 'say' | 'dur'>): number {
  if (cue.dur !== undefined && Number.isFinite(cue.dur) && cue.dur >= 0) return cue.dur
  return readingSec({ text: cue.text ?? '', ...(cue.say === undefined ? {} : { say: cue.say }) })
}

/** 挑好句子、去掉省略段之后的脚本 */
interface Parts {
  opening: ScriptLine[]
  sections: ScriptSection[]
  closing: ScriptLine[]
}

/** settle 时每句话的语气；steady 为 null */
type ToneOf = (line: ScriptLine) => Tone

interface Frame {
  minutes: number
  duration: number
  cps: number
  endBuffer: number
  toneOf: ToneOf | null
  /** 写明的停顿（ScriptLine.pause）乘上的比例：1 为照写的，话说不完时按比例缩短（trimToFit） */
  pauseScale: number
  /** 整体压缩：说话占用的全部时间（开场前的停顿、段落提示音前后的间隔、每句话和停顿）乘上的比例，1 为不压缩 */
  squeeze: number
}

interface Layout extends Frame, Parts {
  /** 朗读、开场前的停顿、段落提示音前后的间隔一共占用的秒数 */
  speechSec: number
  closingSec: number
  /** 可分给静默的秒数；为负表示话说不完 */
  flexible: number
}

function checkInputs(script: GuidedScript, minutes: number, opts: TimelineOptions): void {
  const { charsPerSecond: cps, endBufferSec: endBuffer, level } = opts
  if (!Number.isFinite(minutes)) throw new RangeError(`时长不是有效数字：${minutes}`)
  if (
    !(script.minMinutes > 0 && script.maxMinutes >= script.minMinutes && Number.isFinite(script.maxMinutes))
  )
    throw new RangeError(`引导词「${script.id}」的时长范围无效：${script.minMinutes}–${script.maxMinutes}`)
  if (cps !== undefined && !(cps > 0 && Number.isFinite(cps))) throw new RangeError(`语速应大于 0：${cps}`)
  if (endBuffer !== undefined && !(endBuffer >= 0 && Number.isFinite(endBuffer)))
    throw new RangeError(`结尾留白不能为负：${endBuffer}`)
  if (level !== undefined && !Object.hasOwn(LEVEL_RANK, level))
    throw new RangeError(`未知的引导详细程度：${level}`)
  if (opts.prosody !== undefined && opts.prosody !== 'steady' && opts.prosody !== 'settle')
    throw new RangeError(`未知的语气：${opts.prosody}`)
}

function select(script: GuidedScript, minutes: number, level: GuidanceLevel): Parts {
  const pick = (lines: readonly ScriptLine[]): ScriptLine[] =>
    lines.filter(l => lineIncluded(l, minutes, level))
  return {
    opening: pick(script.opening),
    sections: script.sections
      .filter(s => s.omitAtOrBelow === undefined || s.omitAtOrBelow < minutes)
      .map(s => ({ ...s, intro: pick(s.intro) })),
    closing: pick(script.closing),
  }
}

/** 这一句按什么语速（字/秒）估算：settle 时按这一句放慢后的语速 */
const cpsFor = (frame: Frame, line: ScriptLine): number => frame.cps * (frame.toneOf?.(line).rate ?? 1)

/** 这一句在这个排版里读完要的秒数（已算上整体压缩） */
const readIn = (frame: Frame, line: ScriptLine): number =>
  readingSec(line, cpsFor(frame, line)) * frame.squeeze

/** 这一句连同句后停顿在这个排版里占用的秒数 */
const lineIn = (frame: Frame, line: ScriptLine): number =>
  (readingSec(line, cpsFor(frame, line)) + pauseOf(line, frame.pauseScale)) * frame.squeeze

const linesSec = (lines: readonly ScriptLine[], frame: Frame): number => sum(lines.map(l => lineIn(frame, l)))

/** 开场前的停顿、段落提示音前的间隔（已算上整体压缩） */
const openingDelay = (frame: Frame): number => OPENING_DELAY_SEC * frame.squeeze
const sectionLead = (frame: Frame): number => SECTION_CUE_LEAD_SEC * frame.squeeze

/** 算出这份挑好的脚本占用的时间；只取需要的字段，传入旧的 Layout 当 frame 也不会带进过时的数值 */
function timed(frame: Frame, parts: Parts): Layout {
  const { minutes, duration, cps, endBuffer, toneOf, pauseScale, squeeze } = frame
  const { opening, sections, closing } = parts
  const closingSec = linesSec(closing, frame)
  const speechSec =
    openingDelay(frame) +
    linesSec(opening, frame) +
    sum(sections.map(s => sectionLead(frame) + linesSec(s.intro, frame))) +
    closingSec
  return {
    minutes,
    duration,
    cps,
    endBuffer,
    toneOf,
    pauseScale,
    squeeze,
    opening,
    sections,
    closing,
    speechSec,
    closingSec,
    flexible: duration - endBuffer - speechSec,
  }
}

function layout(
  script: GuidedScript,
  requested: number,
  opts: TimelineOptions,
  toneOf: ToneOf | null,
): Layout {
  checkInputs(script, requested, opts)
  const minutes = clamp(requested, script.minMinutes, script.maxMinutes)
  const frame: Frame = {
    minutes,
    duration: minutes * 60,
    cps: opts.charsPerSecond ?? DEFAULT_CHARS_PER_SECOND,
    endBuffer: opts.endBufferSec ?? DEFAULT_END_BUFFER_SEC,
    toneOf,
    pauseScale: 1,
    squeeze: 1,
  }
  return timed(frame, select(script, minutes, opts.level ?? 'detailed'))
}

/**
 * 按语气排版。settle 的语速取决于一句话落在练习的哪个时刻，而时刻又取决于前面各句的长短：
 * 先按 steady 排一遍，用每句话在那一遍里的时刻定它的语气，再按放慢后的语速重排。
 * 每句话估算长度用的语速就是交给语音的语速，两者一致，话音不会重叠；语气只比实际时刻早几秒
 */
function voiced(script: GuidedScript, minutes: number, opts: TimelineOptions): Layout {
  const steady = layout(script, minutes, opts, null)
  if ((opts.prosody ?? 'steady') === 'steady') return steady
  const times = new Map<ScriptLine, number>()
  arrange(trimToFit(steady), times)
  const d = steady.duration
  // 第一遍省略掉的句子按最慢的语速估算，宁可多留静默
  return layout(script, minutes, opts, line => settleTone((times.get(line) ?? d) / d))
}

/** 省略段落的先后：只在长时长才有的段落最先（门槛越高越先），其余从后往前 */
function dropOrder(sections: readonly ScriptSection[]): ScriptSection[] {
  const rank = (s: ScriptSection): number => s.omitAtOrBelow ?? 0
  // 排序是稳定的：先倒过来，同等的段落就从后往前
  return [...sections].reverse().sort((a, b) => rank(b) - rank(a))
}

/** 只在长时长才有的段落（omitAtOrBelow）：和 minMinutes 的句子一样，是长版本多出来的内容 */
const longOnly = (s: ScriptSection): boolean => s.omitAtOrBelow !== undefined

/** 连结束前的留白也让出来，话仍然说不完 */
const overflows = (l: Layout): boolean => l.flexible + l.endBuffer < -TIME_EPS

/** 去掉某个档位的句子（连同同档位、只占时间的空行）；core 永远不去掉 */
function withoutDetail(l: Layout, detail: Exclude<GuidanceDetail, 'core'>): Parts {
  const keep = (lines: readonly ScriptLine[]): ScriptLine[] => lines.filter(x => x.detail !== detail)
  return {
    opening: keep(l.opening),
    sections: l.sections.map(s => ({ ...s, intro: keep(s.intro) })),
    closing: keep(l.closing),
  }
}

/**
 * 按比例缩短写明的停顿（ScriptLine.pause，包括只占时间的空行），刚好说得完为止；缩到 0 还说不完就缩到 0。
 * 说话的总时长随比例线性变化，所以按比例为 0 和 1 时的两次估算直接解出比例
 */
function shrinkPauses(l: Layout): Layout {
  const full = timed({ ...l, pauseScale: 1 }, l)
  if (!overflows(full)) return full
  const bare = timed({ ...l, pauseScale: 0 }, l)
  const written = full.speechSec - bare.speechSec
  if (!(written > 0) || overflows(bare)) return bare
  return timed({ ...l, pauseScale: clamp((l.duration - bare.speechSec) / written, 0, 1) }, l)
}

/**
 * 话说不完（语速慢、内容过长）时，依次删减，直到在结束钟声之前说得完：
 * 1. 让出结束前的留白；
 * 2. 省略只在长时长才有的段落（omitAtOrBelow，门槛越高越先）：长版本多出来的内容最先让出；
 * 3. 去掉「详细」档的句子，再去掉「标准」档的句子（各档的句子成套地写，整档去掉；只占时间的空行跟着它推动的那句话）；
 * 4. 按比例缩短写明的停顿（ScriptLine.pause）；
 * 5. 从后往前整段省略其余的段落，每省一段都重新放宽停顿；
 * 6. 仍然说不完时，整体压缩说话的时间（每句都显示得更快），任何一句 core 都不单独省略。
 * 开场最先说的是安全提示，所以 core 的开场和结尾的话从不省略
 */
function trimToFit(full: Layout): Layout {
  if (!overflows(full)) return full
  let l = full
  for (const drop of dropOrder(l.sections).filter(longOnly)) {
    l = timed(l, { ...l, sections: l.sections.filter(s => s !== drop) })
    if (!overflows(l)) return l
  }
  for (const detail of ['detailed', 'standard'] as const) {
    l = timed(l, withoutDetail(l, detail))
    if (!overflows(l)) return l
  }
  l = shrinkPauses(l)
  for (const drop of dropOrder(l.sections)) {
    if (!overflows(l)) return l
    l = shrinkPauses({ ...l, sections: l.sections.filter(s => s !== drop) })
  }
  if (!overflows(l) || !(l.speechSec > 0)) return l
  // 结束前的留白已经让出，说话正好占满整个时长
  return timed({ ...l, squeeze: (l.squeeze * l.duration) / l.speechSec }, l)
}

/**
 * 按权重分配静默，每段不少于自己的下限：先按权重分，分到的低于下限的段固定在下限，
 * 其余各段重新按权重分剩下的时间，直到没有段低于下限。
 * 总量连下限之和都不够时，按下限等比压缩。
 */
function distributeSilence(total: number, sections: readonly ScriptSection[]): number[] {
  const floors = sections.map(s => Math.max(0, s.minSilence ?? 0))
  const floorSum = sum(floors)
  if (total <= floorSum) return floors.map(f => (floorSum > 0 ? (f * Math.max(0, total)) / floorSum : 0))
  const weights = sections.map(s => (Number.isFinite(s.weight) ? Math.max(0, s.weight) : 0))
  const pinned = floors.map(() => false)
  for (;;) {
    let rest = total
    let weightSum = 0
    let free = 0
    for (const [i, f] of floors.entries()) {
      if (pinned[i]) rest -= f
      else {
        weightSum += weights[i] ?? 0
        free++
      }
    }
    // 权重全为 0 时平均分
    const share = (i: number): number =>
      weightSum > 0 ? (rest * (weights[i] ?? 0)) / weightSum : rest / free
    let changed = false
    for (const [i, f] of floors.entries()) {
      if (!pinned[i] && share(i) < f) {
        pinned[i] = true
        changed = true
      }
    }
    if (!changed) return floors.map((f, i) => (pinned[i] ? f : share(i)))
  }
}

/** 估算一份引导词在某个时长下的用时；内容层可用它检查每份引导词在最短时长下也说得完 */
export function measureScript(
  script: GuidedScript,
  minutes: number,
  opts: TimelineOptions = {},
): ScriptMeasure {
  const l = voiced(script, minutes, opts)
  return {
    minutes: l.minutes,
    duration: l.duration,
    sectionIds: l.sections.map(s => s.id),
    speechSec: l.speechSec,
    silenceSec: l.flexible,
    minSilenceSec: sum(l.sections.map(s => Math.max(0, s.minSilence ?? 0))),
  }
}

type SectionRef = Pick<TimelineCue, 'sectionId' | 'sectionTitle'>

const refOf = (s: ScriptSection): SectionRef => ({ sectionId: s.id, sectionTitle: s.title })

/** 一句话的提示；没有可读文字的行只占时间（用来把下一句推到想要的时刻） */
function speakCue(
  line: ScriptLine,
  t: number,
  dur: number,
  ref: SectionRef | null,
  tone: Tone | null,
): TimelineCue | null {
  const said = (line.say ?? line.text).trim()
  if (spokenChars(said) === 0) return null
  const text = line.text.trim() || said
  const cue: TimelineCue = said === text ? { t, kind: 'speak', text } : { t, kind: 'speak', text, say: said }
  return { ...cue, ...ref, ...(tone ? { rate: tone.rate, volume: tone.volume } : {}), dur }
}

/** 从 start 开始逐句排上朗读提示，返回说完的时刻；times 记下每句话开口的时刻 */
function emitLines(
  lines: readonly ScriptLine[],
  start: number,
  frame: Frame,
  out: TimelineCue[],
  ref: SectionRef | null,
  times?: Map<ScriptLine, number>,
): number {
  let t = start
  for (const line of lines) {
    const tone = frame.toneOf?.(line) ?? null
    const cue = speakCue(line, t, readIn(frame, line), ref, tone)
    if (cue) out.push(cue)
    times?.set(line, t)
    t += lineIn(frame, line)
  }
  return t
}

/**
 * 在一段静默里均匀插入提醒：条数尽量多，但每段安静（包括两头）都不少于规定的秒数。
 * 提醒按列表顺序循环使用。settle 时同一段静默里的提醒都用静默开头那一刻的语气
 */
function reminderCues(section: ScriptSection, from: number, to: number, frame: Frame): TimelineCue[] {
  const texts = (section.reminders ?? []).map(s => s.trim()).filter(s => spokenChars(s) > 0)
  const span = to - from
  if (texts.length === 0 || span < REMINDER_MIN_SILENCE_SEC - TIME_EPS) return []
  const tone = frame.toneOf ? settleTone(from / frame.duration) : null
  const cps = frame.cps * (tone?.rate ?? 1)
  const textAt = (k: number): string => texts[k % texts.length] ?? ''
  const durAt = (k: number): number => lineSec({ text: textAt(k) }, cps)
  let count = 0
  let gap = 0
  let spoken = 0
  for (let n = 1; ; n++) {
    spoken += durAt(n - 1)
    const g = (span - spoken) / (n + 1)
    if (g < (n === 1 ? REMINDER_EDGE_SEC : REMINDER_SPACING_SEC) - TIME_EPS) break
    count = n
    gap = g
  }
  const cues: TimelineCue[] = []
  let t = from
  for (let k = 0; k < count; k++) {
    t += gap
    const text = textAt(k)
    const cue: TimelineCue = { t, kind: 'speak', text, ...refOf(section) }
    const dur = readingSec({ text }, cps)
    cues.push(tone ? { ...cue, rate: tone.rate, volume: tone.volume, dur } : { ...cue, dur })
    t += durAt(k)
  }
  return cues
}

/**
 * 按时长排出引导时间线。时长会夹在脚本支持的范围内；时长不超过某段 omitAtOrBelow 的段落、
 * 不属于这个档位或时长的句子都会被省略。
 * 说得完时，结尾的话在结束钟声前的留白之前说完。时间不够时先等比压缩静默，再让出留白；
 * 仍然说不完才依次省略只在长时长才有的段落、去掉「详细」「标准」档的句子、缩短写明的停顿、
 * 从后往前省略段落，最后整体压缩（见 trimToFit），core 的开场和结尾的话从不省略。
 * 所以任何输入下，每句话（按各自的 dur）都不会互相重叠，也不会盖住结束钟声。
 * 每句话的提示带着 dur（读完要的秒数）；closingT 为结尾的话开始的时刻
 */
export function buildTimeline(script: GuidedScript, minutes: number, opts: TimelineOptions = {}): Timeline {
  return arrange(trimToFit(voiced(script, minutes, opts)))
}

/** 把排好版的脚本落成时间线；times 记下每句话开口的时刻 */
function arrange(l: Layout, times?: Map<ScriptLine, number>): Timeline {
  const silences = distributeSilence(l.flexible, l.sections)
  const cues: TimelineCue[] = []
  const starts: number[] = []
  let t = emitLines(l.opening, openingDelay(l), l, cues, null, times)
  for (const [i, section] of l.sections.entries()) {
    starts.push(t)
    cues.push({ t, kind: 'section', ...refOf(section) })
    const quietFrom = emitLines(section.intro, t + sectionLead(l), l, cues, refOf(section), times)
    t = quietFrom + (silences[i] ?? 0)
    cues.push(...reminderCues(section, quietFrom, t, l))
  }
  // 结尾的话贴着结束钟声之前的留白排；没有段落时，多出的时间成为结尾前的静默
  const closingStart = Math.max(t, l.duration - l.endBuffer - l.closingSec)
  const firstClosing = cues.length
  emitLines(l.closing, closingStart, l, cues, null, times)
  const sections: TimelineSection[] = l.sections.map((s, i) => ({
    id: s.id,
    title: s.title,
    t0: starts[i] ?? 0,
    t1: starts[i + 1] ?? closingStart,
    ...(s.skippable === undefined ? {} : { skippable: s.skippable }),
  }))
  return { duration: l.duration, cues, sections, closingT: cues[firstClosing]?.t ?? l.duration }
}
