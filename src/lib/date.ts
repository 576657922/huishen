import { pad2 } from './time'

/** 一天的毫秒数（按 UTC 计；本地日期的差用 daysBetween，夏令时那天不是 24 小时） */
export const DAY_MS = 86_400_000

/** 本地日期键 YYYY-MM-DD */
export const dayKey = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** 把 YYYY-MM-DD 解析为本地零点 */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** 本周一零点（中国习惯以周一为一周开始） */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  return addDays(x, -((x.getDay() + 6) % 7))
}

/** 两个日期相差的整天数（按本地日期计） */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 「10月22日 星期四」 */
export function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${WEEKDAYS[d.getDay()]}`
}

/** 记录列表里的时间：今天 21:05 / 昨天 07:30 / 10/18 21:05 */
export function fmtWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const t = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const k = dayKey(d)
  if (k === dayKey(now)) return `今天 ${t}`
  if (k === dayKey(addDays(now, -1))) return `昨天 ${t}`
  if (d.getFullYear() !== now.getFullYear())
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${t}`
  return `${d.getMonth() + 1}/${d.getDate()} ${t}`
}

/** 按当地时间划分的时段，用于推荐练习 */
export type DayPart = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

export function dayPart(d: Date): DayPart {
  const h = d.getHours()
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 11 && h < 14) return 'midday'
  if (h >= 14 && h < 18) return 'afternoon'
  if (h >= 18 && h < 22) return 'evening'
  return 'night'
}
