/**
 * 建节点、断节点的小工具。层、混音台、提示音都用它们，行为一致：
 * 断开或停止已经断开、停止的节点不报错（音频节点的生命周期由浏览器和我们共同管理，重复调用很常见）。
 */

/** 忽略「节点已停止或已断开」之类的错误 */
export function quietly(fn: () => void): void {
  try {
    fn()
  } catch {
    // 节点已经停止或断开
  }
}

export function disconnectAll(nodes: Iterable<AudioNode>): void {
  for (const n of nodes) quietly(() => n.disconnect())
}

/** 一个增益节点，初值为 gain */
export function gainNode(ctx: BaseAudioContext, gain: number): GainNode {
  const g = ctx.createGain()
  g.gain.value = gain
  return g
}

export function biquadNode(
  ctx: BaseAudioContext,
  type: BiquadFilterType,
  freq: number,
  q: number,
  gainDb = 0,
): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = Math.min(freq, ctx.sampleRate / 2)
  f.Q.value = q
  f.gain.value = gainDb
  return f
}

/** 立体声声像；没有 StereoPannerNode 的老浏览器退回居中 */
export function panNode(ctx: BaseAudioContext, pan: number): AudioNode {
  if (typeof ctx.createStereoPanner !== 'function') return gainNode(ctx, 1)
  const p = ctx.createStereoPanner()
  p.pan.value = Math.max(-1, Math.min(1, pan))
  return p
}

/** 把参数从当前值平滑地指数过渡到 target（用于滤波频率：按倍数变化听起来才均匀） */
export function glideExp(param: AudioParam, target: number, at: number, dur: number): void {
  const from = Math.max(1e-4, param.value)
  param.cancelScheduledValues(at)
  param.setValueAtTime(from, at)
  param.exponentialRampToValueAtTime(Math.max(1e-4, target), at + Math.max(0.01, dur))
}

/** 把参数从当前值线性过渡到 target */
export function glideLinear(param: AudioParam, target: number, at: number, dur: number): void {
  param.cancelScheduledValues(at)
  param.setValueAtTime(param.value, at)
  param.linearRampToValueAtTime(target, at + Math.max(0.01, dur))
}
