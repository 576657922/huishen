/**
 * 主线程与生成素材的 Worker 之间的消息。
 */
import type { AssetName } from './dsp/assets'

export interface RenderRequest {
  id: number
  name: AssetName
  /** 生成用的采样率：循环素材固定 32 kHz，混响冲激响应用音频环境的采样率 */
  sr: number
}

export type RenderReply =
  | { id: number; ok: true; chs: Float32Array[] }
  | { id: number; ok: false; error: string }

export function isRenderReply(x: unknown): x is RenderReply {
  if (typeof x !== 'object' || x === null) return false
  const r = x as Partial<Record<'id' | 'ok' | 'chs' | 'error', unknown>>
  if (typeof r.id !== 'number' || typeof r.ok !== 'boolean') return false
  return r.ok
    ? Array.isArray(r.chs) && r.chs.every(c => c instanceof Float32Array)
    : typeof r.error === 'string'
}
