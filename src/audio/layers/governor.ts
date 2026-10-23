/**
 * 力度调节（稀疏的拨弦、电钢琴用）：记下近几秒里音符的能量（力度平方的指数衰减和），
 * 偏高时把下一个音调轻，让几个音偶然挤在一起时短期响度不往上冲。只压不抬：
 * 隔了很久才来的一个音如果反而更响，听起来就像一次渐强。
 */
import { clamp } from '@/lib/math'

export interface GovernorSpec {
  /** 能量的衰减时间常数（秒），与短期响度的 3 秒窗相当 */
  tau: number
  /** 平均每隔多少秒一个音、力度平方的平均值：一起决定常态的能量 */
  meanGap: number
  meanPower: number
  /** 最多压到原力度的多少倍 */
  floor: number
}

/** 返回一个函数：t 时刻来了一个力度为 velocity 的音，给出调节后的力度 */
export function createGovernor(spec: GovernorSpec): (t: number, velocity: number) => number {
  // 均匀地每 meanGap 秒来一个音时，刚响过一个音的那一刻的能量
  const typical = spec.meanPower / (1 - Math.exp(-spec.meanGap / spec.tau))
  let energy = 0
  let last = Number.NEGATIVE_INFINITY
  return (t, velocity) => {
    energy *= Math.exp(-Math.max(0, t - last) / spec.tau)
    last = t
    const room = typical - energy
    const fix = room >= velocity ** 2 ? 1 : clamp(Math.sqrt(Math.max(0, room)) / velocity, spec.floor, 1)
    const v = velocity * fix
    energy += v ** 2
    return v
  }
}
