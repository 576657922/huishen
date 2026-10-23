/**
 * 二十四节气的日期（2001–2099 年），用寿星通式 [Y×D+C]−L 计算，并修正已知的例外年份。
 * 只用于在「今日」页标注日期，精度为天。
 */
import { addDays, dayKey, startOfDay } from './date'

// biome-ignore format: 每行一季，便于对照
export const TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
] as const

export type TermName = (typeof TERM_NAMES)[number]

// 21 世纪的 C 值，按 TERM_NAMES 顺序
// biome-ignore format: 与 TERM_NAMES 逐行对应
const C21 = [
  5.4055, 20.12, 3.87, 18.73, 5.63, 20.646, 4.81, 20.1, 5.52, 21.04, 5.678, 21.37,
  7.108, 22.83, 7.5, 23.13, 7.646, 23.042, 8.318, 23.438, 7.438, 22.36, 7.18, 21.94,
]

// 通式在这些年份差一天
const EXCEPTIONS: Record<string, number> = {
  '2002-立秋': 1,
  '2008-小满': 1,
  '2016-小暑': 1,
  '2019-小寒': -1,
  '2021-冬至': -1,
  '2026-雨水': -1,
  '2082-大寒': 1,
  '2084-春分': 1,
  '2089-霜降': 1,
  '2089-立冬': 1,
}

/** 某年某个节气的日期（本地零点） */
export function termDate(year: number, index: number): Date {
  const name = TERM_NAMES[index]
  const c = C21[index]
  if (name === undefined || c === undefined) throw new RangeError(`节气序号超出范围：${index}`)
  const y = year % 100
  // 一、二月的节气用上一年的闰年数
  const leap = index < 4 ? Math.floor((y - 1) / 4) : Math.floor(y / 4)
  const day = Math.floor(y * 0.2422 + c) - leap + (EXCEPTIONS[`${year}-${name}`] ?? 0)
  const month = Math.floor(index / 2)
  return new Date(year, month, day)
}

export interface TermInfo {
  name: TermName
  date: Date
}

/** 某天是不是节气；如果明天是节气，也一并返回，用于显示「霜降前一日」 */
export function termNear(d: Date): { today: TermInfo | null; tomorrow: TermInfo | null } {
  const today = startOfDay(d)
  const tomorrow = addDays(today, 1)
  const find = (x: Date): TermInfo | null => {
    const y = x.getFullYear()
    if (y < 2001 || y > 2099) return null
    for (let i = 0; i < 24; i++) {
      const t = termDate(y, i)
      if (dayKey(t) === dayKey(x)) return { name: TERM_NAMES[i] as TermName, date: t }
    }
    return null
  }
  return { today: find(today), tomorrow: find(tomorrow) }
}

/** 「霜降」「霜降前一日」或 null */
export function termLabel(d: Date): string | null {
  const { today, tomorrow } = termNear(d)
  if (today) return today.name
  if (tomorrow) return `${tomorrow.name}前一日`
  return null
}
