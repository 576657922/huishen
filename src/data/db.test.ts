import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DB_NAME, DB_VERSION, hasIndexedDB, openHuishenDB, SESSIONS } from './db'
import { makeRecord } from './fixtures'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('openHuishenDB', () => {
  it('creates the sessions store keyed by id with the three lookup indexes', async () => {
    const db = await openHuishenDB()
    expect(db.name).toBe('huishen')
    expect(db.version).toBe(1)
    expect([...db.objectStoreNames]).toEqual([SESSIONS])
    const store = db.transaction(SESSIONS).store
    expect(store.keyPath).toBe('id')
    expect([...store.indexNames].sort()).toEqual(['date', 'practiceId', 'startedAt'])
    for (const name of ['date', 'practiceId', 'startedAt'] as const) {
      expect(store.index(name).keyPath).toBe(name)
      expect(store.index(name).unique).toBe(false)
    }
    db.close()
  })

  it('finds records through the indexes', async () => {
    const db = await openHuishenDB()
    const a = makeRecord({ at: new Date(2026, 9, 21, 7) })
    const b = makeRecord({ at: new Date(2026, 9, 22, 7), practiceId: 'slow', kind: 'paced' })
    await db.put(SESSIONS, a)
    await db.put(SESSIONS, b)
    expect((await db.getAllFromIndex(SESSIONS, 'date', '2026-10-22')).map(r => r.id)).toEqual([b.id])
    expect((await db.getAllFromIndex(SESSIONS, 'practiceId', 'focus')).map(r => r.id)).toEqual([a.id])
    expect((await db.getAllFromIndex(SESSIONS, 'startedAt')).map(r => r.id)).toEqual([a.id, b.id])
    db.close()
  })

  it('keeps the data when opened again', async () => {
    const first = await openHuishenDB()
    const record = makeRecord()
    await first.put(SESSIONS, record)
    first.close()
    const again = await openHuishenDB()
    expect(await again.get(SESSIONS, record.id)).toEqual(record)
    again.close()
  })

  it('tells the connection to step aside when another tab upgrades the database', async () => {
    const onBlocking = vi.fn()
    const db = await openHuishenDB({
      onBlocking: () => {
        onBlocking()
        db.close()
      },
    })
    const newer = await openDB(DB_NAME, DB_VERSION + 1)
    expect(onBlocking).toHaveBeenCalledTimes(1)
    newer.close()
  })
})

describe('hasIndexedDB', () => {
  it('detects IndexedDB', () => {
    expect(hasIndexedDB()).toBe(true)
  })

  it('is false when the browser disabled it', () => {
    vi.stubGlobal('indexedDB', undefined)
    expect(hasIndexedDB()).toBe(false)
    vi.stubGlobal('indexedDB', null)
    expect(hasIndexedDB()).toBe(false)
  })

  it('is false when touching it throws (sandboxed frames)', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
    try {
      expect(hasIndexedDB()).toBe(false)
    } finally {
      if (original) Object.defineProperty(globalThis, 'indexedDB', original)
      else Reflect.deleteProperty(globalThis, 'indexedDB')
    }
  })
})
