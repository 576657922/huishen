/**
 * 练习时钟。有声音时跟随声音时钟（AudioContext.currentTime），画面、提示音、钟声因此始终对齐，
 * 暂停时声音挂起，时间自然停住；没有声音时用 performance.now()，并扣除暂停的时长。
 */

/**
 * 声音时钟两次更新之间最多往前推算的秒数。
 * 浏览器按音频缓冲块更新 currentTime，「playback」延迟模式下一块可达几十毫秒，直接读会让动画一顿一顿；
 * 推算有上限，免得音频线程卡住时读数一路往前跑。
 */
export const AUDIO_EXTRAPOLATE_MAX_SEC = 0.1

export interface AudioTimeSource {
  /** 声音时钟（秒） */
  now(): number
  /** 声音时钟此刻是否在走 */
  running(): boolean
}

export interface SessionClock {
  /** 当前读数（秒）；单调不减，暂停时停住 */
  now(): number
  pause(): void
  resume(): void
  readonly paused: boolean
  readonly mode: 'audio' | 'perf'
  /** 改用 performance 时钟并从当前读数接着走；用于声音被浏览器拦下时 */
  switchToPerf(): void
}

export interface PerfClockOptions {
  /** 毫秒时钟，通常是 performance.now */
  perfNow: () => number
  /** 初始读数（秒），练习里是负的倒数秒数 */
  start?: number
  /** 时间流速，只用于开发和端到端测试 */
  timeScale?: number
}

interface ClockSetup {
  perfNow: () => number
  start: number
  timeScale: number
  audio: { source: AudioTimeSource; origin: number } | null
}

function createClock({ perfNow, start, timeScale, audio }: ClockSetup): SessionClock {
  let mode: 'audio' | 'perf' = audio ? 'audio' : 'perf'
  let paused = false
  let frozen = 0
  // perf 模式：读数 = base + 自 since 起流逝的时间
  let base = start
  let since = perfNow()
  // audio 模式的平滑状态
  let lastCt = Number.NaN
  let lastPerf = 0
  let lastOut = Number.NEGATIVE_INFINITY

  const readAudio = (src: AudioTimeSource, origin: number): number => {
    const ct = src.now()
    const p = perfNow()
    let v = ct
    if (ct !== lastCt) {
      lastCt = ct
      lastPerf = p
    } else if (src.running()) {
      v = ct + Math.min(AUDIO_EXTRAPOLATE_MAX_SEC, (p - lastPerf) / 1000)
    }
    // 推算可能略超前于下一次真实更新，取较大值保证读数不倒退
    if (v < lastOut) v = lastOut
    lastOut = v
    return v - origin
  }

  const read = (): number =>
    mode === 'audio' && audio
      ? readAudio(audio.source, audio.origin)
      : base + ((perfNow() - since) / 1000) * timeScale

  return {
    get paused() {
      return paused
    },
    get mode() {
      return mode
    },
    now: () => (paused ? frozen : read()),
    pause() {
      if (paused) return
      frozen = read()
      paused = true
    },
    resume() {
      if (!paused) return
      paused = false
      if (mode === 'perf') {
        base = frozen
        since = perfNow()
      } else {
        // 重新对准声音时钟，免得把整段暂停当成一次推算。
        // 若声音在暂停期间没有真正停住，读数会跳到声音的位置，与已排好的钟声保持一致
        lastCt = Number.NaN
      }
    },
    switchToPerf() {
      if (mode === 'perf') return
      base = paused ? frozen : read()
      since = perfNow()
      mode = 'perf'
    },
  }
}

/** 用 performance.now() 计时的时钟 */
export function createPerfClock({ perfNow, start = 0, timeScale = 1 }: PerfClockOptions): SessionClock {
  return createClock({ perfNow, start, timeScale, audio: null })
}

/** 跟随声音时钟的时钟；读数为声音时钟减去 origin */
export function createAudioClock(
  source: AudioTimeSource,
  origin: number,
  perfNow: () => number,
): SessionClock {
  return createClock({ perfNow, start: 0, timeScale: 1, audio: { source, origin } })
}
