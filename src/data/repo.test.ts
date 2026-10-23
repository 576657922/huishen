import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DB_NAME, DB_VERSION, type HuishenDB, openHuishenDB, SESSIONS } from './db'
import { makeRecord } from './fixtures'
import {
  createMemorySessionRepo,
  createSessionRepo,
  FALLBACK_CAP,
  FALLBACK_KEY,
  getSessionRepo,
  type LocalSessionRepo,
  type SessionRepoOptions,
  sanitizeRecord,
  setSessionRepo,
  storageMode,
} from './repo'

const repos: LocalSessionRepo[] = []
let channel = 0

/** 每个测试用独立的通道名，避免测试之间互相广播 */
function repo(options: SessionRepoOptions = {}): LocalSessionRepo {
  const r = createSessionRepo({ channel: `test-${channel}`, ...options })
  repos.push(r)
  return r
}

/** 等某个仓库收到下一次变化通知 */
function nextChange(r: LocalSessionRepo): Promise<void> {
  return new Promise(resolve => {
    const off = r.subscribe(() => {
      off()
      resolve()
    })
  })
}

const failingOpen = () => Promise.reject(new DOMException('blocked', 'SecurityError'))

/** 模拟 Safari 旧版隐私模式：localStorage 存在，但写入一律抛错 */
function readOnlyStorage(): Storage {
  return {
    length: 0,
    clear: () => undefined,
    getItem: () => null,
    key: () => null,
    removeItem: () => undefined,
    setItem: () => {
      throw new DOMException('quota', 'QuotaExceededError')
    },
  }
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
  channel++
})

afterEach(() => {
  for (const r of repos.splice(0)) r.close()
  setSessionRepo(null)
})

describe('IndexedDB repository', () => {
  it('stores records and lists them newest first', async () => {
    const r = repo()
    const older = makeRecord({ at: new Date(2026, 9, 20, 7) })
    const newer = makeRecord({ at: new Date(2026, 9, 22, 7) })
    const middle = makeRecord({ at: new Date(2026, 9, 21, 21) })
    await r.add(older)
    await r.add(newer)
    await r.add(middle)
    expect((await r.all()).map(x => x.id)).toEqual([newer.id, middle.id, older.id])
    expect(r.storageMode()).toBe('indexeddb')
    expect(await r.ready()).toBe('indexeddb')
  })

  it('sanitizes on write and rejects invalid records', async () => {
    const r = repo()
    const record = { ...makeRecord(), extra: 'dropped' }
    await r.add(record)
    expect(await r.all()).toEqual([sanitizeRecord(record)])
    await expect(r.add({ ...makeRecord(), practiceId: 'qigong' as never })).rejects.toThrow(TypeError)
  })

  it('treats add as an upsert so a retried save is not duplicated', async () => {
    const r = repo()
    const record = makeRecord()
    await r.add(record)
    await r.add({ ...record, note: '补一句' })
    const all = await r.all()
    expect(all).toHaveLength(1)
    expect(all[0]?.note).toBe('补一句')
  })

  it('updates with a shallow merge and ignores missing ids', async () => {
    const r = repo()
    const record = makeRecord({ checkin: { pre: 6 } })
    await r.add(record)
    await r.update(record.id, { checkin: { pre: 6, post: 2 }, note: '平静' })
    expect((await r.all())[0]).toMatchObject({ id: record.id, checkin: { pre: 6, post: 2 }, note: '平静' })
    await r.update(record.id, { note: undefined })
    expect((await r.all())[0]?.note).toBeUndefined()
    const listener = vi.fn()
    r.subscribe(listener)
    await r.update('missing', { note: 'x' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('adds the after-practice rating without losing the one from before', async () => {
    const r = repo()
    const record = makeRecord({ checkin: { pre: 6 } })
    await r.add(record)
    // 练习前问过一次，练完再补练习后的那一次
    await r.update(record.id, { checkin: { post: 3 }, feeling: 'calmer' })
    expect((await r.all())[0]).toMatchObject({ checkin: { pre: 6, post: 3 }, feeling: 'calmer' })
    await r.update(record.id, { checkin: { post: undefined } })
    expect((await r.all())[0]?.checkin).toEqual({ pre: 6 })
    await r.update(record.id, { checkin: undefined })
    expect((await r.all())[0]).not.toHaveProperty('checkin')
    // 原来没有自评的记录也能直接补上
    await r.update(record.id, { checkin: { post: 2 } })
    expect((await r.all())[0]?.checkin).toEqual({ post: 2 })
  })

  it('merges the check-in the same way in fallback storage', async () => {
    const r = repo({ open: failingOpen })
    const record = makeRecord({ checkin: { pre: 7 } })
    await r.add(record)
    await r.update(record.id, { checkin: { post: 4 } })
    expect(r.storageMode()).toBe('local')
    expect((await r.all())[0]?.checkin).toEqual({ pre: 7, post: 4 })
  })

  it('refuses an update that would make the record invalid', async () => {
    const r = repo()
    const record = makeRecord()
    await r.add(record)
    await expect(r.update(record.id, { kind: 'nope' as never })).rejects.toThrow(TypeError)
    expect((await r.all())[0]?.kind).toBe('focus')
  })

  it('removes and clears', async () => {
    const r = repo()
    const a = makeRecord()
    const b = makeRecord()
    await r.add(a)
    await r.add(b)
    await r.remove(a.id)
    expect((await r.all()).map(x => x.id)).toEqual([b.id])
    localStorage.setItem(FALLBACK_KEY, '[]')
    await r.clear()
    expect(await r.all()).toEqual([])
    expect(localStorage.getItem(FALLBACK_KEY)).toBeNull()
  })

  it('imports by id without duplicates and counts invalid entries as skipped', async () => {
    const r = repo()
    const existing = makeRecord()
    await r.add(existing)
    const fresh = makeRecord()
    const result = await r.importMany([existing, fresh, fresh, { ...makeRecord(), id: '' }])
    expect(result).toEqual({ added: 1, skipped: 3 })
    expect((await r.all()).map(x => x.id).sort()).toEqual([existing.id, fresh.id].sort())
  })

  it('notifies subscribers after every write until unsubscribed', async () => {
    const r = repo()
    const listener = vi.fn()
    const off = r.subscribe(listener)
    const record = makeRecord()
    await r.add(record)
    await r.update(record.id, { note: 'x' })
    await r.remove(record.id)
    await r.clear()
    await r.importMany([makeRecord()])
    expect(listener).toHaveBeenCalledTimes(5)
    off()
    await r.add(makeRecord())
    expect(listener).toHaveBeenCalledTimes(5)
  })

  it('keeps notifying other subscribers when one throws, and still reports the error', async () => {
    const r = repo()
    const good = vi.fn()
    const deferred: VoidFunction[] = []
    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(task => deferred.push(task))
    r.subscribe(() => {
      throw new Error('bad listener')
    })
    r.subscribe(good)
    await r.add(makeRecord())
    expect(good).toHaveBeenCalledTimes(1)
    expect(deferred).toHaveLength(1)
    expect(() => deferred[0]?.()).toThrow('bad listener')
  })

  it('skips corrupted rows on read', async () => {
    const r = repo()
    const good = makeRecord()
    await r.add(good)
    const db = await openHuishenDB()
    await db.put(SESSIONS, { ...makeRecord(), actualSec: 'lots' } as never)
    db.close()
    expect((await r.all()).map(x => x.id)).toEqual([good.id])
  })

  it('reopens the database once when the connection was lost', async () => {
    const opened: HuishenDB[] = []
    const r = repo({
      open: async () => {
        const db = await openHuishenDB()
        opened.push(db)
        return db
      },
    })
    await r.add(makeRecord())
    opened[0]?.close()
    await r.add(makeRecord())
    expect(opened).toHaveLength(2)
    expect(await r.all()).toHaveLength(2)
  })

  it('reopens only once when several operations hit the lost connection together', async () => {
    const opened: HuishenDB[] = []
    const r = repo({
      open: async () => {
        const db = await openHuishenDB()
        opened.push(db)
        return db
      },
    })
    await r.all()
    opened[0]?.close()
    // 三个操作同时失败：后两个不能把第一个刚重开的连接再关掉，也不能各开一个
    await Promise.all([r.add(makeRecord()), r.add(makeRecord()), r.all()])
    expect(opened).toHaveLength(2)
    expect(await r.all()).toHaveLength(2)
  })

  it('steps aside when a newer version of the app upgrades the database, and keeps saving', async () => {
    const r = repo()
    await r.add(makeRecord())
    // 新版本在另一个标签页里把数据库升到下一版：这里的连接必须让路，否则那边的升级会一直卡住
    const newer = await openDB(DB_NAME, DB_VERSION + 1)
    newer.close()
    // 旧代码打不开新版的数据库：先存进备用存储，这个标签页刷新成新版本后会并回数据库
    const record = makeRecord()
    await r.add(record)
    expect(r.storageMode()).toBe('local')
    expect(JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? '[]')).toEqual([record])
  })

  it('syncs other tabs through BroadcastChannel', async () => {
    const tabA = repo()
    const tabB = repo()
    await tabB.all()
    const changed = nextChange(tabB)
    const record = makeRecord()
    await tabA.add(record)
    await changed
    expect((await tabB.all()).map(x => x.id)).toEqual([record.id])
  })

  it('rejects operations after close', async () => {
    const r = repo()
    r.close()
    await expect(r.all()).rejects.toThrow()
  })

  it('closes a connection that finishes opening after the repository was closed', async () => {
    const resolvers: ((db: HuishenDB) => void)[] = []
    const r = repo({ open: () => new Promise<HuishenDB>(resolve => resolvers.push(resolve)) })
    const pending = r.all()
    r.close()
    const db = await openHuishenDB()
    resolvers[0]?.(db)
    await expect(pending).rejects.toThrow()
    expect(() => db.transaction(SESSIONS)).toThrow()
  })

  it('recomputes the local date when only the start time changes', async () => {
    const r = repo()
    const record = makeRecord({ at: new Date(2026, 9, 22, 7, 30) })
    await r.add(record)
    await r.update(record.id, { startedAt: new Date(2026, 9, 21, 22, 0).toISOString() })
    expect((await r.all())[0]?.date).toBe('2026-10-21')
  })
})

describe('fallback storage', () => {
  it('falls back to localStorage when IndexedDB cannot be opened', async () => {
    const r = repo({ open: failingOpen })
    const record = makeRecord()
    await r.add(record)
    expect(await r.ready()).toBe('local')
    expect(r.storageMode()).toBe('local')
    expect(JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? '[]')).toEqual([record])
    // 下次打开（同样打不开数据库）时仍然读得到
    const again = repo({ open: failingOpen })
    expect(await again.all()).toEqual([record])
  })

  it('falls back when IndexedDB does not exist at all', async () => {
    const original = globalThis.indexedDB
    // @ts-expect-error 模拟禁用了 IndexedDB 的浏览器
    delete globalThis.indexedDB
    try {
      const r = repo()
      expect(r.storageMode()).toBe('local')
      await r.add(makeRecord())
      expect(await r.ready()).toBe('local')
    } finally {
      globalThis.indexedDB = original
    }
  })

  it('falls back when opening hangs, and closes the connection that arrives too late', async () => {
    const resolvers: ((db: HuishenDB) => void)[] = []
    const r = repo({
      openTimeoutMs: 20,
      open: () => new Promise<HuishenDB>(resolve => resolvers.push(resolve)),
    })
    expect(await r.ready()).toBe('local')
    const late = await openHuishenDB()
    resolvers[0]?.(late)
    // 连接关闭后再开事务会抛 InvalidStateError
    await vi.waitFor(() => expect(() => late.transaction(SESSIONS)).toThrow())
    expect(r.storageMode()).toBe('local')
  })

  it('caps the fallback at the newest records', async () => {
    const r = repo({ open: failingOpen })
    const day = (i: number) => new Date(2026, 0, 1, 7, 0, i)
    const records = Array.from({ length: FALLBACK_CAP + 20 }, (_, i) => makeRecord({ at: day(i) }))
    const result = await r.importMany(records)
    expect(result).toEqual({ added: FALLBACK_CAP, skipped: 20 })
    const all = await r.all()
    expect(all).toHaveLength(FALLBACK_CAP)
    expect(all.at(-1)?.startedAt).toBe(day(20).toISOString())
  })

  it('keeps records in memory when nothing can be written', async () => {
    const memory = repo({ open: null, storage: null })
    expect(memory.storageMode()).toBe('memory')
    await memory.add(makeRecord())
    expect(await memory.all()).toHaveLength(1)
    expect(await memory.ready()).toBe('memory')

    const readOnly = repo({ open: null, storage: readOnlyStorage() })
    await readOnly.add(makeRecord())
    expect(readOnly.storageMode()).toBe('memory')
    expect(await readOnly.all()).toHaveLength(1)
  })

  it('reports memory mode once a write stops fitting', async () => {
    const storage = window.localStorage
    const r = repo({ open: null, storage })
    await r.add(makeRecord())
    expect(r.storageMode()).toBe('local')
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await r.add(makeRecord())
    expect(r.storageMode()).toBe('memory')
    expect(await r.all()).toHaveLength(2)
    spy.mockRestore()
  })

  it('ignores corrupted fallback data', async () => {
    localStorage.setItem(FALLBACK_KEY, '{not json')
    expect(await repo({ open: failingOpen }).all()).toEqual([])
    localStorage.setItem(FALLBACK_KEY, JSON.stringify([makeRecord(), { id: 'broken' }, 7]))
    expect(await repo({ open: failingOpen }).all()).toHaveLength(1)
  })

  it('updates, removes and clears in fallback mode', async () => {
    const r = repo({ open: failingOpen })
    const a = makeRecord()
    const b = makeRecord()
    await r.importMany([a, b])
    await r.update(a.id, { note: '好' })
    await r.remove(b.id)
    expect(await r.all()).toEqual([{ ...a, note: '好' }])
    await r.clear()
    expect(await r.all()).toEqual([])
    expect(localStorage.getItem(FALLBACK_KEY)).toBeNull()
  })

  it('syncs other tabs in fallback mode by re-reading localStorage', async () => {
    const tabA = repo({ open: failingOpen })
    const tabB = repo({ open: failingOpen })
    await tabB.all()
    const changed = nextChange(tabB)
    const record = makeRecord()
    await tabA.add(record)
    await changed
    expect(await tabB.all()).toEqual([record])
  })

  it('migrates fallback records into IndexedDB once it works again', async () => {
    const stranded = makeRecord()
    localStorage.setItem(FALLBACK_KEY, JSON.stringify([stranded, { junk: true }]))
    const r = repo()
    const existing = makeRecord()
    await r.add(existing)
    expect((await r.all()).map(x => x.id).sort()).toEqual([existing.id, stranded.id].sort())
    expect(localStorage.getItem(FALLBACK_KEY)).toBeNull()
    expect(r.storageMode()).toBe('indexeddb')
  })
})

describe('shared repository', () => {
  it('creates one repository lazily and can be replaced', async () => {
    const a = getSessionRepo()
    repos.push(a)
    expect(getSessionRepo()).toBe(a)
    expect(storageMode()).toBe('indexeddb')
    const custom = repo({ open: null, storage: null })
    setSessionRepo(custom)
    expect(getSessionRepo()).toBe(custom)
    expect(storageMode()).toBe('memory')
  })

  it('offers a memory-only repository for tests and demos', async () => {
    const memory = createMemorySessionRepo()
    repos.push(memory)
    const write = vi.spyOn(Storage.prototype, 'setItem')
    await memory.add(makeRecord())
    expect(await memory.all()).toHaveLength(1)
    expect(memory.storageMode()).toBe('memory')
    expect(write).not.toHaveBeenCalled()
  })
})
