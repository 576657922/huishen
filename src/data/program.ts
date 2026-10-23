/**
 * 计划进度的键与推进。进度按「完成了哪几天」记，键如 'w3d2'（第 3 周第 2 天）：
 * 漏了的日子不重排、不算落后，下次打开接着做还没做的那一天（PRODUCT.md §3）。
 */
import type { ProgramProgress } from './types'

export const DAYS_PER_WEEK = 7

/** 键里允许的最大周数；计划实际有几周由内容层决定 */
export const MAX_PROGRAM_WEEKS = 52

export interface ProgramDay {
  /** 第几周，从 1 开始 */
  week: number
  /** 这一周的第几天，1–7 */
  day: number
}

const KEY = /^w([1-9]\d?)d([1-7])$/

const isWeek = (week: number): boolean => Number.isInteger(week) && week >= 1 && week <= MAX_PROGRAM_WEEKS
const isDay = (day: number): boolean => Number.isInteger(day) && day >= 1 && day <= DAYS_PER_WEEK

/** 第 3 周第 2 天 → 'w3d2'；超出范围时抛 RangeError */
export function programDayKey(week: number, day: number): string {
  if (!isWeek(week) || !isDay(day)) throw new RangeError(`计划里没有第 ${week} 周第 ${day} 天`)
  return `w${week}d${day}`
}

/** 'w3d2' → { week: 3, day: 2 }；格式不对或超出范围时为 null */
export function parseProgramDay(key: unknown): ProgramDay | null {
  if (typeof key !== 'string') return null
  const m = KEY.exec(key)
  if (!m) return null
  const week = Number(m[1])
  const day = Number(m[2])
  return isWeek(week) ? { week, day } : null
}

/** 从计划开始数的第几天（从 0 开始），用来给完成的天排序 */
export const programDayIndex = ({ week, day }: ProgramDay): number => (week - 1) * DAYS_PER_WEEK + day - 1

/**
 * 下一个要做的一天：按周、天的先后，第一个还没完成的。weeks 为计划的周数（来自内容层）。
 * 还没加入时是第 1 周第 1 天；全部做完时为 null
 */
export function nextProgramDay(progress: ProgramProgress | undefined, weeks: number): ProgramDay | null {
  const n = Number.isFinite(weeks) ? Math.min(Math.max(Math.floor(weeks), 0), MAX_PROGRAM_WEEKS) : 0
  const total = n * DAYS_PER_WEEK
  const done = new Set(progress?.done ?? [])
  for (let i = 0; i < total; i++) {
    const day = { week: Math.floor(i / DAYS_PER_WEEK) + 1, day: (i % DAYS_PER_WEEK) + 1 }
    if (!done.has(programDayKey(day.week, day.day))) return day
  }
  return null
}
