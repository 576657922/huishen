/**
 * 练习记录仓库。正常存在 IndexedDB；打不开时（被禁用、部分隐私模式、打开卡住）退到 localStorage，
 * 连 localStorage 也写不进时只留在内存里。写入后经 BroadcastChannel 通知其他标签页。
 */
import { type HuishenDB, hasIndexedDB, openHuishenDB, SESSIONS } from './db'
import { isPlainObject } from './guards'
import { byStartedAt, sanitizeRecord } from './record'
import { canWrite, getLocalStorage, readJSON, readText, removeKey, writeText } from './storage'
import type { SessionRecord, SessionRepo, StorageMode } from './types'

export { sanitizeRecord } from './record'

export const CHANNEL_NAME = 'huishen-data'
export const FALLBACK_KEY = 'huishen.sessions.fallback'
/** localStorage 只有几 MB，备用存储只保留最近的这么多条 */
export const FALLBACK_CAP = 500

// iOS Safari 有过首次打开 IndexedDB 永不返回的缺陷；等太久就先用备用存储，不让练习记录丢掉
const OPEN_TIMEOUT_MS = 4000
const MESSAGE = 'sessions-changed'

export interface LocalSessionRepo extends SessionRepo {
  /** 记录实际存在哪里；连接确定之前返回预期的方式 */
  storageMode(): StorageMode
  /** 等存储方式确定下来 */
  ready(): Promise<StorageMode>
  /** 关闭数据库连接和跨标签页通道 */
  close(): void
}

export interface SessionRepoOptions {
  /** 打开数据库，默认打开 IndexedDB；null 表示不用数据库 */
  open?: (() => Promise<HuishenDB>) | null
  /** 备用存储，默认 localStorage；null 表示没有 */
  storage?: Storage | null
  /** 跨标签页通道名；null 表示不同步 */
  channel?: string | null
  /** 打开数据库的最长等待毫秒数 */
  openTimeoutMs?: number
}

interface ImportCounts {
  added: number
  skipped: number
}

interface Backend {
  mode(): StorageMode
  all(): Promise<SessionRecord[]>
  put(record: SessionRecord): Promise<void>
  /** 在同一个事务里读出、修改、写回；记录不存在时返回 false */
  modify(id: string, change: (prev: SessionRecord) => SessionRecord): Promise<boolean>
  remove(id: string): Promise<void>
  clear(): Promise<void>
  importMany(records: SessionRecord[]): Promise<ImportCounts>
  /** 其他标签页改了数据 */
  refresh(): void
  close(): void
}

export function createSessionRepo(options: SessionRepoOptions = {}): LocalSessionRepo {
  const storage = options.storage === undefined ? getLocalStorage() : options.storage
  const timeoutMs = options.openTimeoutMs ?? OPEN_TIMEOUT_MS
  const listeners = new Set<() => void>()
  let pending: Promise<Backend> | null = null
  let live: Backend | null = null
  let guessed: StorageMode | null = null
  let closed = false

  const open = options.open === undefined ? defaultOpen() : options.open

  function defaultOpen(): (() => Promise<HuishenDB>) | null {
    if (!hasIndexedDB()) return null
    return () => openHuishenDB({ onBlocking: () => drop(), onTerminated: () => drop() })
  }

  function guess(): StorageMode {
    if (open) return 'indexeddb'
    return canWrite(storage) ? 'local' : 'memory'
  }

  function emit(): void {
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch (error) {
        // 一个订阅者出错不能让其他订阅者收不到通知
        queueMicrotask(() => {
          throw error
        })
      }
    }
  }

  const channel = openChannel(options.channel === undefined ? CHANNEL_NAME : options.channel, () => {
    live?.refresh()
    emit()
  })

  function changed(): void {
    channel.post()
    emit()
  }

  async function connect(): Promise<Backend> {
    if (open) {
      try {
        const db = await withTimeout(open(), timeoutMs)
        await migrateFallback(db, storage)
        return idbBackend(db, storage)
      } catch {
        // 打不开就退到备用存储：练习照常记录，设置页会说明记录存在哪里
      }
    }
    return fallbackBackend(storage)
  }

  function connected(): Promise<Backend> {
    if (closed) return Promise.reject(closedError())
    if (pending) return pending
    const before = repo.storageMode()
    pending = connect().then(backend => {
      // 打开期间仓库被关掉了：这个连接已经没人要，关掉以免一直占着数据库
      if (closed) {
        backend.close()
        throw closedError()
      }
      live = backend
      if (backend.mode() !== before) emit()
      return backend
    })
    return pending
  }

  /**
   * 连接断了或被别的标签页要求让路：丢掉它，下次操作时重新打开。
   * 传入 stale 时只在它仍是当前连接时才丢：并发的几个操作一起失败时，不能把别人刚重开的连接也关掉
   */
  function drop(stale?: Backend): void {
    if (stale && stale !== live) return
    const backend = live
    live = null
    pending = null
    backend?.close()
  }

  async function run<T>(op: (backend: Backend) => Promise<T>): Promise<T> {
    const backend = await connected()
    try {
      return await op(backend)
    } catch (error) {
      if (backend.mode() !== 'indexeddb' || !isConnectionLost(error)) throw error
      drop(backend)
      return op(await connected())
    }
  }

  const repo: LocalSessionRepo = {
    all: () => run(backend => backend.all()),

    async add(record) {
      const clean = sanitizeRecord(record)
      if (!clean) throw new TypeError('练习记录格式无效，未保存')
      await run(backend => backend.put(clean))
      changed()
    },

    async update(id, patch) {
      const found = await run(backend =>
        backend.modify(id, prev => {
          const merged: Record<string, unknown> = { ...prev, ...patch, id: prev.id, v: prev.v }
          // 练习前后的自评分两次填：练完补上练习后的分数，不能把练习前的冲掉
          if (isPlainObject(patch.checkin)) merged.checkin = { ...prev.checkin, ...patch.checkin }
          // 只改了开始时间时，本地日期要跟着重算，不能沿用旧的
          if (patch.startedAt !== undefined && patch.date === undefined) delete merged.date
          const next = sanitizeRecord(merged)
          if (!next) throw new TypeError('修改后的练习记录无效，未保存')
          return next
        }),
      )
      if (found) changed()
    },

    async remove(id) {
      await run(backend => backend.remove(id))
      changed()
    },

    async clear() {
      await run(backend => backend.clear())
      changed()
    },

    async importMany(records) {
      const valid = cleanList(records)
      const { added } = await run(backend => backend.importMany(valid))
      if (added > 0) changed()
      return { added, skipped: records.length - added }
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    storageMode() {
      if (live) return live.mode()
      guessed ??= guess()
      return guessed
    },

    ready: () => connected().then(backend => backend.mode()),

    close() {
      closed = true
      channel.close()
      drop()
      listeners.clear()
    },
  }
  return repo
}

let shared: LocalSessionRepo | null = null

/** 全应用共用的仓库，第一次用到时才创建 */
export function getSessionRepo(): LocalSessionRepo {
  shared ??= createSessionRepo()
  return shared
}

/** 替换共用的仓库（测试、演示数据）；传 null 则下次用到时重新创建默认仓库 */
export function setSessionRepo(repo: LocalSessionRepo | null): void {
  shared = repo
}

/** 只在内存里的仓库：不读写任何存储，也不与其他标签页同步。给其他模块的测试和演示用 */
export const createMemorySessionRepo = (): LocalSessionRepo =>
  createSessionRepo({ open: null, storage: null, channel: null })

/** 记录存在哪里，给设置页显示 */
export const storageMode = (): StorageMode => getSessionRepo().storageMode()

/* ---------- IndexedDB ---------- */

function idbBackend(db: HuishenDB, storage: Storage | null): Backend {
  return {
    mode: () => 'indexeddb',
    async all() {
      const list = await db.getAllFromIndex(SESSIONS, 'startedAt')
      // 存进去之前已经校验过；读出时再过一遍，防的是旧版本写坏或手动改坏的数据
      return cleanList(list).sort(newestFirst)
    },
    async put(record) {
      await db.put(SESSIONS, record)
    },
    async modify(id, change) {
      const tx = db.transaction(SESSIONS, 'readwrite')
      const prev = await tx.store.get(id)
      if (prev) await tx.store.put(change(prev))
      await tx.done
      return prev !== undefined
    },
    async remove(id) {
      await db.delete(SESSIONS, id)
    },
    async clear() {
      await db.clear(SESSIONS)
      // 「清空记录」要清得干净：备用存储里可能还有没迁移的旧记录
      removeKey(storage, FALLBACK_KEY)
    },
    importMany: records => idbImport(db, records),
    refresh: () => undefined,
    close: () => db.close(),
  }
}

async function idbImport(db: HuishenDB, records: readonly SessionRecord[]): Promise<ImportCounts> {
  const tx = db.transaction(SESSIONS, 'readwrite')
  const known = new Set(await tx.store.getAllKeys())
  const writes: Promise<unknown>[] = []
  for (const record of records) {
    if (known.has(record.id)) continue
    known.add(record.id)
    writes.push(tx.store.put(record))
  }
  await Promise.all([...writes, tx.done])
  return { added: writes.length, skipped: records.length - writes.length }
}

/** 以前某次退到了备用存储，现在数据库能用了：把那些记录并进数据库，免得被遗忘 */
async function migrateFallback(db: HuishenDB, storage: Storage | null): Promise<void> {
  if (readText(storage, FALLBACK_KEY) === null) return
  const raw = readJSON(storage, FALLBACK_KEY)
  try {
    if (Array.isArray(raw)) await idbImport(db, cleanList(raw))
    removeKey(storage, FALLBACK_KEY)
  } catch {
    // 留在备用存储里，下次打开时再试
  }
}

function withTimeout(promise: Promise<HuishenDB>, ms: number): Promise<HuishenDB> {
  return new Promise((resolve, reject) => {
    let late = false
    const timer = setTimeout(() => {
      late = true
      reject(new Error('打开数据库超时'))
    }, ms)
    promise.then(
      db => {
        // 超时之后才打开的连接没人用了，关掉以免挡住以后的升级
        if (late) db.close()
        else {
          clearTimeout(timer)
          resolve(db)
        }
      },
      error => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function closedError(): Error {
  return new Error('记录仓库已关闭')
}

// Safari 在后台久了会断开连接，之后的操作报 InvalidStateError 或 UnknownError；重新打开即可恢复
function isConnectionLost(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('name' in error)) return false
  return error.name === 'InvalidStateError' || error.name === 'UnknownError'
}

/* ---------- 备用存储：内存，能写时同步到 localStorage ---------- */

function fallbackBackend(storage: Storage | null): Backend {
  let persisted = canWrite(storage)
  let list = load()

  function load(): SessionRecord[] {
    const raw = readJSON(storage, FALLBACK_KEY)
    return Array.isArray(raw) ? newestCapped(cleanList(raw)) : []
  }

  function save(next: SessionRecord[]): void {
    list = newestCapped(next)
    // 写不进（空间满）就如实变成 memory，设置页会提醒用户导出
    persisted = writeText(storage, FALLBACK_KEY, JSON.stringify(list))
  }

  return {
    mode: () => (persisted ? 'local' : 'memory'),
    all: async () => [...list],
    async put(record) {
      save([record, ...list.filter(r => r.id !== record.id)])
    },
    async modify(id, change) {
      const prev = list.find(r => r.id === id)
      if (!prev) return false
      save(list.map(r => (r === prev ? change(prev) : r)))
      return true
    },
    async remove(id) {
      save(list.filter(r => r.id !== id))
    },
    async clear() {
      list = []
      removeKey(storage, FALLBACK_KEY)
    },
    async importMany(records) {
      const known = new Set(list.map(r => r.id))
      const fresh: SessionRecord[] = []
      for (const record of records) {
        if (known.has(record.id)) continue
        known.add(record.id)
        fresh.push(record)
      }
      save([...list, ...fresh])
      // 超出上限被挤掉的不算导入成功
      const kept = new Set(list.map(r => r.id))
      const added = fresh.filter(r => kept.has(r.id)).length
      return { added, skipped: records.length - added }
    },
    refresh() {
      // 只有真的写进 localStorage 时，其他标签页的变化才读得到；纯内存模式不能用空列表覆盖自己
      if (persisted) list = load()
    },
    close: () => undefined,
  }
}

/* ---------- 跨标签页通知 ---------- */

interface Channel {
  post(): void
  close(): void
}

const NO_CHANNEL: Channel = { post: () => undefined, close: () => undefined }

function openChannel(name: string | null, onChange: () => void): Channel {
  if (!name || typeof BroadcastChannel === 'undefined') return NO_CHANNEL
  let bc: BroadcastChannel
  try {
    bc = new BroadcastChannel(name)
  } catch {
    return NO_CHANNEL
  }
  bc.onmessage = (event: MessageEvent<unknown>) => {
    if (isPlainObject(event.data) && event.data.type === MESSAGE) onChange()
  }
  return {
    post() {
      try {
        bc.postMessage({ type: MESSAGE })
      } catch {
        // 通道已关闭：本页仍会收到通知，只是其他标签页要等下次刷新
      }
    },
    close: () => bc.close(),
  }
}

/* ---------- 工具 ---------- */

function cleanList(list: readonly unknown[]): SessionRecord[] {
  const out: SessionRecord[] = []
  for (const item of list) {
    const record = sanitizeRecord(item)
    if (record) out.push(record)
  }
  return out
}

const newestFirst = (a: SessionRecord, b: SessionRecord): number => byStartedAt(b, a)

function newestCapped(list: SessionRecord[]): SessionRecord[] {
  return [...list].sort(newestFirst).slice(0, FALLBACK_CAP)
}
