/**
 * IndexedDB 的结构与打开方式。练习记录会长年累积，所以放在 IndexedDB 而不是 localStorage。
 */
import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type { PracticeId } from '@/content/types'
import type { SessionRecord } from './types'

export const DB_NAME = 'huishen'
export const DB_VERSION = 1
export const SESSIONS = 'sessions'

export interface HuishenSchema extends DBSchema {
  sessions: {
    key: string
    value: SessionRecord
    indexes: { date: string; startedAt: string; practiceId: PracticeId }
  }
}

export type HuishenDB = IDBPDatabase<HuishenSchema>

export interface OpenCallbacks {
  /** 别的标签页要升级数据库，本连接挡着它 */
  onBlocking?: () => void
  /** 浏览器异常断开了连接（如 iOS 长时间在后台后） */
  onTerminated?: () => void
}

export function openHuishenDB(callbacks: OpenCallbacks = {}): Promise<HuishenDB> {
  return openDB<HuishenSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // 每个版本只写自己的增量，老用户才能逐级升级上来
      if (oldVersion < 1) {
        const store = db.createObjectStore(SESSIONS, { keyPath: 'id' })
        store.createIndex('date', 'date')
        store.createIndex('startedAt', 'startedAt')
        store.createIndex('practiceId', 'practiceId')
      }
    },
    blocking: () => callbacks.onBlocking?.(),
    terminated: () => callbacks.onTerminated?.(),
  })
}

/** Firefox 禁用 IndexedDB 时全局对象不存在；某些沙箱里访问它会抛错 */
export function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}
