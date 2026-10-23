/**
 * 应用里的单例：声音引擎、平台能力、记录仓库，以及唯一的会话控制器（两次练习之间 reset()）。
 * 都在第一次用到时才创建。声音引擎只在第一次真正要出声时创建——会话开始时解锁声音、试听声音——
 * 这两件事都发生在用户手势里，AudioContext 因此总是在手势里创建和恢复（浏览器的自动播放限制）。
 * 偏好里的音量由这里同步给声音层，页面不用各自去设。
 * v1 没有语音引导（PRODUCT.md §0）：没有语音服务，会话控制器拿到不出声的语音端口（engine 的 NULL_VOICE）
 */
import { type AudioEngine, type Bus, createAudioEngine } from '@/audio'
import { getSessionRepo, type LocalSessionRepo, prefsStore } from '@/data'
import {
  type AudioPort,
  type BrowserPlatform,
  createBrowserPlatform,
  createSessionController,
  NULL_VOICE,
  type SessionController,
} from '@/engine'

const BUSES: readonly Bus[] = ['master', 'ambience', 'music', 'cues']

let audio: AudioEngine | null = null
let platform: BrowserPlatform | null = null
let controller: SessionController | null = null
let timeScale = 1
const unsubscribers: Array<() => void> = []

/* ---------- 声音 ---------- */

/**
 * 声音引擎。只在用户手势里调用（开始练习、试听、测试声音）：第一次调用时创建引擎，
 * 引擎在 unlock() 或 preview() 时才建 AudioContext。不在手势里时用 peekAudio()
 */
export function getAudio(): AudioEngine {
  if (audio) return audio
  const a = createAudioEngine()
  audio = a
  syncVolumes(a)
  return a
}

/** 已经建好的声音引擎；还没有时为 null，不会因此创建（停止试听、页面卸载时用） */
export const peekAudio = (): AudioEngine | null => audio

/** 设置里的四个音量随时同步给引擎。只改变了的那一路：听声音的音量来自它自己的组合，不能被别的改动冲掉 */
function syncVolumes(a: AudioEngine): void {
  const volume = prefsStore.getState().volume
  for (const bus of BUSES) a.setVolume(bus, volume[bus])
  unsubscribers.push(
    prefsStore.subscribe((next, prev) => {
      if (next.volume === prev.volume) return
      for (const bus of BUSES) if (next.volume[bus] !== prev.volume[bus]) a.setVolume(bus, next.volume[bus])
    }),
  )
}

/**
 * 交给会话控制器的声音端口：每次调用都转给 getAudio()。控制器只在 start()（用户手势里）之后才碰声音，
 * 所以引擎总是在手势里第一次创建
 */
const audioPort: AudioPort = {
  unlock: () => getAudio().unlock(),
  now: () => getAudio().now(),
  state: () => getAudio().state(),
  onStateChange: listener => getAudio().onStateChange(listener),
  startBed: (mix, at, fadeIn, plannedSec) => getAudio().startBed(mix, at, fadeIn, plannedSec),
  changeBed: mix => getAudio().changeBed(mix),
  setVolume: (bus, volume) => getAudio().setVolume(bus, volume),
  breath: (seg, at) => getAudio().breath(seg, at),
  glide: (seg, at) => getAudio().glide(seg, at),
  freeRun: until => getAudio().freeRun(until),
  cue: (kind, at) => getAudio().cue(kind, at),
  bell: (kind, at) => getAudio().bell(kind, at),
  fadeBedOut: (at, dur) => getAudio().fadeBedOut(at, dur),
  stopBed: fade => getAudio().stopBed(fade),
  cancelScheduled: () => getAudio().cancelScheduled(),
  suspend: () => getAudio().suspend(),
  resume: () => getAudio().resume(),
}

/* ---------- 平台、记录 ---------- */

/** 屏幕常亮、振动、前后台 */
export function getPlatform(): BrowserPlatform {
  if (!platform) platform = createBrowserPlatform()
  return platform
}

/** 练习记录仓库（全应用共用一个，与 data 层的 hooks 读的是同一个） */
export const getRepo = (): LocalSessionRepo => getSessionRepo()

/* ---------- 会话 ---------- */

/** 唯一的会话控制器。练习结束后由 flows 调 reset() 回到 idle，下一次练习接着用它 */
export function getController(): SessionController {
  if (!controller) {
    controller = createSessionController(
      { audio: audioPort, voice: NULL_VOICE, platform: getPlatform() },
      timeScale === 1 ? {} : { timeScale },
    )
  }
  return controller
}

/** 已经建好的会话控制器；还没有时为 null */
export const peekController = (): SessionController | null => controller

/**
 * 练习的时间流速。只用于开发和端到端测试（?speed=N）：不为 1 时练习按倍速走、不出声。
 * 必须在第一次 getController() 之前调用；生产构建里没有调用它的代码
 */
export function setTimeScale(scale: number): void {
  if (controller) throw new Error('会话控制器已经建好，不能再改时间流速')
  if (!(Number.isFinite(scale) && scale > 0)) throw new RangeError(`时间流速应大于 0：${scale}`)
  timeScale = scale
}

export const getTimeScale = (): number => timeScale

/** 测试用：丢掉所有单例和订阅，下次再按需创建 */
export function resetServices(): void {
  controller?.end()
  for (const off of unsubscribers.splice(0)) off()
  audio?.dispose()
  platform?.dispose()
  audio = null
  platform = null
  controller = null
  timeScale = 1
}
