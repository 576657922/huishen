/**
 * 假的声音端口：不出声，只记录每一次调用，并模拟 AudioContext 的时钟和状态。
 *
 * 声音时钟由毫秒时钟推动（默认 performance.now()，受 vi.useFakeTimers() 控制），
 * 状态为 running 时才走，挂起时停住——和真的 AudioContext 一样。
 * 所以测试里只要推进假计时器，声音时钟、定时器、performance 时钟就一起往前走。
 *
 * 除了调用日志，还按 AudioPort 的契约模拟排进时间线的东西：提示音、钟声、滑音（FakeSound），
 * 背景声的节拍起伏（FakeBreath），以及背景声的淡出（fade，后一次取代前一次）。
 * cancelScheduled() 撤销尚未开始的，并把正在进行的起伏和滑音停在此刻。
 * breath() 的 at 早于此刻时，和真实的声音层一样只从此刻起跟这一段，已经过去的部分不算。
 *
 * @example
 * vi.useFakeTimers()
 * const audio = new FakeAudioPort()
 * await audio.unlock()            // 进入 running
 * vi.advanceTimersByTime(1500)    // 声音时钟前进 1.5 秒
 * audio.setState('interrupted')   // 模拟来电打断
 * audio.bells('end')              // 排过的结束钟声
 * audio.breathCover()             // 背景声实际跟随的各段（已去掉撤销的部分）
 * audio.glideCover()              // 滑音实际跟随的各段
 * spanY(span, t)                  // 某一段在 t 时刻的位置，与真实声音层的算法相同
 */
import type { BellKind, Bus, CueKind, Scheduled, SoundMix } from '@/audio/types'
import { ease } from '@/engine/patterns'
import type { AudioPort, Segment } from '@/engine/types'

export type FakeAudioState = ReturnType<AudioPort['state']>

/** 假声音时钟默认的起点（秒）。故意不为 0，便于发现把声音时间当练习时间用的错误 */
export const FAKE_AUDIO_START = 100

/** 会被记入调用日志的方法（读时钟和状态的不记） */
export type AudioMethod = Exclude<keyof AudioPort, 'now' | 'state' | 'onStateChange'>

export interface AudioCall {
  method: AudioMethod
  args: unknown[]
  /** 调用时的声音时钟（秒） */
  time: number
}

export interface FakeAudioOptions {
  /** unlock() 的结果，默认 true */
  unlockResult?: boolean
  /** unlock() 等多少毫秒才返回（经 setTimeout，受假计时器控制）；Infinity 表示永不返回。默认 0 */
  unlockDelayMs?: number
  /** unlock 成功后进入的状态，默认 'running'；'suspended' 模拟「说能出声，其实被浏览器拦下」 */
  stateAfterUnlock?: FakeAudioState
  /** 初始状态，默认 'suspended'（AudioContext 刚创建时就是这样）；没有 Web Audio 时用 'unavailable' */
  initialState?: FakeAudioState
  /** resume() 能否让声音走起来，默认能 */
  resumeWorks?: boolean
  /** 声音时钟的起点（秒），默认 FAKE_AUDIO_START */
  startTime?: number
  /** currentTime 的更新粒度（秒），默认 0 表示连续变化；用来模拟浏览器按缓冲块更新 */
  quantum?: number
  /** 毫秒时钟，默认 () => performance.now() */
  perfNow?: () => number
}

/** 一次排进时间线的提示音、钟声或滑音 */
export class FakeSound implements Scheduled {
  readonly type: 'cue' | 'bell' | 'glide'
  /** 提示音、钟声的种类；滑音为它那一段的 key */
  readonly kind: CueKind | BellKind
  /** 声音时钟上的时刻（秒） */
  readonly at: number
  /** 滑音所跟的那一段 */
  readonly seg: Segment | null
  /** 还没响就被撤销 */
  cancelled = false
  /** 滑音响到一半被 cancelScheduled 停下的时刻；没有为 null */
  stoppedAt: number | null = null

  constructor(
    type: 'cue' | 'bell' | 'glide',
    kind: CueKind | BellKind,
    at: number,
    seg: Segment | null = null,
  ) {
    this.type = type
    this.kind = kind
    this.at = at
    this.seg = seg
  }

  cancel(): void {
    this.cancelled = true
  }
}

/** 一次 breath()：背景声从 at 起随这一段起伏 */
export class FakeBreath {
  readonly seg: Segment
  /** 这一段开始的时刻：起伏从这一刻算起 */
  readonly at: number
  /** 背景声从这一刻起才跟这一段：at 早于调用的时刻时（接着走正在进行的那一段），已经过去的部分不再排 */
  readonly from: number
  /** 还没开始就被撤销 */
  cancelled = false
  /** 进行到一半被撤销、停在当前值的时刻；没有为 null */
  heldAt: number | null = null

  constructor(seg: Segment, at: number, from: number = at) {
    this.seg = seg
    this.at = at
    this.from = Math.max(at, from)
  }

  /** 实际起作用到的时刻 */
  get end(): number {
    return this.heldAt ?? this.at + this.seg.dur
  }
}

/** 背景声或滑音实际跟随的一段：from 到 to（声音时钟），按从 at 开始的 seg 起伏 */
export interface BreathSpan {
  seg: Segment
  /** 这一段开始的时刻；from 可能晚于它（接着走正在进行的那一段时） */
  at: number
  from: number
  to: number
}

/** 声音端口按这一段在 t 时刻应有的位置（与声音层的 breathY 相同）：y0 + (y1 − y0) · ease((t − at) / dur) */
export function spanY(span: Pick<BreathSpan, 'seg' | 'at'>, t: number): number {
  const { seg } = span
  const q = seg.dur > 0 ? Math.min(1, Math.max(0, (t - span.at) / seg.dur)) : 1
  return seg.y0 + (seg.y1 - seg.y0) * ease(seg.ease, q)
}

export class FakeAudioPort implements AudioPort {
  /** 按顺序记录的调用 */
  readonly calls: AudioCall[] = []
  /** 排过的提示音、钟声和滑音（包括已撤销的） */
  readonly sounds: FakeSound[] = []
  /** 排过的背景声起伏（包括已撤销的） */
  readonly breathLog: FakeBreath[] = []
  /** 正在播放的背景声；没有为 null */
  bed: SoundMix | null = null
  /** 当前排着的背景声淡出（后一次 fadeBedOut 取代前一次）；没有为 null */
  fade: { at: number; dur: number } | null = null
  readonly volumes: Partial<Record<Bus, number>> = {}

  private current: FakeAudioState
  /** 进入当前这段 running 之前累计的声音时间 */
  private base: number
  /** 当前这段 running 开始时的毫秒时钟；不在 running 时为 null */
  private runningSince: number | null = null
  private readonly listeners = new Set<() => void>()
  private readonly unlockResult: boolean
  private readonly unlockDelayMs: number
  private readonly stateAfterUnlock: FakeAudioState
  private readonly resumeWorks: boolean
  private readonly quantum: number
  private readonly perfNow: () => number

  constructor(options: FakeAudioOptions = {}) {
    this.unlockResult = options.unlockResult ?? true
    this.unlockDelayMs = options.unlockDelayMs ?? 0
    this.stateAfterUnlock = options.stateAfterUnlock ?? 'running'
    this.resumeWorks = options.resumeWorks ?? true
    this.quantum = options.quantum ?? 0
    this.perfNow = options.perfNow ?? (() => performance.now())
    this.base = options.startTime ?? FAKE_AUDIO_START
    this.current = options.initialState ?? 'suspended'
    if (this.current === 'running') this.runningSince = this.perfNow()
  }

  /* ---------- AudioPort ---------- */

  unlock(): Promise<boolean> {
    this.log('unlock', [])
    const settle = (): boolean => {
      if (this.unlockResult) this.setState(this.stateAfterUnlock)
      return this.unlockResult
    }
    if (this.unlockDelayMs === 0) return Promise.resolve(settle())
    if (!Number.isFinite(this.unlockDelayMs)) return new Promise(() => undefined)
    return new Promise(resolve => setTimeout(() => resolve(settle()), this.unlockDelayMs))
  }

  now(): number {
    if (this.current === 'unavailable') return this.perfNow() / 1000
    const t = this.rawNow()
    return this.quantum > 0 ? Math.floor(t / this.quantum) * this.quantum : t
  }

  state(): FakeAudioState {
    return this.current
  }

  onStateChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  startBed(mix: SoundMix, at: number, fadeIn: number, plannedSec?: number): void {
    this.log('startBed', plannedSec === undefined ? [mix, at, fadeIn] : [mix, at, fadeIn, plannedSec])
    this.bed = { ...mix }
    this.fade = null
  }

  changeBed(mix: Partial<SoundMix>): void {
    this.log('changeBed', [mix])
    if (this.bed) this.bed = { ...this.bed, ...mix }
  }

  setVolume(bus: Bus, volume: number): void {
    this.log('setVolume', [bus, volume])
    this.volumes[bus] = volume
  }

  breath(seg: Segment, at: number): void {
    this.log('breath', [seg, at])
    this.breathLog.push(new FakeBreath(seg, at, this.now()))
  }

  glide(seg: Segment, at: number): Scheduled {
    this.log('glide', [seg, at])
    return this.schedule(new FakeSound('glide', seg.key, at, seg))
  }

  freeRun(until: number): void {
    this.log('freeRun', [until])
  }

  cue(kind: CueKind, at?: number): Scheduled {
    this.log('cue', at === undefined ? [kind] : [kind, at])
    return this.schedule(new FakeSound('cue', kind, at ?? this.now()))
  }

  bell(kind: BellKind, at: number): Scheduled {
    this.log('bell', [kind, at])
    return this.schedule(new FakeSound('bell', kind, at))
  }

  fadeBedOut(at: number, dur: number): void {
    this.log('fadeBedOut', [at, dur])
    this.fade = { at, dur }
  }

  stopBed(fade: number): void {
    this.log('stopBed', [fade])
    this.bed = null
  }

  cancelScheduled(): void {
    this.log('cancelScheduled', [])
    const now = this.now()
    for (const s of this.sounds) {
      if (s.cancelled || s.stoppedAt !== null) continue
      if (s.at > now) s.cancel()
      else if (s.type === 'glide' && s.seg && s.at + s.seg.dur > now) s.stoppedAt = now
    }
    for (const b of this.breathLog) {
      if (b.cancelled || b.heldAt !== null) continue
      if (b.at > now) b.cancelled = true
      else if (b.at + b.seg.dur > now) b.heldAt = now
    }
  }

  suspend(): Promise<void> {
    this.log('suspend', [])
    if (this.current === 'running' || this.current === 'interrupted') this.setState('suspended')
    return Promise.resolve()
  }

  resume(): Promise<void> {
    this.log('resume', [])
    if (this.resumeWorks && this.current !== 'closed' && this.current !== 'unavailable')
      this.setState('running')
    return Promise.resolve()
  }

  /* ---------- 测试用的控制与查询 ---------- */

  /** 改变状态并通知监听者，用来模拟来电打断、系统恢复等 */
  setState(next: FakeAudioState): void {
    if (next === this.current) return
    if (this.runningSince !== null) {
      this.base = this.rawNow()
      this.runningSince = null
    }
    this.current = next
    if (next === 'running') this.runningSince = this.perfNow()
    for (const l of [...this.listeners]) l()
  }

  /** 某个方法的全部调用 */
  callsTo(method: AudioMethod): AudioCall[] {
    return this.calls.filter(c => c.method === method)
  }

  /** 排过的钟声；不传 kind 时返回全部 */
  bells(kind?: BellKind): FakeSound[] {
    return this.sounds.filter(s => s.type === 'bell' && (kind === undefined || s.kind === kind))
  }

  /** 排过的提示音；不传 kind 时返回全部 */
  cues(kind?: CueKind): FakeSound[] {
    return this.sounds.filter(s => s.type === 'cue' && (kind === undefined || s.kind === kind))
  }

  /** 排过的滑音（包括已撤销的） */
  glides(): FakeSound[] {
    return this.sounds.filter(s => s.type === 'glide')
  }

  /** 尚未响起、也没被撤销的声音 */
  pending(): FakeSound[] {
    const now = this.now()
    return this.sounds.filter(s => !s.cancelled && s.at > now)
  }

  /** 背景声实际跟随的各段，按开始跟随的时刻排好：去掉了撤销的，停在半路的截到停下的时刻 */
  breathCover(): BreathSpan[] {
    return this.breathLog
      .filter(b => !b.cancelled && b.end > b.from)
      .map(b => ({ seg: b.seg, at: b.at, from: b.from, to: b.end }))
      .sort((a, b) => a.from - b.from)
  }

  /** 滑音实际跟随的各段，按开始时刻排好：去掉了撤销的，响到一半被停下的截到停下的时刻 */
  glideCover(): BreathSpan[] {
    const spans: BreathSpan[] = []
    for (const g of this.glides()) {
      if (g.cancelled || !g.seg) continue
      const to = g.stoppedAt ?? g.at + g.seg.dur
      if (to > g.at) spans.push({ seg: g.seg, at: g.at, from: g.at, to })
    }
    return spans.sort((a, b) => a.from - b.from)
  }

  /** 当前的状态监听者数量，用来检查是否漏了取消订阅 */
  listenerCount(): number {
    return this.listeners.size
  }

  /** 清空调用日志和排过的声音，状态、时钟和背景声不变 */
  clearLog(): void {
    this.calls.length = 0
    this.sounds.length = 0
    this.breathLog.length = 0
  }

  private rawNow(): number {
    return this.runningSince === null ? this.base : this.base + (this.perfNow() - this.runningSince) / 1000
  }

  private log(method: AudioMethod, args: unknown[]): void {
    this.calls.push({ method, args, time: this.now() })
  }

  private schedule(sound: FakeSound): FakeSound {
    this.sounds.push(sound)
    return sound
  }
}
