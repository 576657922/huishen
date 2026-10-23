/**
 * 前瞻调度：定时醒来，把接下来一段时间里的声音事件排进声音时间线。
 * 声音由音频线程按时播放，主线程卡顿或在后台被限速都不会让节拍走样；
 * 页面在后台时浏览器会把定时器放慢到每秒甚至每分钟一次，所以前瞻要拉长。
 */

/** 调度间隔 */
export const TICK_MS = 200
/** 页面在前台时前瞻的秒数：短一些，换声音、暂停时撤销的事件少 */
export const HORIZON_VISIBLE_SEC = 6
/** 页面在后台时前瞻的秒数：要盖过浏览器对后台定时器最长约一分钟的限速 */
export const HORIZON_HIDDEN_SEC = 75
/** 事件迟到超过这个秒数就不再补放，免得一次性挤出一串过时的提示音 */
export const LATE_TOLERANCE_SEC = 0.25

export const horizonFor = (hidden: boolean): number => (hidden ? HORIZON_HIDDEN_SEC : HORIZON_VISIBLE_SEC)

export interface IntervalTimers {
  setInterval(fn: () => void, ms: number): unknown
  clearInterval(id: unknown): void
}

const globalIntervals: IntervalTimers = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: id => globalThis.clearInterval(id as ReturnType<typeof globalThis.setInterval>),
}

export interface Ticker {
  /** 开始定时调用，并立即调用一次 */
  start(): void
  stop(): void
  readonly running: boolean
}

export function createTicker(
  onTick: () => void,
  timers: IntervalTimers = globalIntervals,
  ms = TICK_MS,
): Ticker {
  let id: unknown = null
  return {
    get running() {
      return id !== null
    },
    start() {
      if (id !== null) timers.clearInterval(id)
      id = timers.setInterval(onTick, ms)
      onTick()
    },
    stop() {
      if (id === null) return
      timers.clearInterval(id)
      id = null
    },
  }
}

/** 一串按时间先后产出的事件；调度只往前走，排过的不会再排 */
export interface Lookahead {
  /** 下一个尚未排上的事件的时间；没有了为 Infinity */
  next(): number
  /** 排上时间早于 until 的事件；早于 now 太多的已经错过，跳过不补 */
  fill(now: number, until: number): void
}

export function createLookahead<E>(
  events: Iterable<E>,
  timeOf: (event: E) => number,
  emit: (event: E) => void,
  lateTolerance = LATE_TOLERANCE_SEC,
): Lookahead {
  const it = events[Symbol.iterator]()
  let pending = it.next()
  return {
    next: () => (pending.done ? Number.POSITIVE_INFINITY : timeOf(pending.value)),
    fill(now, until) {
      while (!pending.done) {
        const t = timeOf(pending.value)
        if (t >= until) return
        if (t >= now - lateTolerance) emit(pending.value)
        pending = it.next()
      }
    },
  }
}
