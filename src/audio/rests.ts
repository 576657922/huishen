/**
 * 音乐的中间休止：10 分钟以上的练习里，音乐在 8–10 秒里变稀、静下来，停 20–40 秒，再慢慢回来；自然声照常。
 * 研究里一段 2 分钟的停顿让心率、血压低于基线；这里只取「留白」的做法，不作生理上的声明。
 */
import { easeInOut } from '@/lib/math'
import { MUSIC } from './params'

export interface Rest {
  /** 开始变稀的时刻（声音时钟） */
  at: number
  /** 静下来用的秒数 */
  fade: number
  /** 完全安静的秒数 */
  hold: number
  /** 回来用的秒数 */
  back: number
}

export interface RestPlan {
  /** 开始时刻晚于 after 的第一次休止；没有为 null */
  next(after: number): Rest | null
  /** t 时刻音乐的密度：平时 1，静下来时 0；音符按这个概率出现 */
  density(t: number): number
}

const P = MUSIC.rest

export const restEnd = (r: Rest): number => r.at + r.fade + r.hold + r.back

/** 休止中的密度曲线：缓入缓出地降到 0，停住，再缓缓回到 1 */
export function restDensity(r: Rest, t: number): number {
  if (t <= r.at || t >= restEnd(r)) return 1
  const u = t - r.at
  if (u < r.fade) return 1 - easeInOut(u / r.fade)
  if (u < r.fade + r.hold) return 0
  return easeInOut((u - r.fade - r.hold) / r.back)
}

function makeRest(at: number, rng: () => number): Rest {
  return {
    at,
    fade: P.fadeLo + (P.fadeHi - P.fadeLo) * rng(),
    hold: P.holdLo + (P.holdHi - P.holdLo) * rng(),
    back: P.back,
  }
}

function fromList(rests: readonly Rest[]): RestPlan {
  return {
    next: after => rests.find(r => r.at > after) ?? null,
    density: t => rests.reduce((d, r) => Math.min(d, restDensity(r, t)), 1),
  }
}

/**
 * 按练习长短安排休止。start 为背景声开始的时刻，plannedSec 为从 start 到练习结束的秒数；
 * 不限时（undefined）就每隔 15 分钟左右一次。短于 10 分钟的练习没有休止
 */
export function planRests(start: number, plannedSec: number | undefined, rng: () => number): RestPlan {
  if (plannedSec === undefined || !Number.isFinite(plannedSec)) {
    const list: Rest[] = []
    let last = start
    const ensure = (t: number): void => {
      while (!list.length || list[list.length - 1]!.at <= t) {
        last += P.every + (rng() * 2 - 1) * P.jitter
        list.push(makeRest(last, rng))
      }
    }
    const plan = fromList(list)
    return {
      next: after => {
        ensure(after)
        return plan.next(after)
      },
      density: t => {
        ensure(t)
        return plan.density(t)
      },
    }
  }
  if (plannedSec < P.minSession) return fromList([])
  const count = plannedSec >= P.twoFrom ? 2 : 1
  const longest = P.fadeHi + P.holdHi + P.back
  // 均匀地放在中段，各自再抖动一点；离开头、结尾都至少 margin 秒
  const lo = start + P.margin
  const hi = start + plannedSec - P.margin - longest
  const rests: Rest[] = []
  for (let k = 1; k <= count; k++) {
    const center = start + (plannedSec * k) / (count + 1)
    const at = Math.min(hi, Math.max(lo, center + (rng() * 2 - 1) * 30))
    rests.push(makeRest(at, rng))
  }
  return fromList(rests)
}

/** 没有休止 */
export const NO_RESTS: RestPlan = fromList([])

/**
 * 从 at 起不再休止：之后的都取消；at 时正在休止的，从当时的密度用 back 秒缓缓回到 1（与休止回来时同样的曲线）。
 * 跟随节拍时用：音乐随呼吸的起伏就是节拍的一部分（仅背景提示时是全部），休止会让它静下来半分钟
 */
export function endRests(plan: RestPlan, at: number, back: number = P.back): RestPlan {
  const d0 = plan.density(at)
  return {
    next: () => null,
    density: t => (t < at ? plan.density(t) : d0 + (1 - d0) * easeInOut((t - at) / back)),
  }
}
