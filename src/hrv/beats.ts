/**
 * 把心率带的通知还原成带时刻的心搏。
 *
 * 心率带大约每秒发一次通知，内容是这一秒里完成的 RR。收到通知时，最后一搏已经过去 0–1 秒不等，
 * 直接拿收到的时刻给心搏定时，会带来将近一秒的抖动；RR 却是心率带按毫秒量出来的，累加起来才准。
 * 所以以 RR 累加为准，只在它和收到的时刻明显对不上时（丢了通知、接触中断、读数异常、调用方的时钟跳变）重新对齐。
 */
import { sum } from '@/lib/math'
import { artifactMask } from './metrics'
import type { Beat, HeartRateMeasurement, SensorContact, SignalStatus } from './types'

/**
 * RR 累加的时刻与收到时刻之差的容许范围（秒）。正常情况下这个差落在 ±1.1 秒以内
 * （通知间隔加传输延迟），超出就说明中间丢了心搏，或调用方的时钟跳了。
 */
const MAX_DRIFT = 1.5

/** 收到这么多条有心率的读数仍没有 RR，就认为设备不提供逐搏间期（多见于光学手环的广播模式） */
const RR_PROBE_READINGS = 5

/** 这么多秒没有新的心搏，就提示信号中断；心率带每秒通知一次，偶尔丢一两条属正常 */
const STALE_SEC = 5
/** 判断信号是否稳定时看最近多少搏，约 20 秒 */
const RECENT_BEATS = 20
/** 最近这些心搏里伪迹超过这一比例才提示：偶尔一次早搏（剔除一短一长两搏）是正常的 */
const UNSTABLE_SHARE = 0.1

export interface BeatTracker {
  /**
   * 收到一条测量时调用。at 为收到的时刻（秒），用调用方自己的时钟，如练习时钟；
   * 时钟重置（例如重新开始）时先调用 reset()。返回这一条测量带来的新心搏。
   */
  push(m: HeartRateMeasurement, at: number): Beat[]
  /** 迄今的全部心搏，按时间先后 */
  beats(): readonly Beat[]
  /** 设备是否提供逐搏间期；读数还不够判断时为 null */
  rrSupported(): boolean | null
  /** now 时刻的信号状态，now 与 push 的 at 用同一个时钟 */
  status(now: number): SignalStatus
  reset(): void
}

export function createBeatTracker(): BeatTracker {
  let all: Beat[] = []
  let last: number | null = null
  let broken = false
  let readings = 0
  let sawRr = false
  let contact: SensorContact | null = null

  function push(m: HeartRateMeasurement, at: number): Beat[] {
    contact = m.contact
    if (m.contact === 'not-detected') {
      // 没贴紧时的 RR 不可信；接触恢复后重新对齐
      broken = true
      return []
    }
    if (m.hr > 0) readings++
    const rr = m.rr.filter(x => Number.isFinite(x) && x > 0)
    if (!rr.length || !Number.isFinite(at)) return []
    sawRr = true

    // 偏差按整条通知算：一个读坏的超长间期会让这一条整体对不上，于是按收到的时刻重新对齐，不会把后面的心搏推后
    const span = sum(rr) / 1000
    const realign = last === null || broken || Math.abs(at - (last + span)) > MAX_DRIFT
    broken = false
    let t = last === null || realign ? at - span : last
    const fresh: Beat[] = []
    for (const x of rr) {
      t += x / 1000
      // 时钟往回跳后重新对齐，可能与已有的心搏重叠；丢掉重叠的部分，保证时刻单调
      if (last !== null && t <= last) continue
      fresh.push({ t, rr: x })
    }
    const end = fresh.at(-1)
    if (!end) return fresh
    last = end.t
    // 换成新数组而不是原地追加：界面按引用就能判断有没有新心搏
    all = all.concat(fresh)
    return fresh
  }

  const rrSupported = (): boolean | null => (sawRr ? true : readings >= RR_PROBE_READINGS ? false : null)

  function status(now: number): SignalStatus {
    if (contact === null) return 'waiting'
    if (contact === 'not-detected') return 'no-contact'
    if (rrSupported() === false) return 'no-rr'
    const end = all.at(-1)
    if (!end) return 'waiting'
    if (now - end.t > STALE_SEC) return 'stale'
    // 多取前面两搏，让最早的几搏也能和完整的五搏比较
    const mask = artifactMask(all.slice(-RECENT_BEATS - 2).map(b => b.rr)).slice(-RECENT_BEATS)
    const rejected = mask.filter(keep => !keep).length
    return rejected > UNSTABLE_SHARE * mask.length ? 'unstable' : 'good'
  }

  return {
    push,
    beats: () => all,
    rrSupported,
    status,
    reset() {
      all = []
      last = null
      broken = false
      readings = 0
      sawRr = false
      contact = null
    },
  }
}
