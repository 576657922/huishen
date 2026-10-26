import { getLanguage } from './locale'
export const pad2 = (n: number): string => String(n).padStart(2, '0')

/** 倒计时显示：mm:ss，向上取整，避免最后一秒显示 00:00 */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec - 1e-6))
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}

/** 时长显示：m:ss，四舍五入 */
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`
}

/** 「12 分钟」「1 小时 5 分钟」 */
export function fmtMinutes(sec: number): string {
  const m = Math.round(Math.max(0, sec) / 60)
  const unit = (n: number, name: 'hour' | 'minute'): string => {
    const text = new Intl.NumberFormat(getLanguage(), {
      style: 'unit',
      unit: name,
      unitDisplay: 'long',
    }).format(n)
    return getLanguage() === 'ja' ? text : text.replace(/(\d)(?=\p{Script=Han})/u, '$1 ')
  }
  if (m < 60) return unit(m, 'minute')
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${unit(h, 'hour')} ${unit(r, 'minute')}` : unit(h, 'hour')
}
