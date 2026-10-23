/**
 * 声音引擎：AudioPort 的浏览器实现，外加试听、预热和人声压低（留给以后的真人录音；v1 没有语音引导）。
 *
 * 一次练习的背景声是一组（bed.ts）：一层声景 + 一层音乐；试听是同样结构的另一组，二者不同时存在：
 * 开始练习会停掉试听，练习中不试听。提示音、钟声、滑音走提示音母线。
 * 所有声音都提前排进音频时间线：生成式音乐和慢速起伏每秒前瞻 10 秒（页面在后台时 75 秒）。
 * 暂停先用 1.5 秒淡出再挂起音频环境，继续时淡入，从不硬切；空闲一段时间后挂起音频环境省电。
 * 系统先停了音频环境（iOS 锁屏、来电）时没法淡出：趁时钟停着把输出直接放到 0，回来时同样淡入。
 */
import type { Segment } from '@/engine/types'
import { type Bed, type BedSetup, createBed } from './bed'
import { type BufferStore, createBufferStore } from './buffers'
import { type AssetName, CUE_ASSETS } from './dsp/assets'
import { createGlides, type Glides } from './glide'
import { quietly } from './graph'
import { layerAssets, layerKey } from './layers'
import { bellStrikes, cueGain, glideAmp } from './levels'
import { createMixer, type Mixer } from './mixer'
import { createOneShots, type OneShots } from './oneshots'
import { DEFAULT_VOLUMES, FADES, TIMING } from './params'
import type { AudioEngine, BellKind, Bus, CueKind, Scheduled, SoundMix, SoundMode } from './types'
import { loadLimiter as defaultLoadLimiter } from './worklet/load'

type EngineState = ReturnType<AudioEngine['state']>

const NOOP: Scheduled = { cancel() {} }

/** 只用到的那部分 document，便于测试注入 */
export interface VisibilityLike {
  readonly hidden: boolean
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

export interface AudioEngineOptions {
  /** 创建音频环境；返回 null 表示设备没有 Web Audio。默认用浏览器的 AudioContext */
  createContext?: () => AudioContext | null
  /** 素材仓库；默认新建一个，引擎销毁时一起销毁 */
  store?: BufferStore
  /** 随机数；默认 Math.random */
  rng?: () => number
  /** 页面前后台；默认 document */
  visibility?: VisibilityLike | null
  /** 载入真峰值限幅器的 Worklet 模块；默认 worklet/load.ts。返回 false 时一直用后备的压缩器 */
  loadLimiter?: (ctx: BaseAudioContext) => Promise<boolean>
}

function defaultContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { webkitAudioContext?: typeof AudioContext }
  const AC = window.AudioContext ?? w.webkitAudioContext
  if (!AC) return null
  // playback 延迟模式缓冲更大、更省电；提示音都提前排程，不需要低延迟
  try {
    return new AC({ latencyHint: 'playback' })
  } catch {
    try {
      return new AC()
    } catch {
      return null
    }
  }
}

function supported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as Window & { webkitAudioContext?: unknown }
  return typeof window.AudioContext === 'function' || typeof w.webkitAudioContext === 'function'
}

/** 有的浏览器在没有输出设备、或被系统打断时，resume/suspend 的承诺永远不兑现 */
function settleWithin(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms)
    const done = (): void => {
      clearTimeout(timer)
      resolve()
    }
    p.then(done, done)
  })
}

/** 调用可能同步抛错、也可能返回被拒的承诺（比如环境已关闭）：一律当作已处理 */
function attempt(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    return fn()
  } catch (err) {
    return Promise.reject(err)
  }
}

/** iOS：让声音不受静音键影响，锁屏时也按媒体播放处理 */
function preferPlayback(): void {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'
  } catch {
    // 不支持
  }
}

export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const makeContext = options.createContext ?? defaultContext
  const loadLimiter = options.loadLimiter ?? defaultLoadLimiter
  const ownStore = !options.store
  const store = options.store ?? createBufferStore()
  const rng = options.rng ?? Math.random
  const visibility =
    options.visibility === undefined
      ? typeof document === 'undefined'
        ? null
        : document
      : options.visibility

  let ctx: AudioContext | null = null
  let mixer: Mixer | null = null
  let shots: OneShots | null = null
  let glides: Glides | null = null
  let disposed = false
  let unavailable = false
  const volumes: Record<Bus, number> = { ...DEFAULT_VOLUMES }
  let ducked = false

  let bed: Bed | null = null
  let preview: Bed | null = null
  let previewTimer: ReturnType<typeof setTimeout> | null = null
  let ticker: ReturnType<typeof setInterval> | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  /** 是引擎自己因为空闲挂起的（不是练习暂停） */
  let idleSuspended = false
  /** 暂停：输出已经（或正在）淡到 0 */
  let paused = false
  /** 暂停的淡出走完后才真正挂起；淡出期间继续，就不挂起了 */
  let suspendTimer: ReturnType<typeof setTimeout> | null = null
  let suspendDone: (() => void) | null = null
  const deferred = new Set<{ cancelled: boolean; inner: Scheduled | null }>()
  /** 音频环境上一次报告的状态：用来认出「正在播放时被系统停掉」 */
  let lastState: string | null = null
  /** 输出是因为系统停掉音频环境才放到 0 的（不是暂停）：音频环境回来、又没在暂停时，由引擎自己淡入 */
  let osStopped = false

  const stateListeners = new Set<() => void>()
  const previewListeners = new Set<() => void>()

  function emit(listeners: Set<() => void>): void {
    for (const l of [...listeners]) {
      try {
        l()
      } catch (err) {
        queueMicrotask(() => {
          throw err
        })
      }
    }
  }

  /* ---------- 音频环境 ---------- */

  const running = (): boolean => ctx?.state === 'running'

  /**
   * 系统在播放中停掉音频环境（锁屏、来电、别的应用占用音频）：此刻时钟已停、什么都不在播，输出直接放到 0 听不出来。
   * 不放的话，音频环境回来时声音以停下那一刻的电平一下子回来：会话没暂停时（比如结束钟声还在响）是原电平，
   * 暂停的 1.5 秒淡出走到一半被打断时是半路的电平。空闲挂起是我们自己做的，那时本来就没有声音，不动
   */
  function onContextState(): void {
    const c = ctx
    const m = mixer
    if (c && m) {
      const s = c.state as string
      const was = lastState
      lastState = s
      if (s !== 'running' && was === 'running' && !idleSuspended) {
        m.transportNow(0)
        // 暂停中的由 resume() 淡入；没暂停的等音频环境回来时由引擎自己淡入
        if (!paused) osStopped = true
      } else if (s === 'running' && osStopped) {
        osStopped = false
        // 暂停中被系统恢复：留在 0，继续时由 resume() 淡入（会话也会马上重新挂起）
        if (!paused) m.transport(1, { bed: FADES.pause, cues: FADES.resumeCues })
      }
    }
    emit(stateListeners)
  }

  /** 系统关掉了音频环境（极少见）：丢掉旧的混音台和所有声音，下次解锁时重建 */
  function dropGraph(): void {
    for (const g of [bed, preview]) g?.teardown()
    bed = null
    preview = null
    glides?.dispose()
    shots?.dispose()
    mixer?.dispose()
    ctx?.removeEventListener('statechange', onContextState)
    glides = null
    shots = null
    mixer = null
    ctx = null
  }

  function ensureContext(): AudioContext | null {
    if (disposed) return null
    if (ctx && (ctx.state as string) !== 'closed') return ctx
    if (ctx) dropGraph()
    let c: AudioContext | null = null
    try {
      c = makeContext()
    } catch {
      c = null
    }
    if (!c) {
      unavailable = true
      return null
    }
    ctx = c
    mixer = createMixer(c, { volumes, smooth: FADES.volume })
    if (ducked) mixer.setDuck(true)
    shots = createOneShots(c, mixer.buses.cues, armIdle)
    glides = createGlides(c, mixer.buses.cues, glideAmp)
    lastState = c.state
    osStopped = false
    c.addEventListener('statechange', onContextState)
    emit(stateListeners)
    return c
  }

  /** 换上真峰值限幅器；没载入成功就一直用后备的压缩器 */
  function attachLimiter(c: AudioContext): Promise<void> {
    return loadLimiter(c).then(
      ok => {
        if (ok && ctx === c && mixer) mixer.switchToWorklet()
      },
      () => undefined,
    )
  }

  /** 旧版 iOS 要在手势里真正播放一点声音才解锁：放一个采样的静音 */
  function kick(c: AudioContext): void {
    try {
      const src = c.createBufferSource()
      src.buffer = c.createBuffer(1, 1, c.sampleRate)
      src.connect(c.destination)
      src.onended = () => quietly(() => src.disconnect())
      src.start()
    } catch {
      // 不影响后续
    }
  }

  function resumeContext(c: AudioContext): Promise<void> {
    return running()
      ? Promise.resolve()
      : settleWithin(
          attempt(() => c.resume()),
          TIMING.unlockTimeoutMs,
        )
  }

  /* ---------- 暂停的淡出与挂起 ---------- */

  function cancelPendingSuspend(): void {
    if (suspendTimer) clearTimeout(suspendTimer)
    suspendTimer = null
    const done = suspendDone
    suspendDone = null
    done?.()
  }

  /**
   * 暂停之后开始新的声音（新练习、试听）：暂停前还在响的钟声、滑音不能接着响，先拆掉，
   * 输出再迅速回到原来的电平（此时音频环境还停着，或背景声还没淡入，听不见这一步）
   */
  function clearPause(): void {
    cancelPendingSuspend()
    if (!paused) return
    paused = false
    glides?.dispose()
    shots?.dispose()
    mixer?.transport(1, { bed: FADES.minStop, cues: FADES.minStop })
  }

  /**
   * 新的一组背景声（练习、试听）开始前：之前排下、还没响的单次音撤掉，正在响的那一击照常自然消失。
   * 到点结束时结束钟声留着响完（三击在 0、7、14 秒），紧接着开始下一次或试听的话，
   * 后两击会落进新的倒数、和新的开始钟声撞在一起；会话那边也会撤，这里在引擎一侧兜底，试听也算在内
   */
  function dropLeftovers(): void {
    shots?.cancelPending()
    for (const d of [...deferred]) {
      d.cancelled = true
      deferred.delete(d)
    }
  }

  /* ---------- 空闲挂起 ---------- */

  function clearIdle(): void {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = null
  }

  /** 空闲挂起之后又要出声（只在练习之外，比如设置页试听提示音）：先恢复 */
  function wake(): void {
    clearIdle()
    if (!idleSuspended || !ctx) return
    idleSuspended = false
    void resumeContext(ctx)
  }

  /** 没有背景声、提示音也都响完之后，再等一会儿挂起音频环境，免得一直占着音频硬件耗电 */
  function armIdle(): void {
    clearIdle()
    const c = ctx
    if (!c || bed || preview || disposed || paused || !shots) return
    const busy = Math.max(shots.busyUntil(), glides?.busyUntil() ?? 0)
    const wait = Math.max(0, busy - c.currentTime) + TIMING.idleSuspendSec
    idleTimer = setTimeout(() => {
      idleTimer = null
      if (ctx !== c || bed || preview || paused || !shots || !running()) return
      if (Math.max(shots.busyUntil(), glides?.busyUntil() ?? 0) > c.currentTime || deferred.size) {
        armIdle()
        return
      }
      idleSuspended = true
      void settleWithin(
        attempt(() => c.suspend()),
        TIMING.unlockTimeoutMs,
      )
    }, wait * 1000)
  }

  /* ---------- 前瞻排程 ---------- */

  const horizon = (): number => (visibility?.hidden ? TIMING.hiddenHorizon : TIMING.horizon)

  function tick(): void {
    const c = ctx
    if (!c || (!bed && !preview)) {
      stopTicker()
      return
    }
    const until = c.currentTime + horizon()
    bed?.schedule(until)
    preview?.schedule(until)
  }

  function startTicker(): void {
    if (!ticker) ticker = setInterval(tick, TIMING.tickMs)
  }

  function stopTicker(): void {
    if (ticker) clearInterval(ticker)
    ticker = null
  }

  const onVisibility = (): void => tick()
  visibility?.addEventListener('visibilitychange', onVisibility)

  /* ---------- 背景声 ---------- */

  function bedSetup(c: AudioContext, m: Mixer): BedSetup {
    return {
      ctx: c,
      buses: m.buses,
      store,
      rng,
      horizon: () => c.currentTime + horizon(),
      audible: () => ctx === c && running(),
    }
  }

  function setVolume(bus: Bus, v: number): void {
    if (!Number.isFinite(v)) return
    volumes[bus] = Math.max(0, Math.min(100, v))
    mixer?.setVolume(bus, volumes[bus])
  }

  function applyVolumes(mix: Partial<SoundMix>): void {
    if (mix.ambienceVolume !== undefined) setVolume('ambience', mix.ambienceVolume)
    if (mix.musicVolume !== undefined) setVolume('music', mix.musicVolume)
  }

  /** 新开一组背景声时的模式音色：背景声从静默淡入，音色可以很快换好 */
  function prepareMode(m: Mixer, mode: SoundMode): void {
    m.setMode(mode, 0.05)
  }

  /* ---------- 试听 ---------- */

  function endPreview(g: Bed, fade: number): void {
    if (preview !== g) return
    if (previewTimer) clearTimeout(previewTimer)
    previewTimer = null
    preview = null
    g.stop(fade)
    emit(previewListeners)
    armIdle()
  }

  /* ---------- 单次音 ---------- */

  function oneShot(name: AssetName, at: number, strikes: [number, number][], tolerance: number): Scheduled {
    const c = ctx
    const sh = shots
    if (!c || !sh || disposed) return NOOP
    clearIdle()
    const buffer = store.peek(name, c.sampleRate)
    if (buffer) return sh.play(buffer, at, strikes)
    // 素材还没生成好：生成好以后如果还来得及就补上，太晚就不响了（迟到的节拍提示会误导呼吸）
    const late = { cancelled: false, inner: null as Scheduled | null }
    deferred.add(late)
    store.load([name], c.sampleRate, 'now').then(
      get => {
        deferred.delete(late)
        if (late.cancelled || ctx !== c || shots !== sh) return
        const now = c.currentTime
        if (now > at + tolerance) {
          armIdle()
          return
        }
        late.inner = sh.play(get(name), Math.max(at, now + 0.01), strikes)
      },
      () => deferred.delete(late),
    )
    return {
      cancel() {
        late.cancelled = true
        deferred.delete(late)
        late.inner?.cancel()
      },
    }
  }

  const essentials = (): AssetName[] => [...CUE_ASSETS, 'ir']

  /* ---------- 对外接口 ---------- */

  return {
    async unlock() {
      const c = ensureContext()
      if (!c) return false
      preferPlayback()
      kick(c)
      idleSuspended = false
      clearIdle()
      clearPause()
      await Promise.all([resumeContext(c), settleWithin(attachLimiter(c), TIMING.workletTimeoutMs)])
      if (ctx !== c) return false
      store.warm(essentials(), c.sampleRate)
      if (!bed && !preview) armIdle()
      return running()
    },

    now() {
      return ctx ? ctx.currentTime : performance.now() / 1000
    },

    state(): EngineState {
      if (disposed) return 'closed'
      if (!ctx) return unavailable || !supported() ? 'unavailable' : 'suspended'
      const s = ctx.state as string
      return s === 'running' || s === 'closed' || s === 'interrupted' ? s : 'suspended'
    },

    onStateChange(listener) {
      stateListeners.add(listener)
      return () => {
        stateListeners.delete(listener)
      }
    },

    startBed(mix, at, fadeIn, plannedSec) {
      const c = ctx
      const m = mixer
      if (!c || !m || disposed) return
      clearIdle()
      clearPause()
      dropLeftovers()
      if (preview) endPreview(preview, FADES.previewStop)
      bed?.stop(FADES.restart)
      const mode = mix.mode ?? 'relax'
      prepareMode(m, mode)
      applyVolumes(mix)
      bed = createBed(bedSetup(c, m), {
        mix: { ...mix, mode },
        at,
        fadeIn: Math.max(fadeIn, FADES.sessionIn[mode]),
        plannedSec,
      })
      startTicker()
    },

    changeBed(mix) {
      const g = bed
      if (!g || !mixer) return
      applyVolumes(mix)
      if (mix.mode !== undefined) mixer.setMode(mix.mode)
      g.change(mix)
    },

    setVolume,

    breath(seg: Segment, at: number) {
      bed?.breath(seg, at)
    },

    glide(seg: Segment, at: number) {
      const c = ctx
      if (!c || !glides || disposed) return NOOP
      if (at + seg.dur < c.currentTime) return NOOP
      return glides.play(seg, at)
    },

    freeRun(until) {
      if (ctx) bed?.freeRun(ctx.currentTime, until)
    },

    cue(kind: CueKind, at?: number) {
      const c = ctx
      if (!c) return NOOP
      wake()
      const now = c.currentTime
      const t = at ?? now
      if (t < now - TIMING.lateCue) return NOOP
      return oneShot(`cue:${kind}`, Math.max(t, now), [[0, cueGain(kind)]], TIMING.lateCue)
    },

    bell(kind: BellKind, at: number) {
      const c = ctx
      if (!c) return NOOP
      wake()
      const now = c.currentTime
      if (at < now - TIMING.lateBell) return NOOP
      return oneShot('bell', Math.max(at, now), bellStrikes(kind), TIMING.lateBell)
    },

    fadeBedOut(at, dur) {
      bed?.fadeOut(at, dur)
    },

    stopBed(fade) {
      const g = bed
      if (!g) return
      bed = null
      g.stop(fade)
      armIdle()
    },

    cancelScheduled() {
      shots?.cancelPending()
      for (const d of [...deferred]) {
        d.cancelled = true
        deferred.delete(d)
      }
      glides?.cancelAll()
      if (ctx) bed?.hold(ctx.currentTime)
    },

    suspend() {
      const c = ctx
      const m = mixer
      clearIdle()
      idleSuspended = false
      if (!c || !m || disposed) return Promise.resolve()
      cancelPendingSuspend()
      paused = true
      if (!running()) {
        // 系统已经先停了音频环境（锁屏、来电）：淡出已经来不及，趁时钟停着直接放到 0，听不出来。
        // 不放的话输出一直停在原电平，继续时 transport(1) 从 1 走到 1，背景声和钟声一下子全响回来
        m.transportNow(0)
        return settleWithin(
          attempt(() => c.suspend()),
          TIMING.unlockTimeoutMs,
        )
      }
      // 背景声 1.5 秒淡出；提示音更快收住，免得暂停之后还冒出一声
      const end = m.transport(0, { bed: FADES.pause, cues: FADES.pauseCues })
      return new Promise<void>(resolve => {
        suspendDone = resolve
        suspendTimer = setTimeout(
          () => {
            suspendTimer = null
            suspendDone = null
            if (ctx !== c || !paused) {
              resolve()
              return
            }
            void settleWithin(
              attempt(() => c.suspend()),
              TIMING.unlockTimeoutMs,
            ).then(resolve)
          },
          (end - c.currentTime) * 1000 + 30,
        )
      })
    },

    async resume() {
      const c = ctx
      const m = mixer
      if (!c || !m || disposed) return
      clearIdle()
      idleSuspended = false
      cancelPendingSuspend()
      await resumeContext(c)
      if (ctx !== c || disposed) return
      paused = false
      m.transport(1, { bed: FADES.pause, cues: FADES.resumeCues })
    },

    setDuck(on) {
      ducked = on
      mixer?.setDuck(on)
    },

    preview(mix, seconds = TIMING.preview) {
      if (bed || disposed) return
      if (preview) endPreview(preview, FADES.previewStop)
      if (mix.ambience === 'none' && mix.music === 'none') return
      const c = ensureContext()
      const m = mixer
      if (!c || !m) return
      preferPlayback()
      idleSuspended = false
      clearIdle()
      clearPause()
      dropLeftovers()
      void resumeContext(c)
      void attachLimiter(c)
      const mode = mix.mode ?? 'relax'
      prepareMode(m, mode)
      applyVolumes(mix)
      const at = c.currentTime + 0.05
      const end = at + Math.max(seconds, FADES.previewIn + FADES.previewOut)
      const g = createBed(bedSetup(c, m), { mix: { ...mix, mode }, at, fadeIn: FADES.previewIn, quick: true })
      g.fadeOut(end - FADES.previewOut, FADES.previewOut)
      g.freeRun(c.currentTime, end + 1)
      preview = g
      startTicker()
      previewTimer = setTimeout(() => endPreview(g, FADES.minStop), (end - c.currentTime + 0.2) * 1000)
      emit(previewListeners)
    },

    stopPreview() {
      if (preview) endPreview(preview, FADES.previewStop)
    },

    previewing() {
      return preview ? { ambience: preview.mix.ambience, music: preview.mix.music } : null
    },

    onPreviewChange(listener) {
      previewListeners.add(listener)
      return () => {
        previewListeners.delete(listener)
      }
    },

    warm(mix) {
      const names: AssetName[] = [...CUE_ASSETS]
      const amb = layerKey('ambience', mix.ambience)
      const mus = layerKey('music', mix.music)
      if (amb) names.push(...layerAssets(amb))
      if (mus) names.push(...layerAssets(mus))
      // 混响要按音频环境的采样率生成，环境还没建就等解锁时再生成
      const rate = ctx?.sampleRate
      store.warm(rate ? names : names.filter(n => n !== 'ir'), rate ?? 48000)
    },

    dispose() {
      if (disposed) return
      stopTicker()
      clearIdle()
      cancelPendingSuspend()
      if (previewTimer) clearTimeout(previewTimer)
      for (const g of [bed, preview]) g?.teardown()
      bed = null
      preview = null
      for (const d of deferred) d.cancelled = true
      deferred.clear()
      glides?.dispose()
      shots?.dispose()
      mixer?.dispose()
      const c = ctx
      c?.removeEventListener('statechange', onContextState)
      if (c && (c.state as string) !== 'closed') void attempt(() => c.close()).catch(() => undefined)
      if (ownStore) store.dispose()
      visibility?.removeEventListener('visibilitychange', onVisibility)
      disposed = true
      emit(stateListeners)
      stateListeners.clear()
      previewListeners.clear()
    },
  }
}
