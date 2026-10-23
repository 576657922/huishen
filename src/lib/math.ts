export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** 保留 1 位小数 */
export const round1 = (x: number): number => Math.round(x * 10) / 10

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** 半余弦缓动：两端缓、中间快 */
export const easeInOut = (q: number): number => (1 - Math.cos(clamp(q, 0, 1) * Math.PI)) / 2

/** 正弦缓出：先快后缓 */
export const easeOut = (q: number): number => Math.sin((clamp(q, 0, 1) * Math.PI) / 2)

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)

export const mean = (xs: readonly number[]): number => (xs.length ? sum(xs) / xs.length : Number.NaN)

/** 中位数；空列表为 NaN（与 mean 一致），需要「没有」的调用方自己先判空 */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  const hi = s[m] ?? Number.NaN
  return s.length % 2 ? hi : ((s[m - 1] ?? hi) + hi) / 2
}
