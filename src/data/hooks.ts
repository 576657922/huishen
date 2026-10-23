/**
 * 数据层的 React 绑定。逻辑都在 repo、prefs、stats 里，这里只负责订阅与记忆化；
 * 数据层其余文件不依赖 React。
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useStore } from 'zustand'
import { addDays, dayKey, startOfDay } from '@/lib/date'
import { type PrefsState, prefsStore } from './prefs'
import { getSessionRepo, type LocalSessionRepo } from './repo'
import { computeStats, type RecordStats } from './stats'
import type { SessionRecord, SessionRepo, StorageMode } from './types'

/* ---------- 偏好 ---------- */

const selectAll = (state: PrefsState): PrefsState => state

/**
 * 读取偏好，变化时重新渲染。选择器应返回状态里已有的值（如 s => s.volume），
 * 不要每次新建对象或数组，否则每次读取都会被当作变化。
 */
export function usePrefs(): PrefsState
export function usePrefs<T>(selector: (state: PrefsState) => T): T
export function usePrefs(selector: (state: PrefsState) => unknown = selectAll): unknown {
  return useStore(prefsStore, selector)
}

/* ---------- 记录 ---------- */

export interface RecordsView {
  /** 按开始时间倒序 */
  records: SessionRecord[]
  /** 第一次读取完成前为 true */
  loading: boolean
  /** 最近一次读取失败的原因 */
  error: Error | null
}

interface RecordsSource {
  subscribe(listener: () => void): () => void
  getSnapshot(): RecordsView
}

const INITIAL: RecordsView = { records: [], loading: true, error: null }
const sources = new WeakMap<SessionRepo, RecordsSource>()

/**
 * 同一个仓库的所有组件共用一份读取结果：只在数据变化（含其他标签页）时重读，
 * 各组件拿到的是同一个数组，可以直接作为 useMemo 的依赖。
 */
function sourceFor(repo: SessionRepo): RecordsSource {
  let source = sources.get(repo)
  if (!source) {
    source = createSource(repo)
    sources.set(repo, source)
  }
  return source
}

function createSource(repo: SessionRepo): RecordsSource {
  let view = INITIAL
  let seq = 0
  let detach: (() => void) | null = null
  const listeners = new Set<() => void>()

  const publish = (next: RecordsView): void => {
    view = next
    for (const listener of [...listeners]) listener()
  }

  const load = (): void => {
    // 连续变化时只采用最后一次读取，免得慢的旧结果覆盖新结果
    const id = ++seq
    repo.all().then(
      records => {
        if (id === seq) publish({ records, loading: false, error: null })
      },
      (error: unknown) => {
        if (id === seq) publish({ records: view.records, loading: false, error: toError(error) })
      },
    )
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (!detach) {
        detach = repo.subscribe(load)
        load()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0 || !detach) return
        detach()
        detach = null
      }
    },
    getSnapshot: () => view,
  }
}

/** 全部练习记录（最新在前）；默认读全应用共用的仓库 */
export function useRecords(repo: SessionRepo = getSessionRepo()): RecordsView {
  const source = sourceFor(repo)
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)
}

/**
 * 记录页、今日页的统计。不传 now 时以当前时间计算，并在跨过午夜时自动刷新；
 * 传入 now 时请保持同一个时刻，每次渲染都新建 Date 会导致每次都重算。
 */
export function useStats(now?: Date): RecordStats & { loading: boolean } {
  const { records, loading } = useRecords()
  const today = useToday()
  // 无效的日期会让按日期取范围的统计抛错，整页因此白屏；当作没传处理
  const given = now?.getTime()
  const at = given !== undefined && Number.isFinite(given) ? given : today
  const stats = useMemo(
    () => computeStats(records, typeof at === 'number' ? new Date(at) : new Date()),
    [records, at],
  )
  return useMemo(() => ({ ...stats, loading }), [stats, loading])
}

/** 本地日期 YYYY-MM-DD，跨过午夜时更新 */
export function useToday(): string {
  const [today, setToday] = useState(() => dayKey(new Date()))
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = (): void => {
      const now = new Date()
      setToday(dayKey(now))
      clearTimeout(timer)
      // 多等一秒，免得定时器略早触发时还停在前一天
      timer = setTimeout(check, startOfDay(addDays(now, 1)).getTime() - now.getTime() + 1000)
    }
    check()
    // 手机休眠时定时器会被推迟，回到前台时再核对一次
    document.addEventListener('visibilitychange', check)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}

/** 记录存在哪里，给设置页显示；确定之后会自动更新 */
export function useStorageMode(repo: LocalSessionRepo = getSessionRepo()): StorageMode {
  useEffect(() => {
    repo.ready().catch(() => undefined)
  }, [repo])
  return useSyncExternalStore(repo.subscribe, repo.storageMode, repo.storageMode)
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
