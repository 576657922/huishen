/**
 * 会话引擎的公共契约。引擎与框架无关：不依赖 React，不直接访问存储。
 * 声音、语音、振动、屏幕常亮都通过下面的端口注入，测试时可以换成假实现。
 * v1 没有语音引导（PRODUCT §0）：引导词是屏幕上的文字，语音端口留给以后的真人录音，应用层交给引擎一个不出声的端口
 */
import type { BellKind, Bus, CueKind, Scheduled, SoundMix } from '@/audio/types'
import type { PacedParams, PracticeId, PracticeKind } from '@/content/types'

/* ---------- 呼吸节拍 ---------- */

/** 吸、再吸（叹息的第二口）、吸满后屏息、呼、呼空后停 */
export type PhaseKey = 'in' | 'in2' | 'hold' | 'out' | 'rest'

/** inout：两端缓、中间快；out：先快后缓；flat：屏息时保持不动 */
export type Easing = 'inout' | 'out' | 'linear' | 'flat'

export interface Segment {
  key: PhaseKey
  /** 秒 */
  dur: number
  /** 肺容量的示意值，0 为呼空，1 为吸满 */
  y0: number
  y1: number
  ease: Easing
  /** 舞台上的大字，如「吸」「再吸」「停」「呼」 */
  label: string
  /** 一句话提示 */
  hint: string
  /** 在一轮里的起始秒数，由 buildPattern 填写 */
  t0: number
}

export interface BreathPattern {
  /** 一轮的秒数 */
  T: number
  /** 每分钟轮数 */
  rate: number
  segs: Segment[]
  /**
   * 开头逐步放慢时依次走过的轮，走完之后才按 segs 循环；没有为缺省。由 withWarmup 填写。
   * patternAt 和会话调度都按它走；第 k 轮（k < warmup.length）的速度是 warmup[k].rate
   */
  warmup?: BreathCycle[]
  /** 由哪种节拍参数生成，由 buildPattern 填写。练习中「有点急」只对 resonance（慢呼吸）生效 */
  type?: PacedParams['type']
}

/** 开头放慢阶段的一轮：各段与目标节拍同比例，只是更短 */
export interface BreathCycle {
  /** 这一轮的秒数 */
  T: number
  /** 这一轮的每分钟次数 */
  rate: number
  segs: Segment[]
}

/** 某一时刻在节拍里的位置 */
export interface PatternPoint {
  y: number
  seg: Segment | null
  /** 段在一轮里的序号；引导前为 -1 */
  idx: number
  /** 这一段还剩几秒 */
  rem: number
  /** 这一段已完成的比例 0–1 */
  progress: number
  /** 第几轮，从 0 开始 */
  cycle: number
}

/* ---------- 引导时间线 ---------- */

export type TimelineCueKind = 'speak' | 'section' | 'chime'

export interface TimelineCue {
  /** 距练习开始（引导倒数之后）的秒数 */
  t: number
  kind: TimelineCueKind
  /** speak：显示为字幕（以后有录音时也朗读）的文字 */
  text?: string
  /** speak：朗读用的文字，只在和字幕不同时才有（避开多音字误读）；字幕仍显示 text */
  say?: string
  /** section：进入的段落 */
  sectionId?: string
  sectionTitle?: string
  /** speak：语速倍数，相对用户设置的语速；只在 prosody 为 settle 时才有（越往后越慢） */
  rate?: number
  /** speak：音量倍数，相对用户设置的音量；只在 prosody 为 settle 时才有（越往后越轻） */
  volume?: number
  /**
   * speak：估算的读（说）完这一句要的秒数，不含句后的停顿。buildTimeline 总会给出；
   * 手写的时间线没有时按字数和默认语速估算（timeline.ts 的 speakSec）
   */
  dur?: number
}

export interface TimelineSection {
  id: string
  title: string
  t0: number
  t1: number
  /** 播放器上可以「跳过这一处」；照抄 ScriptSection.skippable */
  skippable?: boolean
}

export interface Timeline {
  /** 总秒数，等于计划时长 */
  duration: number
  cues: TimelineCue[]
  sections: TimelineSection[]
  /**
   * 结尾的话开始的时刻（第一句结尾的话出现的练习秒数）；没有结尾的话时等于 duration。
   * buildTimeline 总会给出，手写的时间线没有时当作没有结尾的话。
   * 带引导词的呼吸练习从这里起不再开始新的一段节拍（见 SessionController.breathAt）
   */
  closingT?: number
}

/** 引导语的语气：steady 始终如一；settle 越往后越慢、越轻（睡前） */
export type Prosody = 'steady' | 'settle'

/* ---------- 一次练习 ---------- */

/**
 * 跟随节拍的练习怎样提示吸呼（设置里的「节拍提示」）：
 * glide 滑音（默认）：背景声随吸呼起伏，另有一个轻柔的长音随吸气上滑、随呼气下滑；
 * ping 钟点：背景声起伏，每段开头一声提示音；bed 仅背景：只有背景声起伏；
 * off 静音：背景声不跟节拍、也没有提示音，只看画面和振动
 */
export type CueStyle = 'glide' | 'ping' | 'bed' | 'off'

export interface SessionPlan {
  practiceId: PracticeId
  kind: PracticeKind
  /** 显示在播放器顶部的名字 */
  title: string
  /** 计划练习秒数，不含开头倒数；0 为不限时（只用于听声音），一直到 end() */
  plannedSec: number
  /** 开头倒数秒数。有背景声又有开始钟声时至少按 3 秒倒数，让钟声落在背景声响起 3 秒之后 */
  leadSec: number
  /** 跟随节拍的练习才有 */
  pattern: BreathPattern | null
  /** 有引导词的练习才有 */
  timeline: Timeline | null
  /** 静坐计时的间隔钟声（秒）；没有为 null */
  intervalSec: number | null
  sound: SoundMix
  /** 回神、数息、段落切换的提示音。节拍的提示看 cueStyle */
  cues: boolean
  /**
   * 新的一句出现时轻响一声（设置 › 文字引导「新的一句出现时轻提示」）：这一句之前安静了 CAPTION_CUE_GAP_SEC（20）秒以上
   * 才响，段落提示音和开始钟声也算打破安静（见 session.ts 的 captionCueTimes）。听声音不响
   */
  captionCue: boolean
  /** 朗读引导词（听声音不朗读）。v1 没有语音引导，应用层总是 false；留给以后的真人录音 */
  voice: boolean
  /** 节拍振动（只在支持的设备上） */
  haptics: boolean
  /**
   * 结尾静默：有结束钟声时，背景声在最后 60 秒内用 30 秒淡出，留 30 秒安静再响钟（计划 ≥ 3 分钟）；
   * 1–3 分钟的练习在最后 25 秒内用 15 秒淡出
   */
  silentEnd: boolean
  /** 记入记录的参数，如 rate、ratio、cycle */
  params: Record<string, number | string>
  /** 节拍提示，默认 glide；只对跟随节拍的练习有意义 */
  cueStyle?: CueStyle
  /** 结束钟声，默认响。睡前的声音不响钟：背景声在最后 120 秒里慢慢淡出 */
  endBell?: boolean
  /**
   * 开始和结束的钟声（设置 › 声音 › 钟声），默认响。false 时两样都不敲，结尾的安排照旧
   * （静默收尾照样淡出、留出安静，只是不敲钟；endBell 为 false 的睡前练习仍在最后 120 秒里淡出）。
   * 间隔钟声另由 intervalSec 决定；听声音本来就不敲开始钟
   */
  bells?: boolean
  /** 背景声淡入的秒数：放松 8（默认），睡前 20 */
  fadeInSec?: number
  /**
   * 引导语的语气，默认 steady。时间线应按同一个值排（buildTimeline 的 prosody 选项），
   * 会话照每句的倍数朗读；时间线里没有倍数时，settle 只让声音越来越轻，不改语速，免得话音相互重叠
   */
  prosody?: Prosody
}

export type SessionStatus = 'idle' | 'lead' | 'running' | 'paused' | 'done'

export type EndReason = 'complete' | 'stopped'

/**
 * 数息：每口气点一下，第九口点另一个键，数乱了点「重来」。
 * 记录里的准确率 = 1 −（errors + resets）÷（correct + errors + resets）；invalid 的轮次不计入分子和分母
 */
export interface CountState {
  /** 本轮已点的次数（不含第九口） */
  current: number
  /** 完成的轮数（点了第九口的次数）= correct + errors + invalid */
  cycles: number
  /** 第九口点在正确位置（前面恰好 8 次）的轮数 */
  correct: number
  /** 第九口点早了或晚了的轮数 */
  errors: number
  /** 自己点「重来」的次数 */
  resets: number
  /** 点得太快、不可能是真实呼吸的轮数：从这一轮第一下到第九口，平均每次间隔不到 1.5 秒 */
  invalid: number
}

/** 播放器上的一句引导 */
export interface Caption {
  text: string
  /** 所属段落的名字；开场和结尾的话为 null */
  section: string | null
  /** 这一句出现的练习秒数（时间线上的时刻；跳过段落之后按提前了的时刻） */
  t: number
  /** 估算的读完这一句要的秒数，不含句后的停顿 */
  dur: number
}

/** 引导练习当前所在的段落 */
export interface SectionState {
  /** 在 plan.timeline.sections 里的序号 */
  index: number
  id: string
  title: string
  /** 此刻能否「跳过这一处」：段落可跳过，且不是最后一段 */
  skippable: boolean
}

/** 给界面用的粗粒度快照：只在事件发生时变化，逐帧的数值请用 SessionController.time() 和 breathAt() */
export interface SessionState {
  status: SessionStatus
  plan: SessionPlan | null
  /** 当前实际时间线（跳过段落后已提前），供播放器的段落图与读数使用。旧快照可回退 plan.timeline。 */
  timeline?: Timeline | null
  /** ISO 时间 */
  startedAt: string | null
  /** 回神的时刻（练习秒数） */
  marks: number[]
  count: CountState | null
  /**
   * 当前字幕：一句话显示到下一句出现（新的段落开始时收起）。t 为这一句出现的练习秒数，dur 为估算的读完要的秒数，
   * 界面据此在读完之后稍久让字慢慢变淡（PRODUCT §5）
   */
  caption: Caption | null
  /** 当前所在的段（节拍或引导段落）序号，-1 表示还没开始；带引导词的呼吸练习在节拍停下以后也为 -1 */
  phaseIndex: number
  /** 是否已进入结尾的静默段（背景声开始淡出、等待结束钟声） */
  silentEnding: boolean
  endReason: EndReason | null
  /** 结束时实际练习的秒数 */
  practicedSec: number
  /** 声音是否可用；blocked 表示浏览器拒绝播放 */
  audio: 'on' | 'off' | 'blocked'
  /** 跟随节拍的练习：当前这一轮的每分钟次数（开头放慢、「有点急」之后会变）；其他练习为 null */
  rate: number | null
  /** 引导练习当前的段落；开场、结尾和没有段落的练习为 null */
  section: SectionState | null
  /** 练习在第几秒结束：开始时等于计划时长，跳过段落后提前；不限时为 null。倒计时用它减去 time() */
  endSec: number | null
}

/** 练习结束时交给应用层保存的结果 */
export interface SessionResult {
  plan: SessionPlan
  startedAt: string
  /** 实际练习的秒数；跳过段落后正常结束时，比计划时长短 */
  practicedSec: number
  completed: boolean
  marks: number[]
  count: CountState | null
  /** 完成的呼吸轮数，含开头放慢的各轮，到节拍停下为止；不跟节拍的练习为 null */
  breaths: number | null
  /** 跟随节拍的练习最后稳定的每分钟次数（「有点急」之后的速度，应用层据此记住）；其他练习为 null */
  finalRate: number | null
  /** 练习中「有点急」生效的次数 */
  rateSteps: number
  /** 跳过的段落 id，按先后 */
  skipped: string[]
}

export interface SessionController {
  getState(): SessionState
  subscribe(listener: () => void): () => void
  /** 当前练习秒数；倒数期间为负数，暂停时停住。供逐帧绘制使用 */
  time(): number
  /**
   * 跟随节拍的练习在练习第 t 秒的位置，已算上开头放慢和「有点急」（包括已排好、还没生效的）。
   * 逐帧画呼吸曲线用：过去的部分画实线，将来的部分画虚线。不跟节拍的练习返回 null。
   * 带引导词的呼吸练习在结尾的话开始以后不再开始新的一段（Timeline.closingT），正在走的这一段走完，节拍就停下：
   * 从停下的那一刻起返回 null（曲线、「吸 / 呼」大字、本段剩余秒数都到此为止）
   */
  breathAt(t: number): PatternPoint | null
  /** 必须在用户手势里调用，以便解锁声音 */
  start(plan: SessionPlan): Promise<void>
  pause(): void
  resume(): void
  /** 提前结束 */
  end(): void
  /** 专注：记一次回神 */
  mark(): void
  /** 数息：breath 为第 1–8 口，ninth 为第 9 口，reset 为数乱了重来 */
  countTap(kind: 'breath' | 'ninth' | 'reset'): void
  /**
   * 慢呼吸「有点急」：从下一轮起（至少 0.3 秒之后）每分钟多 0.5 次（不超过 7 次），开头剩下的放慢不再走，
   * 新的速度保持到练习结束。开头放慢还快过 7 次时，节拍放慢到 7 次就停在那里（pace.ts 的 stepBack）。
   * 只在进行中、节拍为 resonance、节拍停下之前生效
   */
  stepBack(): void
  /** 引导练习「跳过这一处」：下一段马上开始，整个练习相应提前结束。只在当前段落可跳过时生效 */
  skipSection(): void
  /** 练习中换声音或音量 */
  setSound(mix: Partial<SoundMix>): void
  /** 浏览器拦下声音后，在新的用户手势中恢复声音；不重开练习、不丢进度。旧适配器可不提供。 */
  retryAudio?(): Promise<boolean>
  /** 结束后回到 idle */
  reset(): void
  /** 练习完成或提前结束时调用；返回取消订阅 */
  onFinish(listener: (result: SessionResult) => void): () => void
}

/* ---------- 端口：由声音层、语音（以后的真人录音）、平台能力实现 ---------- */

export interface AudioPort {
  /** 创建或恢复 AudioContext；必须在用户手势里调用。返回能否出声 */
  unlock(): Promise<boolean>
  /** 声音时钟（秒）；不可用时返回 performance.now()/1000 */
  now(): number
  /** running 才算真正在播放 */
  state(): 'running' | 'suspended' | 'closed' | 'interrupted' | 'unavailable'
  onStateChange(listener: () => void): () => void
  /**
   * 从 at 开始播放背景声，fadeIn 秒淡入。
   * plannedSec 为从 at 到练习结束的秒数（含开头倒数），供音乐安排中间的休止；不限时不传
   */
  startBed(mix: SoundMix, at: number, fadeIn: number, plannedSec?: number): void
  /** 练习中平滑切换背景声 */
  changeBed(mix: Partial<SoundMix>): void
  setVolume(bus: Bus, volume: number): void
  /**
   * 跟随节拍的练习：让背景声随这一段吸或呼起伏，t 时刻的位置为 y0 + (y1 − y0) · ease((t − at) / dur)。
   * at 可以早于此刻（cancelScheduled 之后接着走正在进行的那一段）：已经过去的部分不再排，从当前值接上此后的起伏
   */
  breath(seg: Segment, at: number): void
  /**
   * 节拍提示「滑音」：从 at 起、长 seg.dur 秒的一个轻柔长音，音高随 seg.y0 → seg.y1 在五度以内滑动
   * （吸气上滑、呼气下滑，屏息段音高不动），位置的算法与 breath 相同，两端柔和起止。
   * 前一段结束的时刻正好是后一段的 at 时，两段连成一个音、转折处不断开（会话把半截的一段拆成几小段时靠这一点）
   */
  glide(seg: Segment, at: number): Scheduled
  /** 不跟节拍的练习：让背景声按自己的慢周期起伏，直到 until */
  freeRun(until: number): void
  cue(kind: CueKind, at?: number): Scheduled
  bell(kind: BellKind, at: number): Scheduled
  /** 从 at 开始用 dur 秒把背景声淡出到静默。再次调用时取代上一次（包括已经开始的那次），从当时的音量接着走 */
  fadeBedOut(at: number, dur: number): void
  /** 停止背景声；fade 为淡出秒数 */
  stopBed(fade: number): void
  /**
   * 撤销所有尚未响起的提示音和钟声，以及 breath、glide 排在此刻之后的部分：
   * 背景声的起伏停在当前值、不跳回，正在响的滑音停在当前音高并淡出。
   * 之后再排的 breath、glide 从当前值接着走；fadeBedOut 排下的淡出不受影响
   */
  cancelScheduled(): void
  suspend(): Promise<void>
  resume(): Promise<void>
}

/** 一句话的朗读方式，都是相对用户设置的倍数 */
export interface SpeakOptions {
  /** 语速倍数，默认 1 */
  rate?: number
  /** 音量倍数，默认 1 */
  volume?: number
}

/**
 * 朗读引导词。v1 没有语音引导（PRODUCT §0）：应用层交给引擎 NULL_VOICE（session.ts），
 * 留着这个端口给以后的真人录音
 */
export interface VoicePort {
  available(): boolean
  speak(text: string, opts?: SpeakOptions): void
  cancel(): void
}

export interface PlatformPort {
  /** 屏幕常亮 */
  keepAwake(on: boolean): void
  /** 振动；不支持时什么也不做 */
  vibrate(pattern: number | number[]): void
  /** 页面是否在后台 */
  hidden(): boolean
  onVisibilityChange(listener: () => void): () => void
}
