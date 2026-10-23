/** 可复现的伪随机数（mulberry32），返回 [0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 时间戳加随机后缀，足够在单机上唯一 */
export function newId(): string {
  const rand = Math.random().toString(36).slice(2, 8).padEnd(6, '0')
  return `${Date.now().toString(36)}-${rand}`
}
