/**
 * 会话控制器：一次练习从倒数、进行、暂停到结束的状态机。
 * 与框架无关；声音、语音、振动、屏幕常亮都经端口注入。
 * 界面通过 subscribe/getState 读粗粒度的状态，逐帧绘制只读 time() 和 breathAt()。
 * v1 是文字引导（PRODUCT §0、§5）：引导词按时刻成为字幕；安静了 20 秒以上才出现的一句，先轻响一声（captionCue）
 */
import type { SoundMix } from '@/audio/types'
import { clamp, round1 } from '@/lib/math'
import { createAudioClock, createPerfClock, type SessionClock } from './clock'
import {
  type Pace,
  paceAt,
  paceBreaths,
  paceCycleAt,
  paceCycles,
  paceEndAt,
  paceOf,
  paceSteps,
  paceTarget,
  stepBack as stepBackPace,
} from './pace'
import { ease } from './patterns'
import { createLookahead, createTicker, horizonFor, type Lookahead } from './scheduler'
import { settleTone, speakSec } from './timeline'
import type {
  AudioPort,
  CountState,
  CueStyle,
  EndReason,
  PhaseKey,
  PlatformPort,
  SectionState,
  Segment,
  SessionController,
  SessionPlan,
  SessionResult,
  SessionState,
  SessionStatus,
  SpeakOptions,
  Timeline,
  TimelineCue,
  VoicePort,
} from './types'

/** 第一批声音排在「现在」稍后一点，免得调用返回时开始时刻已经过去 */
export const START_DELAY_SEC = 0.08
/** 背景声默认淡入的秒数（放松）；睡前由计划给出更长的淡入 */
export const DEFAULT_FADE_IN_SEC = 8
/** 开始钟声至少落在背景声响起这么多秒之后：先让声音铺开，再敲钟 */
export const BED_BEFORE_BELL_SEC = 3
/** 计划时长至少这么长才做完整的静默收尾 */
export const SILENT_END_MIN_SEC = 180
/** 完整的静默收尾：最后 60 秒背景声开始淡出，30 秒淡完，留 30 秒安静再响结束钟声（PRODUCT §5） */
export const SILENT_END_SEC = 60
export const SILENT_END_FADE_SEC = 30
/** 1–3 分钟的练习留不出一分钟：最后 25 秒开始淡出，15 秒淡完，留 10 秒安静 */
export const SHORT_SILENT_END_MIN_SEC = 60
export const SHORT_SILENT_END_SEC = 25
export const SHORT_SILENT_END_FADE_SEC = 15
/** 不响结束钟声（睡前）：背景声在最后 120 秒里慢慢淡出，不惊醒人 */
export const NO_BELL_FADE_SEC = 120
/** 正常结束时背景声淡出的秒数；结束钟声照常响完 */
export const COMPLETE_BED_FADE_SEC = 6
/** 提前结束时背景声淡出的秒数：不硬切 */
export const STOP_BED_FADE_SEC = 1.5
/** 声音这么久之后仍没走起来，就当作被浏览器拦下，改为静音继续 */
export const AUDIO_START_GRACE_MS = 1500
/** 等待解锁声音的上限；个别浏览器在没有输出设备时一直不返回 */
export const UNLOCK_TIMEOUT_MS = 3000
/** 节拍提示停在结束前这么多秒，免得最后一声和结束钟声挤在一起 */
export const PACED_TAIL_SEC = 0.25
/** 间隔钟声不排在离结束这么近的地方，那里由结束钟声接管 */
export const INTERVAL_END_GUARD_SEC = 1
/** 两次回神至少相隔的秒数，过滤手抖造成的连点 */
export const MARK_DEBOUNCE_SEC = 0.6
/** 数息：第九口之前应点的次数 */
export const COUNT_BEFORE_NINTH = 8
/** 数息：一轮里平均每次点击的间隔短于这个秒数，就不可能是跟着呼吸点的（PRODUCT §7） */
export const COUNT_MIN_TAP_INTERVAL_SEC = 1.5
/** 引导语迟到超过这么多秒就只显示字幕、不再朗读，免得后台限速之后一口气读出好几句 */
export const SPEECH_LATE_TOLERANCE_SEC = 5
/**
 * 新的一句之前安静了这么多秒以上，出现时轻响一声（PRODUCT §5）：闭着眼睛练的人听到再看屏幕。
 * 安静从上一句估算读完的时刻算起；段落提示音（plan.cues 时）、时间线上的钟声和练习开始也算打破安静
 */
export const CAPTION_CUE_GAP_SEC = 20
/** 精确定时器的最短间隔：声音尚未走起来时读数不动，避免空转 */
export const FINE_TIMER_MIN_MS = 10
/** 跳过段落时，下一段在这么多秒之后开始：段落提示音来得及排进声音时间线 */
export const SKIP_LEAD_SEC = 0.05
/** 重排节拍时，正在进行的那一段只剩这么短就不再补排起伏 */
export const MIN_PARTIAL_SEC = 0.05
/** 重排节拍时，正在进行的那一段剩下不到这么久就不再补一个滑音：滑音两端柔和起止，太短只剩一声杂音 */
export const MIN_PARTIAL_GLIDE_SEC = 0.5
/** 不完整的滑音拆成直线小段时，每小段不长于整段的这么多分之一：弦与弧之差不到起伏幅度的 0.3% */
export const PARTIAL_GLIDE_STEPS = 16
/** 节拍振动：吸气一下，第二口吸气轻一下，呼气两下，屏息不振 */
export const HAPTICS: Readonly<Record<PhaseKey, number | readonly number[] | null>> = {
  in: 40,
  in2: 20,
  out: [30, 60, 30],
  hold: null,
  rest: null,
}

export interface SessionPorts {
  audio: AudioPort
  /** 朗读引导词；不给时用 NULL_VOICE。v1 没有语音引导，留给以后的真人录音 */
  voice?: VoicePort
  platform: PlatformPort
}

/** 不出声的语音端口：v1 只有文字引导（PRODUCT §0），应用层把它交给会话控制器 */
export const NULL_VOICE: VoicePort = Object.freeze({
  available: () => false,
  speak: () => undefined,
  cancel: () => undefined,
})

export interface SessionTimers {
  setInterval(fn: () => void, ms: number): unknown
  clearInterval(id: unknown): void
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
}

export interface SessionOptions extends Partial<SessionTimers> {
  /** 时间流速；不为 1 时改用 performance 时钟且不出声，只用于开发和端到端测试 */
  timeScale?: number
  /** 毫秒时钟，默认 () => performance.now()（不要直接传 performance.now，它离开 performance 不能调用） */
  perfNow?: () => number
}

/** 背景声的一次淡出（练习秒数） */
export interface Fade {
  at: number
  dur: number
}

/** 一次练习的结尾（练习秒数）：结束钟声、背景声淡出、进入静默段的时刻；没有的为 null */
export interface Ending {
  bell: number | null
  fade: Fade | null
  silentAt: number | null
}

/**
 * 按结束时刻排结尾。有结束钟声时：静默收尾按时长分两档；不做静默收尾时背景声随结束钟声淡出，
 * 也预先排进声音时间线，页面在后台、定时器被限速时照样准时。不响钟时（睡前，endBell 为 false）背景声在最后 120 秒里淡出。
 * bells 为 false（设置里关掉了钟声）时结尾的安排不变，只是不敲钟：bell 为 null
 */
export function endingOf(end: number, silentEnd: boolean, endBell: boolean, bells = true): Ending {
  if (!(end > 0 && Number.isFinite(end))) return { bell: null, fade: null, silentAt: null }
  if (!endBell) {
    const dur = Math.min(NO_BELL_FADE_SEC, end)
    return { bell: null, fade: { at: end - dur, dur }, silentAt: null }
  }
  const bell = bells ? end : null
  if (silentEnd && end >= SILENT_END_MIN_SEC) {
    const at = end - SILENT_END_SEC
    return { bell, fade: { at, dur: SILENT_END_FADE_SEC }, silentAt: at }
  }
  if (silentEnd && end >= SHORT_SILENT_END_MIN_SEC) {
    const at = end - SHORT_SILENT_END_SEC
    return { bell, fade: { at, dur: SHORT_SILENT_END_FADE_SEC }, silentAt: at }
  }
  return { bell, fade: { at: end, dur: COMPLETE_BED_FADE_SEC }, silentAt: null }
}

type Moving = 'lead' | 'running'

interface Run {
  plan: SessionPlan
  /** 练习在第几秒结束：等于计划时长，跳过段落后提前；不限时为 Infinity */
  end: number
  clock: SessionClock
  /** 声音时钟上练习第 0 秒的位置；不出声时无用 */
  origin: number
  audioOn: boolean
  /** 刚开始或刚继续、声音还没走起来；这期间声音的状态变化不算中断 */
  audioPending: boolean
  style: CueStyle
  startBell: boolean
  endBell: boolean
  /** 设置里的「钟声」：false 时开始、结束都不敲 */
  bells: boolean
  /** 实际走的节拍（含开头放慢和「有点急」）；不跟节拍为 null */
  pace: Pace | null
  /**
   * 节拍停下的练习秒数：带引导词的呼吸练习在结尾的话开始以后走完正在走的这一段就停（paceEndAt）；
   * 没有结尾的话、不跟节拍时等于 end。节拍、结束时刻或时间线变了都要重算（paceEndOf）
   */
  paceEnd: number
  /** 实际走的时间线（跳过段落后，后面的提示整体提前）；没有引导词为 null */
  timeline: Timeline | null
  skipped: string[]
  /** 进入静默收尾的练习秒数 */
  silentAt: number | null
  resumeTo: Moving
  tracks: Lookahead[]
  /** 下一条尚未触发的引导提示 */
  cueIdx: number
  /** 上一次回神的练习秒数（未取整），用来过滤连点 */
  lastMark: number
  /** 数息：本轮第一下的练习秒数；本轮还没点为 null */
  countFrom: number | null
  /** 下一件需要准时处理的事（换段、引导语、段落、结束）的练习秒数 */
  nextDue: number
  fineTimer: unknown
  watchTimer: unknown
  unsubAudio: (() => void) | null
  unsubVisibility: (() => void) | null
}

const isMoving = (s: SessionStatus): s is Moving => s === 'lead' || s === 'running'
const isActive = (s: SessionStatus): boolean => isMoving(s) || s === 'paused'

/** 节拍停下的时刻：带引导词时结尾的话开始后走完正在走的这一段，否则到练习结束 */
const paceEndOf = (r: Pick<Run, 'pace' | 'timeline' | 'end'>): number =>
  r.pace ? paceEndAt(r.pace, r.timeline?.closingT ?? r.end, r.end) : r.end

/** breathAt 从哪一刻起返回 null：节拍在练习结束前停下时是停下的时刻；一直走到结束的节拍照旧往后读 */
const breathCutOf = (r: Pick<Run, 'paceEnd' | 'end'>): number =>
  r.paceEnd < r.end ? r.paceEnd : Number.POSITIVE_INFINITY

const idleState = (): SessionState => ({
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
})

const zeroCount = (): CountState => ({ current: 0, cycles: 0, correct: 0, errors: 0, resets: 0, invalid: 0 })

/** 点了第九口：这一轮按对、错或点得太快记下。span 为这一轮第一下到第九口的秒数 */
function closeCount(c: CountState, span: number | null): CountState {
  const tooFast = c.current > 0 && span !== null && span / c.current < COUNT_MIN_TAP_INTERVAL_SEC
  const ok = c.current === COUNT_BEFORE_NINTH
  return {
    ...c,
    current: 0,
    cycles: c.cycles + 1,
    correct: c.correct + (!tooFast && ok ? 1 : 0),
    errors: c.errors + (!tooFast && !ok ? 1 : 0),
    invalid: c.invalid + (tooFast ? 1 : 0),
  }
}

/** 监听者出错不能打断引擎；错误改到下一个微任务里抛出，照样会出现在控制台 */
function callSafely(fn: () => void): void {
  try {
    fn()
  } catch (err) {
    queueMicrotask(() => {
      throw err
    })
  }
}

/** 声音端口的挂起、恢复失败不影响练习本身 */
function quietly(fn: () => Promise<void>): void {
  try {
    fn().catch(() => undefined)
  } catch {
    // 同上
  }
}

function checkPlan(plan: SessionPlan): void {
  if (!(Number.isFinite(plan.plannedSec) && plan.plannedSec >= 0))
    throw new RangeError(`计划时长无效：${plan.plannedSec}`)
  if (!(Number.isFinite(plan.leadSec) && plan.leadSec >= 0))
    throw new RangeError(`倒数秒数无效：${plan.leadSec}`)
  if (plan.fadeInSec !== undefined && !(Number.isFinite(plan.fadeInSec) && plan.fadeInSec >= 0))
    throw new RangeError(`淡入秒数无效：${plan.fadeInSec}`)
  const p = plan.pattern
  if (p && !(Number.isFinite(p.T) && p.T > 0 && p.segs.length > 0))
    throw new RangeError(`节拍无效：一轮 ${p.T} 秒、${p.segs.length} 段`)
  for (const c of p?.warmup ?? [])
    if (!(Number.isFinite(c.T) && c.T > 0 && c.segs.length > 0))
      throw new RangeError(`开头放慢的节拍无效：一轮 ${c.T} 秒、${c.segs.length} 段`)
}

/** 背景声是否真有声音：选了声景或音乐，且音量不为 0 */
const bedAudible = (s: SoundMix): boolean =>
  (s.ambience !== 'none' && s.ambienceVolume > 0) || (s.music !== 'none' && s.musicVolume > 0)

/** 听声音不敲开始钟；设置里关掉钟声时也不敲 */
const hasStartBell = (plan: SessionPlan): boolean => plan.kind !== 'sound' && plan.bells !== false

/**
 * 实际倒数的秒数：出声、有背景声又有开始钟声时至少 BED_BEFORE_BELL_SEC 秒，背景声先铺开再敲钟。
 * 倒数本身拉长，而不是倒数完了再等钟声：界面上倒数到 0 的那一刻始终就是练习的第 0 秒。
 * 界面画倒数进度时用它（audioOn 即 SessionState.audio === 'on'）
 */
export function leadFor(plan: SessionPlan, audioOn: boolean): number {
  const needsBed = audioOn && hasStartBell(plan) && bedAudible(plan.sound)
  return needsBed ? Math.max(plan.leadSec, BED_BEFORE_BELL_SEC) : plan.leadSec
}

/**
 * 一段里从 a 秒到 b 秒的那一部分（段内秒数）当作一条直线：两端落在原来的缓动曲线上，中间直着走。
 * 屏息不动的段截一截还是不动
 */
function chordOf(seg: Segment, a: number, b: number): Segment {
  const y = (x: number): number => seg.y0 + (seg.y1 - seg.y0) * ease(seg.ease, seg.dur > 0 ? x / seg.dur : 1)
  return {
    ...seg,
    t0: seg.t0 + a,
    dur: b - a,
    y0: y(a),
    y1: y(b),
    ease: seg.ease === 'flat' ? 'flat' : 'linear',
  }
}

/**
 * 滑音只跟一段里从 a 秒到 b 秒的那一部分时（重排节拍时补排、练习结束时截尾），在段内哪几处切开。
 * 声音端口按收到的那一段自己的时长取缓动：把整段的缓动套在半截上，音高会在半截的开头从零坡度重新起步，
 * 中途离开画面上的曲线可达起伏幅度的七分之一。所以拆成首尾相接的直线小段，交界处都落在原来的曲线上，
 * 声音端口把首尾相接的滑音连成一个音。每小段不长于整段的 1/PARTIAL_GLIDE_STEPS；
 * 只有从一段的开头起（练习结束截掉的最后一段）才可能新起一个音，声音端口按第一小段的长短起音，
 * 那里的第一小段不短于 MIN_PARTIAL_GLIDE_SEC，起音和整段时一样柔和。本来就是直线的段不必拆
 */
function glideCuts(seg: Segment, a: number, b: number): number[] {
  if (seg.ease === 'linear' || seg.ease === 'flat' || !(seg.dur > 0)) return [a, b]
  const step = seg.dur / PARTIAL_GLIDE_STEPS
  const cuts = [a]
  let x = a > 0 ? a : Math.min(b, Math.max(step, MIN_PARTIAL_GLIDE_SEC))
  // 剩下的零头并进前一小段，不留一小截
  if (b - x < 1e-6) x = b
  if (x > a) cuts.push(x)
  const n = Math.ceil((b - x) / step - 1e-6)
  for (let k = 1; k <= n; k++) cuts.push(k === n ? b : x + ((b - x) * k) / n)
  return cuts
}

/** 晚于 after、早于 stopAt 开始的每一段，按轮展开；与 paceAt 的读数严格一致 */
function* segmentTimes(pace: Pace, after: number, stopAt: number): Generator<{ seg: Segment; t: number }> {
  for (const cycle of paceCycles(pace)) {
    if (cycle.start >= stopAt) return
    if (cycle.start + cycle.T <= after) continue
    for (const seg of cycle.segs) {
      const t = cycle.start + seg.t0
      if (t >= stopAt) return
      if (t > after) yield { seg, t }
    }
  }
}

/** 晚于 after、不晚于 last 的间隔钟声；第 0 秒不响 */
function* intervalTimes(every: number, after: number, last: number): Generator<number> {
  for (let k = Math.max(1, Math.floor(after / every) + 1); k * every <= last; k++) yield k * every
}

function sectionIndexAt(timeline: Timeline, t: number): number {
  for (let i = timeline.sections.length - 1; i >= 0; i--) {
    const s = timeline.sections[i]
    if (s && s.t0 <= t) return i
  }
  return -1
}

/** t 之后最近的段落边界（开始或结束） */
function nextSectionEdge(timeline: Timeline, t: number): number {
  for (const s of timeline.sections) {
    if (s.t0 > t) return s.t0
    if (s.t1 > t) return s.t1
  }
  return Number.POSITIVE_INFINITY
}

/** 字幕所属的段落；开场和结尾的话不属于任何段落 */
function sectionTitleOf(timeline: Timeline, cue: TimelineCue): string | null {
  if (cue.sectionTitle !== undefined) return cue.sectionTitle
  return timeline.sections.find(s => s.t0 <= cue.t && cue.t < s.t1)?.title ?? null
}

/** 浮点误差：按下限排出的安静可能算出 19.999…，不该因此少响一声 */
const GAP_EPS = 1e-6

/**
 * 时间线上哪几句出现时要轻响一声（练习秒数）：这一句之前安静了 CAPTION_CUE_GAP_SEC 秒以上。
 * 安静从上一句估算读完的时刻（t + dur）算起；练习开始（开始钟声）、时间线上的钟声，
 * 以及 sectionChimes 为 true 时的段落提示音也算打破安静——提示音之后紧跟着的那一句不再另响一声。
 * 第一句之前安静了 20 秒以上也响
 */
export function captionCueTimes(timeline: Timeline, sectionChimes: boolean): number[] {
  const times: number[] = []
  let quietFrom = 0
  for (const c of timeline.cues) {
    if (c.kind === 'chime' || (c.kind === 'section' && sectionChimes)) quietFrom = Math.max(quietFrom, c.t)
    if (c.kind !== 'speak' || !c.text) continue
    if (c.t - quietFrom >= CAPTION_CUE_GAP_SEC - GAP_EPS) times.push(c.t)
    quietFrom = Math.max(quietFrom, c.t + speakSec(c))
  }
  return times
}

/**
 * 跳过第 index 段：它剩下的提示不再说，后面的提示和段落整体提前 delta 秒，下一段从 from 开始。
 * 已触发的前 fired 条原样保留，序号不变
 */
function skipAhead(tl: Timeline, index: number, from: number, delta: number, fired: number): Timeline {
  const cur = tl.sections[index]
  const next = tl.sections[index + 1]
  if (!cur || !next) return tl
  const cues = tl.cues.flatMap((c, k): TimelineCue[] => {
    if (k < fired || c.t < cur.t0) return [c]
    return c.t >= next.t0 ? [{ ...c, t: c.t - delta }] : []
  })
  const sections = tl.sections.map((s, k) => {
    if (k < index) return s
    if (k === index) return { ...s, t1: from }
    return { ...s, t0: s.t0 - delta, t1: s.t1 - delta }
  })
  const closing = tl.closingT === undefined ? {} : { closingT: tl.closingT - delta }
  return { duration: tl.duration - delta, cues, sections, ...closing }
}

/** 朗读的语速、音量倍数：时间线上有就照用；计划要 settle 而时间线没排时，只让声音渐轻，不改语速 */
function speakOptions(plan: SessionPlan, tl: Timeline, cue: TimelineCue): SpeakOptions | null {
  const q = tl.duration > 0 ? cue.t / tl.duration : 1
  const volume = cue.volume ?? (plan.prosody === 'settle' ? settleTone(q).volume : undefined)
  if (cue.rate === undefined && volume === undefined) return null
  return {
    ...(cue.rate === undefined ? {} : { rate: cue.rate }),
    ...(volume === undefined ? {} : { volume }),
  }
}

export function createSessionController(
  ports: SessionPorts,
  options: SessionOptions = {},
): SessionController {
  const { audio, platform } = ports
  const voice = ports.voice ?? NULL_VOICE
  const timeScale = options.timeScale ?? 1
  if (!(timeScale > 0 && Number.isFinite(timeScale))) throw new RangeError(`时间流速应大于 0：${timeScale}`)
  const perfNow = options.perfNow ?? (() => performance.now())
  // 不带 this 调用：浏览器自带的定时器函数挂在别的对象上调用会报错
  const { setInterval: si, clearInterval: ci, setTimeout: st, clearTimeout: ct } = options
  type Handle = ReturnType<typeof globalThis.setTimeout>
  const timers: SessionTimers = {
    setInterval: (fn, ms) => (si ? si(fn, ms) : globalThis.setInterval(fn, ms)),
    clearInterval: id => (ci ? ci(id) : globalThis.clearInterval(id as Handle)),
    setTimeout: (fn, ms) => (st ? st(fn, ms) : globalThis.setTimeout(fn, ms)),
    clearTimeout: id => (ct ? ct(id) : globalThis.clearTimeout(id as Handle)),
  }

  let state: SessionState = idleState()
  let run: Run | null = null
  /** 结束后仍保留实际走过的节拍和节拍停下的时刻，小结页可以画出整条呼吸曲线；reset 时清掉 */
  let finishedPace: Pace | null = null
  let finishedCut = Number.POSITIVE_INFINITY
  /**
   * 上一次练习到点结束，声音时间线上可能还留着结束钟声没敲完的几击（真实声音层里三击相隔 7 秒）。
   * 其他结束方式当场就撤掉了排着的声音，只有这一种会留下东西
   */
  let ringing = false
  /** 正在解锁声音的那次 start；end() 可以在这期间取消它 */
  let pending: { cancelled: boolean } | null = null
  let dueQueued = false
  const listeners = new Set<() => void>()
  const finishListeners = new Set<(result: SessionResult) => void>()
  const ticker = createTicker(() => {
    if (run) tick(run)
  }, timers)

  const notify = (): void => {
    for (const l of [...listeners]) callSafely(l)
  }

  /** 只在确有变化时换一个新快照并通知 */
  function commit(patch: Partial<SessionState>): void {
    const keys = Object.keys(patch) as Array<keyof SessionState>
    if (!keys.some(k => patch[k] !== state[k])) return
    state = { ...state, ...patch }
    notify()
  }

  const flushDue = (): void => {
    dueQueued = false
    if (run) progress(run)
  }

  /* ---------- 推进：状态、换段、字幕、段落、静默收尾、结束 ---------- */

  function progress(r: Run): void {
    if (run !== r || !isMoving(state.status)) return
    const t = r.clock.now()
    if (t >= r.end) {
      finish('complete')
      return
    }
    const patch: Partial<SessionState> = {}
    const endSec = Number.isFinite(r.end) ? r.end : null
    if (endSec !== state.endSec) patch.endSec = endSec
    let due = r.end
    if (t < 0) due = 0
    else {
      if (state.status === 'lead') patch.status = 'running'
      if (r.pace) due = Math.min(due, pacedPhase(r, r.pace, t, patch))
      if (r.timeline) due = Math.min(due, guided(r, r.timeline, t, patch))
      if (r.silentAt !== null) {
        if (t >= r.silentAt) patch.silentEnding = true
        else due = Math.min(due, r.silentAt)
      }
    }
    r.nextDue = due
    commit(patch)
    armFine(r, t)
  }

  /** 换段时更新序号并振动，换轮时更新速度；返回这一段结束的时刻。节拍停下以后序号为 -1，不再振动 */
  function pacedPhase(r: Run, pace: Pace, t: number, patch: Partial<SessionState>): number {
    if (t >= r.paceEnd) {
      patch.phaseIndex = -1
      return r.end
    }
    const p = paceAt(pace, t)
    if (p.idx !== state.phaseIndex) {
      patch.phaseIndex = p.idx
      const buzz = p.seg && r.plan.haptics ? HAPTICS[p.seg.key] : null
      if (buzz !== null) platform.vibrate(typeof buzz === 'number' ? buzz : [...buzz])
    }
    const rate = paceCycleAt(pace, t).rate
    if (rate !== state.rate) patch.rate = rate
    return Math.min(t + Math.max(p.rem, 1e-3), r.paceEnd)
  }

  /** 引导：段落、字幕、朗读；返回下一件事的时刻 */
  function guided(r: Run, tl: Timeline, t: number, patch: Partial<SessionState>): number {
    // 呼吸练习也可能带引导词；这时序号跟着节拍走，不能被引导段落覆盖
    if (!r.pace) patch.phaseIndex = sectionIndexAt(tl, t)
    patch.section = sectionAt(r, tl, t)
    return Math.min(guidedCues(r, tl, t, patch), nextSectionEdge(tl, t))
  }

  /** 当前段落；没变时沿用旧对象，免得每次推进都通知界面 */
  function sectionAt(r: Run, tl: Timeline, t: number): SectionState | null {
    const index = sectionIndexAt(tl, t)
    const s = tl.sections[index]
    if (!s || t >= s.t1) return null
    const skippable = s.skippable === true && index < tl.sections.length - 1 && !r.skipped.includes(s.id)
    const prev = state.section
    if (prev && prev.index === index && prev.skippable === skippable) return prev
    return { index, id: s.id, title: s.title, skippable }
  }

  /** 触发已到时间的引导提示；返回下一条的时刻 */
  function guidedCues(r: Run, tl: Timeline, t: number, patch: Partial<SessionState>): number {
    const { cues } = tl
    for (let cue = cues[r.cueIdx]; cue && cue.t <= t; cue = cues[r.cueIdx]) {
      r.cueIdx++
      if (cue.kind === 'section') patch.caption = null
      else if (cue.kind === 'speak' && cue.text) {
        patch.caption = { text: cue.text, section: sectionTitleOf(tl, cue), t: cue.t, dur: speakSec(cue) }
        if (t - cue.t <= SPEECH_LATE_TOLERANCE_SEC) say(r, tl, cue)
      }
    }
    return cues[r.cueIdx]?.t ?? Number.POSITIVE_INFINITY
  }

  function say(r: Run, tl: Timeline, cue: TimelineCue): void {
    // 听声音不朗读
    if (!r.plan.voice || r.plan.kind === 'sound' || !voice.available()) return
    const text = cue.say ?? cue.text ?? ''
    const opts = speakOptions(r.plan, tl, cue)
    if (opts) voice.speak(text, opts)
    else voice.speak(text)
  }

  /** 定时器只按 200 ms 的节奏醒来；换段、引导语和结束另用一个对准时刻的定时器，误差在几毫秒内 */
  function armFine(r: Run, t: number): void {
    timers.clearTimeout(r.fineTimer)
    r.fineTimer = null
    // 监听者可能在通知里暂停或结束了练习
    if (run !== r || !isMoving(state.status) || !Number.isFinite(r.nextDue)) return
    const ms = Math.max(FINE_TIMER_MIN_MS, ((r.nextDue - t) * 1000) / timeScale + 1)
    r.fineTimer = timers.setTimeout(() => progress(r), ms)
  }

  /* ---------- 调度：把前瞻范围里的声音排进声音时间线 ---------- */

  function tick(r: Run): void {
    if (run !== r || !isMoving(state.status)) return
    progress(r)
    if (run !== r || !isMoving(state.status) || !r.audioOn) return
    const t = r.clock.now()
    const horizon = horizonFor(platform.hidden())
    const until = Math.min(t + horizon, r.end)
    for (const track of r.tracks) track.fill(t, until)
    if (!r.pace || r.style === 'off') audio.freeRun(r.origin + Math.min(t + horizon, r.end + 1))
  }

  /**
   * 从练习第 t 秒开始的一段节拍：背景声随它起伏，再按提示方式加滑音或提示音。
   * 滑音截到节拍停下（练习结束）的时刻，最后一个滑音不会盖过结束钟声、拖到小结页上；背景声那时正在淡出，照整段排，
   * 截成半截反而会让声音端口按半截的长短重套缓动（海浪、风的起伏都按整口气排）。
   * 结尾的话开始后节拍停在一段的转折处（paceEndAt），那里的滑音本来就是整段
   */
  function playSegment(r: Run, seg: Segment, t: number): void {
    audio.breath(seg, r.origin + t)
    if (r.style === 'glide') glideOver(r, seg, t, 0, Math.min(seg.dur, r.paceEnd - t))
    if (r.style === 'ping') audio.cue(seg.key, r.origin + t)
  }

  /**
   * 滑音跟练习第 start 秒开始的这一段里从 a 到 b 秒的部分：整段照原样，不完整的按 glideCuts 拆成直线小段。
   * 不完整的一段太短时不加滑音：两端柔和起止，太短只剩一声杂音
   */
  function glideOver(r: Run, seg: Segment, start: number, a: number, b: number): void {
    if (a <= 0 && b >= seg.dur) {
      audio.glide(seg, r.origin + start)
      return
    }
    if (b - a < MIN_PARTIAL_GLIDE_SEC) return
    let prev = a
    for (const x of glideCuts(seg, a, b).slice(1)) {
      audio.glide(chordOf(seg, prev, x), r.origin + start + prev)
      prev = x
    }
  }

  /** 晚于 after 的声音事件，各自一条前瞻轨道 */
  function audioTracks(r: Run, after: number): Lookahead[] {
    const at = (t: number): number => r.origin + t
    const tracks: Lookahead[] = []
    if (r.pace && r.style !== 'off') {
      const segs = segmentTimes(r.pace, after, r.paceEnd - PACED_TAIL_SEC)
      tracks.push(
        createLookahead(
          segs,
          e => e.t,
          e => playSegment(r, e.seg, e.t),
        ),
      )
    }
    const every = r.plan.intervalSec
    if (every !== null && every > 0) {
      const bells = intervalTimes(every, after, r.end - INTERVAL_END_GUARD_SEC)
      tracks.push(
        createLookahead(
          bells,
          t => t,
          t => audio.bell('interval', at(t)),
        ),
      )
    }
    if (r.timeline) {
      // 段落提示音和新的一句的轻提示要提前排进声音时间线；朗读走语音，到点才触发
      const tl = r.timeline
      const chimes = r.plan.cues
      const tones = new Set(r.plan.captionCue && r.plan.kind !== 'sound' ? captionCueTimes(tl, chimes) : [])
      const sounds = tl.cues.filter(
        c =>
          c.t > after &&
          c.t < r.end &&
          (c.kind === 'chime' || (c.kind === 'section' && chimes) || (c.kind === 'speak' && tones.has(c.t))),
      )
      tracks.push(
        createLookahead(
          sounds,
          c => c.t,
          c => {
            if (c.kind === 'section') audio.cue('section', at(c.t))
            else if (c.kind === 'speak') audio.cue('caption', at(c.t))
            else audio.bell('interval', at(c.t))
          },
        ),
      )
    }
    return tracks
  }

  /**
   * 排结束钟声和背景声淡出；nowA 之前的钟声不再排。重排时淡出也一并重下（同样的淡出再下一次不改变什么）：
   * 淡出已经开始（跳过段落后结束提前时会这样）就从此刻接着淡，仍在原定的时刻淡完
   */
  function scheduleEnding(r: Run, nowA: number): void {
    if (!r.audioOn) {
      r.silentAt = null
      return
    }
    const e = endingOf(r.end, r.plan.silentEnd, r.endBell, r.bells)
    r.silentAt = e.silentAt
    if (e.bell !== null && r.origin + e.bell > nowA) audio.bell('end', r.origin + e.bell)
    const f = e.fade
    if (!f) return
    const at = r.origin + f.at
    if (at >= nowA) audio.fadeBedOut(at, f.dur)
    else audio.fadeBedOut(nowA, Math.max(STOP_BED_FADE_SEC, at + f.dur - nowA))
  }

  /**
   * 撤销会让正在进行的这一段停在当前值、正在响的滑音淡出：补排这一段剩下的部分，节拍提示不断档。
   * 背景声照整段、按这一段本来开始的时刻再排一次：声音端口不再排已经过去的部分，从停住的值沿原来的曲线接着走，
   * 停住的值本来就在这条曲线上，同一段里接连重排几次也不会跳。滑音从此刻接着滑到这一段结束（不超过节拍停下、练习结束的时刻）
   */
  function continuePhase(r: Run, tc: number): void {
    if (!r.pace || r.style === 'off' || !(tc >= 0) || tc >= r.paceEnd - PACED_TAIL_SEC) return
    const p = paceAt(r.pace, tc)
    if (!p.seg) return
    const from = p.seg.dur - p.rem
    const to = Math.min(p.seg.dur, from + r.paceEnd - tc)
    if (to - from < MIN_PARTIAL_SEC) return
    const start = tc - from
    audio.breath(p.seg, r.origin + start)
    if (r.style === 'glide') glideOver(r, p.seg, start, from, to)
  }

  /**
   * 节拍或结束时刻变了：撤下排好的声音，从声音时钟的此刻起按新的安排重排。
   * 已经响起的不受影响；尚未响起的开始钟声、结束钟声和背景声淡出照新的安排补上
   */
  function reschedule(r: Run): void {
    if (!r.audioOn) return
    const nowA = audio.now()
    const tc = nowA - r.origin
    audio.cancelScheduled()
    if (r.startBell && r.origin > nowA) audio.bell('start', r.origin)
    scheduleEnding(r, nowA)
    continuePhase(r, tc)
    r.tracks = audioTracks(r, tc)
    tick(r)
  }

  /* ---------- 声音状态 ---------- */

  function watchAudio(r: Run): void {
    r.audioPending = audio.state() !== 'running'
    timers.clearTimeout(r.watchTimer)
    r.watchTimer = timers.setTimeout(() => {
      r.watchTimer = null
      if (run === r && r.audioOn && isMoving(state.status) && audio.state() !== 'running') degrade(r)
    }, AUDIO_START_GRACE_MS)
  }

  function onAudioState(r: Run): void {
    if (run !== r || !r.audioOn) return
    if (audio.state() === 'running') {
      r.audioPending = false
      // 暂停中被系统恢复的声音要重新挂起，否则排好的钟声会在暂停时响起，时钟也会往前跳
      if (state.status === 'paused') quietly(() => audio.suspend())
      return
    }
    if (!r.audioPending && isMoving(state.status)) pause()
  }

  /** 声音出不来：改用 performance 时钟从当前读数接着走，练习静音继续 */
  function degrade(r: Run): void {
    r.audioOn = false
    r.audioPending = false
    r.silentAt = null
    r.tracks = []
    r.clock.switchToPerf()
    r.unsubAudio?.()
    r.unsubAudio = null
    audio.cancelScheduled()
    audio.stopBed(0)
    commit({ audio: 'blocked', silentEnding: false })
  }

  /* ---------- 开始与结束 ---------- */

  function unlockAudio(): Promise<boolean> {
    return new Promise(resolve => {
      const timer = timers.setTimeout(() => resolve(false), UNLOCK_TIMEOUT_MS)
      const done = (ok: boolean): void => {
        timers.clearTimeout(timer)
        resolve(ok)
      }
      try {
        audio.unlock().then(
          ok => done(ok === true),
          () => done(false),
        )
      } catch {
        done(false)
      }
    })
  }

  function begin(plan: SessionPlan, unlocked: boolean): void {
    const end = plan.plannedSec > 0 ? plan.plannedSec : Number.POSITIVE_INFINITY
    const audioOn = unlocked && timeScale === 1
    const startBell = hasStartBell(plan)
    const lead = leadFor(plan, audioOn)
    const pace = plan.pattern ? paceOf(plan.pattern) : null
    const paceEnd = paceEndOf({ pace, timeline: plan.timeline, end })
    let clock: SessionClock
    // 背景声在倒数开始时响起，练习第 0 秒在它之后 lead 秒；不出声时都用不上
    let bedAt = 0
    let origin = 0
    if (audioOn) {
      bedAt = audio.now() + START_DELAY_SEC
      origin = bedAt + lead
      clock = createAudioClock(
        { now: () => audio.now(), running: () => audio.state() === 'running' },
        origin,
        perfNow,
      )
    } else {
      clock = createPerfClock({ perfNow, start: -lead, timeScale })
    }
    const r: Run = {
      plan,
      end,
      clock,
      origin,
      audioOn,
      audioPending: false,
      style: plan.cueStyle ?? 'glide',
      startBell,
      endBell: plan.endBell ?? true,
      bells: plan.bells !== false,
      pace,
      paceEnd,
      timeline: plan.timeline,
      skipped: [],
      silentAt: null,
      resumeTo: 'lead',
      tracks: [],
      cueIdx: 0,
      lastMark: Number.NEGATIVE_INFINITY,
      countFrom: null,
      nextDue: Number.POSITIVE_INFINITY,
      fineTimer: null,
      watchTimer: null,
      unsubAudio: null,
      unsubVisibility: null,
    }
    run = r
    finishedPace = null
    finishedCut = Number.POSITIVE_INFINITY
    // 上一次到点结束时留着结束钟声响完，紧接着又开始的话，它还没敲的几击会落进这一次的倒数和开头：
    // 先撤掉，正在响的那一击照常自然消失。这一次不出声也要撤，声音环境之后恢复时旧钟声还会照排好的时刻响
    if (ringing) {
      ringing = false
      audio.cancelScheduled()
    }
    if (audioOn) {
      const fadeIn = plan.fadeInSec ?? DEFAULT_FADE_IN_SEC
      if (Number.isFinite(end)) audio.startBed(plan.sound, bedAt, fadeIn, lead + end)
      else audio.startBed(plan.sound, bedAt, fadeIn)
      if (startBell) audio.bell('start', origin)
      scheduleEnding(r, Number.NEGATIVE_INFINITY)
      r.tracks = audioTracks(r, Number.NEGATIVE_INFINITY)
    }
    // 没解锁时区分两种情况：设备根本没有声音（off），还是浏览器不让出声（blocked）
    const unavailable = audio.state() === 'unavailable' || audio.state() === 'closed'
    state = {
      ...idleState(),
      status: 'lead',
      plan,
      startedAt: new Date().toISOString(),
      ...(plan.timeline ? { timeline: plan.timeline } : {}),
      count: plan.kind === 'count' ? zeroCount() : null,
      audio: audioOn ? 'on' : unlocked || unavailable ? 'off' : 'blocked',
      rate: pace ? paceCycleAt(pace, 0).rate : null,
      endSec: Number.isFinite(end) ? end : null,
    }
    r.unsubVisibility = platform.onVisibilityChange(() => onVisibility(r))
    if (audioOn) {
      r.unsubAudio = audio.onStateChange(() => onAudioState(r))
      watchAudio(r)
    }
    platform.keepAwake(true)
    // 先让界面看到倒数，再开始推进（没有倒数时第一次推进就会进入 running）；监听者可能已经结束了练习
    notify()
    if (run === r) ticker.start()
  }

  function onVisibility(r: Run): void {
    if (run !== r) return
    // 页面回到前台时屏幕常亮已被系统释放，要重新申请；进入后台时立刻排满长前瞻
    if (!platform.hidden() && isMoving(state.status)) platform.keepAwake(true)
    tick(r)
  }

  function clearTimers(r: Run): void {
    timers.clearTimeout(r.fineTimer)
    timers.clearTimeout(r.watchTimer)
    r.fineTimer = null
    r.watchTimer = null
  }

  function teardown(r: Run): void {
    ticker.stop()
    clearTimers(r)
    r.unsubAudio?.()
    r.unsubVisibility?.()
    r.unsubAudio = null
    r.unsubVisibility = null
  }

  function finish(reason: EndReason): void {
    const r = run
    if (!r || !isActive(state.status)) return
    const wasPaused = state.status === 'paused'
    // 到点结束记满（跳过段落后提前了的）结束时刻；不限时的练习没有「到点」，按实际时长记
    const natural = reason === 'complete' && Number.isFinite(r.end)
    const practiced = natural ? r.end : clamp(r.clock.now(), 0, r.end)
    run = null
    finishedPace = r.pace
    finishedCut = breathCutOf(r)
    teardown(r)
    platform.keepAwake(false)
    voice.cancel()
    if (r.audioOn) {
      // 到点结束：结束钟声照常响完，不撤；下一次开始前（begin）才撤掉还没敲的
      if (natural) {
        audio.stopBed(COMPLETE_BED_FADE_SEC)
        ringing = true
      } else {
        audio.cancelScheduled()
        // 暂停时声音已挂起（挂起前已淡出），淡出要等下次恢复才走完，会在下一次练习开头漏出一点旧的背景声
        audio.stopBed(wasPaused ? 0 : STOP_BED_FADE_SEC)
      }
    }
    const pace = r.pace
    const result: SessionResult = {
      plan: r.plan,
      startedAt: state.startedAt ?? new Date().toISOString(),
      practicedSec: practiced,
      completed: reason === 'complete',
      marks: [...state.marks],
      count: state.count ? { ...state.count } : null,
      breaths: pace ? paceBreaths(pace, Math.min(practiced, r.paceEnd)) : null,
      finalRate: pace ? paceTarget(pace, practiced) : null,
      rateSteps: pace ? paceSteps(pace, practiced) : 0,
      skipped: [...r.skipped],
    }
    commit({ status: 'done', endReason: reason, practicedSec: practiced, caption: null, section: null })
    for (const l of [...finishListeners]) callSafely(() => l(result))
  }

  /* ---------- 公共接口 ---------- */

  function pause(): void {
    const r = run
    if (!r || !isMoving(state.status)) return
    r.resumeTo = state.status === 'lead' ? 'lead' : 'running'
    r.clock.pause()
    clearTimers(r)
    // 先改状态再挂起声音：端口可能同步回报状态变化，那时不能再被当成中断
    commit({ status: 'paused' })
    if (r.audioOn) quietly(() => audio.suspend())
    voice.cancel()
    // 暂停可能很久，不必一直亮着屏幕
    platform.keepAwake(false)
  }

  function resume(): void {
    const r = run
    if (!r || state.status !== 'paused') return
    r.clock.resume()
    commit({ status: r.resumeTo })
    // 监听者可能在通知里又暂停或结束了练习
    if (run !== r || !isMoving(state.status)) return
    if (r.audioOn) {
      // 先记下「还没走起来」再恢复：恢复过程中端口同步回报的状态变化不能被当成中断
      watchAudio(r)
      quietly(() => audio.resume())
    }
    platform.keepAwake(true)
    tick(r)
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    time() {
      const r = run
      if (!r) return state.status === 'done' ? state.practicedSec : 0
      const t = r.clock.now()
      // 逐帧调用时顺手检查：到点的事交给微任务处理，这里不改状态、不分配内存
      if (t >= r.nextDue && !dueQueued && isMoving(state.status)) {
        dueQueued = true
        queueMicrotask(flushDue)
      }
      return Math.min(t, r.end)
    },

    breathAt(t) {
      const r = run
      const pace = r ? r.pace : finishedPace
      if (!pace) return null
      return t >= (r ? breathCutOf(r) : finishedCut) ? null : paceAt(pace, t)
    },

    async start(plan) {
      if (pending?.cancelled === false || isActive(state.status)) return
      checkPlan(plan)
      const attempt = { cancelled: false }
      pending = attempt
      let unlocked = false
      try {
        unlocked = await unlockAudio()
      } finally {
        if (pending === attempt) pending = null
      }
      if (attempt.cancelled || isActive(state.status)) return
      begin(plan, unlocked)
    },

    pause,
    resume,

    async retryAudio() {
      const r = run
      if (!r || !isActive(state.status) || timeScale !== 1) return false
      if (r.audioOn) return true
      if (!(await unlockAudio()) || run !== r || !isActive(state.status)) return false
      // 从原读数接回声音时钟；回神、数息、段落和待结束的时刻都保持原样。
      const t = r.clock.now()
      const paused = state.status === 'paused'
      const nowA = audio.now()
      r.origin = nowA - t
      r.clock = createAudioClock(
        { now: () => audio.now(), running: () => audio.state() === 'running' },
        r.origin,
        perfNow,
      )
      if (paused) r.clock.pause()
      r.audioOn = true
      r.unsubAudio = audio.onStateChange(() => onAudioState(r))
      audio.startBed(
        r.plan.sound,
        nowA,
        r.plan.fadeInSec ?? DEFAULT_FADE_IN_SEC,
        Number.isFinite(r.end) ? r.end - t : undefined,
      )
      reschedule(r)
      if (paused) quietly(() => audio.suspend())
      else watchAudio(r)
      commit({ audio: 'on' })
      return true
    },

    end() {
      // 还在等声音解锁时离开播放器：这次练习不再开始
      if (pending) pending.cancelled = true
      const r = run
      if (!r) return
      finish(Number.isFinite(r.end) ? 'stopped' : 'complete')
    },

    mark() {
      const r = run
      if (!r || state.status !== 'running' || r.plan.kind !== 'focus') return
      const t = clamp(r.clock.now(), 0, r.end)
      if (t - r.lastMark < MARK_DEBOUNCE_SEC) return
      r.lastMark = t
      if (r.plan.cues && r.audioOn) audio.cue('mark')
      commit({ marks: [...state.marks, round1(t)] })
    },

    countTap(kind) {
      const r = run
      const c = state.count
      if (!r || state.status !== 'running' || !c) return
      const t = r.clock.now()
      let next: CountState
      if (kind === 'breath') {
        if (c.current === 0) r.countFrom = t
        next = { ...c, current: c.current + 1 }
      } else if (kind === 'ninth') {
        next = closeCount(c, r.countFrom === null ? null : t - r.countFrom)
        r.countFrom = null
      } else if (kind === 'reset') {
        next = { ...c, current: 0, resets: c.resets + 1 }
        r.countFrom = null
      } else return
      if (kind !== 'reset' && r.plan.cues && r.audioOn) audio.cue(kind === 'ninth' ? 'ninth' : 'tap')
      commit({ count: next })
    },

    stepBack() {
      const r = run
      if (!r?.pace || state.status !== 'running' || r.plan.pattern?.type !== 'resonance') return
      const next = stepBackPace(r.pace, r.clock.now())
      // 节拍停下（练习结束）前来不及生效的，不改
      if (!next || next.at >= r.paceEnd) return
      r.pace = next.pace
      // 换速改变了各段的起止，结尾的话开始时正在走的那一段也可能变了
      r.paceEnd = paceEndOf(r)
      if (r.style !== 'off') reschedule(r)
    },

    skipSection() {
      const r = run
      const tl = r?.timeline
      if (!r || !tl || state.status !== 'running') return
      const t = r.clock.now()
      const index = sectionIndexAt(tl, t)
      const cur = tl.sections[index]
      const next = tl.sections[index + 1]
      if (!cur || !next || t >= cur.t1 || cur.skippable !== true || r.skipped.includes(cur.id)) return
      const from = t + SKIP_LEAD_SEC
      const delta = next.t0 - from
      if (!(delta > 0)) return
      r.timeline = skipAhead(tl, index, from, delta, r.cueIdx)
      commit({ timeline: r.timeline })
      r.end -= delta
      r.paceEnd = paceEndOf(r)
      r.skipped.push(cur.id)
      // 正在读的是被跳过的这一段，不再读完
      voice.cancel()
      if (r.audioOn) reschedule(r)
      else progress(r)
    },

    setSound(mix: Partial<SoundMix>) {
      const r = run
      if (!r) return
      r.plan = { ...r.plan, sound: { ...r.plan.sound, ...mix } }
      if (r.audioOn) audio.changeBed(mix)
      commit({ plan: r.plan })
    },

    reset() {
      if (state.status !== 'done') return
      finishedPace = null
      finishedCut = Number.POSITIVE_INFINITY
      state = idleState()
      notify()
    },

    onFinish(listener) {
      finishListeners.add(listener)
      return () => {
        finishListeners.delete(listener)
      }
    },
  }
}
