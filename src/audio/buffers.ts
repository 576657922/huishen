/**
 * 素材仓库：按名字取 AudioBuffer。
 *
 * 生成在 Worker 里做，一次只做一个，主线程按优先级排队：正要播放的排在预热的前面。
 * 没有 Worker（或 Worker 出错、超时）时退回主线程分片生成，每片几毫秒，界面不卡。
 * 生成好的素材按最近使用留在内存里；正在播放的素材被「占用」，不会被淘汰。
 * AudioBuffer 不属于某个音频环境，所以同一份素材实时播放和离线质检都能用。
 */
import { type AssetName, assetRate, renderAsset } from './dsp/assets'
import { runSliced } from './dsp/task'
import type { Buffers } from './layers/core'
import { CACHE } from './params'
import { isRenderReply, type RenderRequest } from './protocol'

/** now：马上要播放；soon：很可能马上要用；idle：空闲时预热 */
export type Priority = 'now' | 'soon' | 'idle'

const RANK: Record<Priority, number> = { now: 0, soon: 1, idle: 2 }

export interface BufferStore {
  /** 已生成就返回；ctxRate 为音频环境的采样率（只影响混响冲激响应） */
  peek(name: AssetName, ctxRate: number): AudioBuffer | null
  /** 一组素材都已生成时返回取用函数，否则返回 null */
  ready(names: readonly AssetName[], ctxRate: number): Buffers | null
  /** 生成（或从缓存取）一组素材 */
  load(names: readonly AssetName[], ctxRate: number, priority?: Priority): Promise<Buffers>
  /** 占用一组素材：占用期间不会被淘汰。返回释放函数，可以重复调用 */
  hold(names: readonly AssetName[], ctxRate: number): () => void
  /** 空闲时预先生成，出错也不报 */
  warm(names: readonly AssetName[], ctxRate: number): void
  /** 缓存里的素材占用的字节数 */
  bytes(): number
  /** 缓存里有哪些素材（键为「名字@采样率」），用于调试和测试 */
  keys(): string[]
  /** 生成在哪里做：worker 为 Worker（或还没开始、可以用），main 为主线程后备路径 */
  generator(): 'worker' | 'main'
  dispose(): void
}

export interface BufferStoreOptions {
  /** 创建 Worker；返回 null 或抛错时在主线程生成。默认用 ./worker.ts */
  createWorker?: () => Worker | null
  /** 把采样包装成 AudioBuffer；测试里替换 */
  makeBuffer?: (chs: Float32Array[], sampleRate: number) => AudioBuffer
  budgetBytes?: number
}

interface Entry {
  key: string
  name: AssetName
  sr: number
  buffer: AudioBuffer | null
  pending: Promise<AudioBuffer> | null
  job: Job | null
  holds: number
  used: number
}

interface Job {
  entry: Entry
  priority: Priority
  seq: number
  resolve(buffer: AudioBuffer): void
  reject(err: unknown): void
}

interface Inflight {
  id: number
  resolve(chs: Float32Array[]): void
  reject(err: unknown): void
  /** Worker 坏了：改在主线程重做这一个 */
  fallback(): void
  timer: ReturnType<typeof setTimeout>
}

function defaultWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
}

export function defaultMakeBuffer(chs: Float32Array[], sampleRate: number): AudioBuffer {
  const length = chs[0]?.length ?? 1
  const buffer = new AudioBuffer({ length, numberOfChannels: Math.max(1, chs.length), sampleRate })
  chs.forEach((c, i) => {
    buffer.getChannelData(i).set(c)
  })
  return buffer
}

const bytesOf = (b: AudioBuffer): number => b.length * b.numberOfChannels * 4

/** 空闲时再做；没有 requestIdleCallback 的浏览器（Safari）用一个短延时代替 */
function whenIdle(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 1500 })
    else setTimeout(resolve, 60)
  })
}

export function createBufferStore(options: BufferStoreOptions = {}): BufferStore {
  const createWorker = options.createWorker ?? defaultWorker
  const makeBuffer = options.makeBuffer ?? defaultMakeBuffer
  const budget = options.budgetBytes ?? CACHE.budgetBytes
  const entries = new Map<string, Entry>()
  const queue: Job[] = []
  let clock = 0
  let seq = 0
  let busy = false
  let disposed = false

  let worker: Worker | null = null
  let workerBroken = false
  let inflight: Inflight | null = null
  let nextId = 1
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const keyOf = (name: AssetName, sr: number): string => `${name}@${sr}`

  function entryFor(name: AssetName, ctxRate: number): Entry {
    const sr = assetRate(name, ctxRate)
    const key = keyOf(name, sr)
    let e = entries.get(key)
    if (!e) {
      e = { key, name, sr, buffer: null, pending: null, job: null, holds: 0, used: 0 }
      entries.set(key, e)
    }
    return e
  }

  function touch(e: Entry): void {
    e.used = ++clock
  }

  function evict(): void {
    let total = 0
    for (const e of entries.values()) {
      if (e.buffer) total += bytesOf(e.buffer)
      // 占用过、但从没生成出来的空位
      else if (e.holds === 0 && !e.pending) entries.delete(e.key)
    }
    const victims = [...entries.values()]
      .filter(e => e.buffer && e.holds === 0)
      .sort((a, b) => a.used - b.used)
    for (const e of victims) {
      if (total <= budget) break
      total -= bytesOf(e.buffer!)
      entries.delete(e.key)
    }
  }

  /* ---------- Worker ---------- */

  function stopWorker(): void {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = null
    worker?.terminate()
    worker = null
  }

  function workerFailed(): void {
    workerBroken = true
    stopWorker()
    const job = inflight
    inflight = null
    if (job) {
      clearTimeout(job.timer)
      job.fallback()
    }
  }

  function getWorker(): Worker | null {
    if (worker || workerBroken) return worker
    try {
      worker = createWorker()
    } catch {
      worker = null
    }
    if (!worker) {
      workerBroken = true
      return null
    }
    worker.onmessage = e => onReply(e.data)
    worker.onerror = workerFailed
    worker.onmessageerror = workerFailed
    return worker
  }

  function onReply(data: unknown): void {
    const job = inflight
    if (!job || !isRenderReply(data) || data.id !== job.id) return
    inflight = null
    clearTimeout(job.timer)
    if (data.ok) job.resolve(data.chs)
    else job.reject(new Error(data.error))
  }

  function generate(name: AssetName, sr: number): Promise<Float32Array[]> {
    const w = getWorker()
    if (!w) return runSliced(renderAsset(name, sr), CACHE.sliceMs)
    return new Promise((resolve, reject) => {
      const id = nextId++
      inflight = {
        id,
        resolve,
        reject,
        fallback: () => {
          runSliced(renderAsset(name, sr), CACHE.sliceMs).then(resolve, reject)
        },
        timer: setTimeout(workerFailed, CACHE.workerTimeoutMs),
      }
      const req: RenderRequest = { id, name, sr }
      w.postMessage(req)
    })
  }

  /* ---------- 队列 ---------- */

  function takeNext(): Job | null {
    if (!queue.length) return null
    let best = 0
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i]!
      const b = queue[best]!
      if (RANK[a.priority] < RANK[b.priority] || (a.priority === b.priority && a.seq < b.seq)) best = i
    }
    return queue.splice(best, 1)[0] ?? null
  }

  async function run(job: Job): Promise<void> {
    const e = job.entry
    try {
      if (job.priority === 'idle' && !getWorker()) await whenIdle()
      if (disposed) throw new Error('buffer store disposed')
      const chs = await generate(e.name, e.sr)
      if (disposed) throw new Error('buffer store disposed')
      e.buffer = makeBuffer(chs, e.sr)
      e.pending = null
      e.job = null
      touch(e)
      job.resolve(e.buffer)
      evict()
    } catch (err) {
      e.pending = null
      e.job = null
      if (!e.buffer && e.holds === 0) entries.delete(e.key)
      job.reject(err)
    }
  }

  function pump(): void {
    if (busy || disposed) return
    const job = takeNext()
    if (!job) {
      // 一阵子没活就关掉 Worker
      if (worker && !idleTimer) idleTimer = setTimeout(stopWorker, CACHE.workerIdleMs)
      return
    }
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = null
    busy = true
    void run(job).finally(() => {
      busy = false
      pump()
    })
  }

  function request(name: AssetName, ctxRate: number, priority: Priority): Promise<AudioBuffer> {
    if (disposed) return Promise.reject(new Error('buffer store disposed'))
    const e = entryFor(name, ctxRate)
    touch(e)
    if (e.buffer) return Promise.resolve(e.buffer)
    if (e.pending) {
      if (e.job && RANK[priority] < RANK[e.job.priority]) e.job.priority = priority
      return e.pending
    }
    e.pending = new Promise<AudioBuffer>((resolve, reject) => {
      const job: Job = { entry: e, priority, seq: seq++, resolve, reject }
      e.job = job
      queue.push(job)
    })
    pump()
    return e.pending
  }

  function hold(names: readonly AssetName[], ctxRate: number): () => void {
    const held = names.map(n => entryFor(n, ctxRate))
    for (const e of held) e.holds++
    let released = false
    return () => {
      if (released) return
      released = true
      for (const e of held) e.holds = Math.max(0, e.holds - 1)
      evict()
    }
  }

  function getter(names: readonly AssetName[], ctxRate: number): Buffers {
    const map = new Map<AssetName, AudioBuffer>()
    for (const n of names) {
      const b = entries.get(keyOf(n, assetRate(n, ctxRate)))?.buffer
      if (b) map.set(n, b)
    }
    return name => {
      const b = map.get(name)
      if (!b) throw new Error(`素材未就绪：${name}`)
      return b
    }
  }

  return {
    peek(name, ctxRate) {
      const e = entries.get(keyOf(name, assetRate(name, ctxRate)))
      if (!e?.buffer) return null
      touch(e)
      return e.buffer
    },
    ready(names, ctxRate) {
      for (const n of names) {
        const e = entries.get(keyOf(n, assetRate(n, ctxRate)))
        if (!e?.buffer) return null
        touch(e)
      }
      return getter(names, ctxRate)
    },
    async load(names, ctxRate, priority = 'now') {
      // 生成期间占用这一组：一组素材超过缓存上限的一部分时，后生成的那几个触发的淘汰
      // 会把同一组里先生成好的挤掉。取用函数直接用这次拿到的 AudioBuffer，不再回缓存里找
      const release = hold(names, ctxRate)
      try {
        const buffers = await Promise.all(names.map(n => request(n, ctxRate, priority)))
        const map = new Map(names.map((n, i) => [n, buffers[i]!]))
        return name => {
          const b = map.get(name)
          if (!b) throw new Error(`素材未就绪：${name}`)
          return b
        }
      } finally {
        release()
      }
    },
    hold,
    warm(names, ctxRate) {
      for (const n of names) request(n, ctxRate, 'idle').catch(() => undefined)
    },
    bytes() {
      let total = 0
      for (const e of entries.values()) if (e.buffer) total += bytesOf(e.buffer)
      return total
    },
    keys: () => [...entries.values()].filter(e => e.buffer).map(e => e.key),
    generator: () => (workerBroken ? 'main' : 'worker'),
    dispose() {
      if (disposed) return
      disposed = true
      const err = new Error('buffer store disposed')
      for (const job of queue.splice(0)) job.reject(err)
      const job = inflight
      inflight = null
      if (job) {
        clearTimeout(job.timer)
        job.reject(err)
      }
      stopWorker()
      entries.clear()
    },
  }
}
