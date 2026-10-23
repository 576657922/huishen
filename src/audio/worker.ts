/**
 * 生成素材的 Worker：一次只做一个，算完把采样连同底层内存一起转交给主线程（不复制）。
 * 排队和优先级由主线程的 buffers.ts 管理，这里只管算。
 */
import { isAssetName, renderAsset } from './dsp/assets'
import { runSync } from './dsp/task'
import type { RenderReply, RenderRequest } from './protocol'

interface WorkerScope {
  onmessage: ((e: MessageEvent<unknown>) => void) | null
  postMessage(message: RenderReply, transfer: Transferable[]): void
}

const scope = self as unknown as WorkerScope

function isRequest(x: unknown): x is RenderRequest {
  if (typeof x !== 'object' || x === null) return false
  const r = x as Partial<Record<keyof RenderRequest, unknown>>
  return (
    typeof r.id === 'number' &&
    typeof r.name === 'string' &&
    isAssetName(r.name) &&
    typeof r.sr === 'number' &&
    r.sr >= 8000 &&
    r.sr <= 192000
  )
}

scope.onmessage = e => {
  const req = e.data
  if (!isRequest(req)) {
    const id = typeof (req as { id?: unknown })?.id === 'number' ? (req as { id: number }).id : -1
    scope.postMessage({ id, ok: false, error: 'bad request' }, [])
    return
  }
  try {
    const chs = runSync(renderAsset(req.name, req.sr))
    scope.postMessage(
      { id: req.id, ok: true, chs },
      chs.map(c => c.buffer as ArrayBuffer),
    )
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, error: String(err) }, [])
  }
}
