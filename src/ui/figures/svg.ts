/** 图形几何的小工具：坐标取两位小数，路径用绝对坐标，与设计稿 draw.mjs 的输出逐字一致 */

export type Point = readonly [number, number]

/** 两位小数；-0 写成 0 */
export function n(x: number): string {
  const r = Math.round(x * 100) / 100
  return Object.is(r, -0) ? '0' : String(r)
}

export function path(points: readonly Point[]): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join('')
}
