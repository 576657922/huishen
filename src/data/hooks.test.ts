import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { minutesOn } from './fixtures'
import { usePrefs, useRecords, useStats, useStorageMode, useToday } from './hooks'
import { prefsStore } from './prefs'
import { createSessionRepo, type LocalSessionRepo, setSessionRepo } from './repo'
import type { SessionRepo } from './types'

const repos: LocalSessionRepo[] = []

function memoryRepo(): LocalSessionRepo {
  const repo = createSessionRepo({ open: null, storage: null, channel: null })
  repos.push(repo)
  return repo
}

afterEach(() => {
  for (const repo of repos.splice(0)) repo.close()
  setSessionRepo(null)
  prefsStore.getState().reset()
  vi.useRealTimers()
})

describe('useRecords', () => {
  it('loads once, then follows changes', async () => {
    const repo = memoryRepo()
    const first = minutesOn(new Date(2026, 9, 21), 10)
    await repo.add(first)
    const { result } = renderHook(() => useRecords(repo))
    expect(result.current).toEqual({ records: [], loading: true, error: null })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.records).toEqual([first])

    const second = minutesOn(new Date(2026, 9, 22), 5)
    await act(() => repo.add(second))
    await waitFor(() => expect(result.current.records).toHaveLength(2))
    expect(result.current.records[0]?.id).toBe(second.id)
  })

  it('shares one snapshot between components', async () => {
    const repo = memoryRepo()
    await repo.add(minutesOn(new Date(2026, 9, 22), 5))
    const all = vi.spyOn(repo, 'all')
    const a = renderHook(() => useRecords(repo))
    const b = renderHook(() => useRecords(repo))
    await waitFor(() => expect(a.result.current.loading).toBe(false))
    expect(b.result.current.records).toBe(a.result.current.records)
    expect(all).toHaveBeenCalledTimes(1)
  })

  it('reports a failed read and keeps going', async () => {
    const broken: SessionRepo = {
      all: () => Promise.reject(new Error('读不到')),
      add: async () => undefined,
      update: async () => undefined,
      remove: async () => undefined,
      clear: async () => undefined,
      importMany: async () => ({ added: 0, skipped: 0 }),
      subscribe: () => () => undefined,
    }
    const { result } = renderHook(() => useRecords(broken))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe('读不到')
    expect(result.current.records).toEqual([])
  })

  it('stops listening to the repository when the last component unmounts', async () => {
    const repo = memoryRepo()
    const unsubscribe = vi.fn()
    vi.spyOn(repo, 'subscribe').mockImplementation(() => unsubscribe)
    const a = renderHook(() => useRecords(repo))
    const b = renderHook(() => useRecords(repo))
    a.unmount()
    expect(unsubscribe).not.toHaveBeenCalled()
    b.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('uses the shared repository by default', async () => {
    const repo = memoryRepo()
    setSessionRepo(repo)
    await repo.add(minutesOn(new Date(2026, 9, 22), 5))
    const { result } = renderHook(() => useRecords())
    await waitFor(() => expect(result.current.records).toHaveLength(1))
  })
})

describe('useStats', () => {
  it('derives statistics from the shared records and memoizes them', async () => {
    const repo = memoryRepo()
    setSessionRepo(repo)
    await repo.add(minutesOn(new Date(2026, 9, 22), 13))
    const now = new Date(2026, 9, 22, 21)
    const { result, rerender } = renderHook(() => useStats(now))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.today).toEqual({ seconds: 780, days: 1, sessions: 1 })
    expect(result.current.heatmap.find(c => c.today)?.level).toBe(3)

    const before = result.current
    rerender()
    expect(result.current).toBe(before)

    await act(() => repo.add(minutesOn(new Date(2026, 9, 21), 5)))
    await waitFor(() => expect(result.current.totals.sessions).toBe(2))
    expect(result.current.week.days).toBe(2)
  })

  it('follows the current local date when no moment is given', async () => {
    // 只假装日期，计时器照常走，waitFor 才能工作
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 22, 21))
    const repo = memoryRepo()
    setSessionRepo(repo)
    await repo.add(minutesOn(new Date(2026, 9, 19), 10))
    const { result, unmount } = renderHook(() => useStats())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.week).toEqual({ seconds: 600, days: 1, sessions: 1 })
    expect(result.current.weekDots.map(d => d.practiced)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ])
    expect(result.current.calendar.flat().find(d => d.today)?.key).toBe('2026-10-22')
    expect(result.current.welcomeBack).toBe(true)
    expect(result.current.recentDistress).toBe(false)
    unmount()
  })
})

describe('useStats with a broken moment', () => {
  it('uses the current time instead of crashing the page', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 22, 21))
    const repo = memoryRepo()
    setSessionRepo(repo)
    await repo.add(minutesOn(new Date(2026, 9, 22), 13))
    const { result } = renderHook(() => useStats(new Date(Number.NaN)))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.today).toEqual({ seconds: 780, days: 1, sessions: 1 })
  })
})

describe('usePrefs', () => {
  it('selects values and re-renders on change', () => {
    const { result } = renderHook(() => usePrefs(s => s.volume.master))
    expect(result.current).toBe(80)
    act(() => prefsStore.getState().setVolume('master', 35))
    expect(result.current).toBe(35)
  })

  it('returns the whole state, actions included, without a selector', () => {
    const { result } = renderHook(() => usePrefs())
    expect(result.current.theme).toBe('system')
    act(() => result.current.set({ theme: 'dark' }))
    expect(result.current.theme).toBe('dark')
  })
})

describe('useStorageMode', () => {
  it('reports where records live and updates once known', async () => {
    const memory = memoryRepo()
    expect(renderHook(() => useStorageMode(memory)).result.current).toBe('memory')

    const blocked = createSessionRepo({ open: () => Promise.reject(new Error('blocked')), channel: null })
    repos.push(blocked)
    const { result } = renderHook(() => useStorageMode(blocked))
    expect(result.current).toBe('indexeddb')
    await waitFor(() => expect(result.current).toBe('local'))
  })
})

describe('useToday', () => {
  it('rolls over at local midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 22, 23, 59, 30))
    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-10-22')
    act(() => vi.advanceTimersByTime(29_000))
    expect(result.current).toBe('2026-10-22')
    act(() => vi.advanceTimersByTime(3_000))
    expect(result.current).toBe('2026-10-23')
  })

  it('re-checks when the page becomes visible again', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 22, 8))
    const { result } = renderHook(() => useToday())
    // 手机休眠期间定时器没跑，系统时间已经是第二天
    vi.setSystemTime(new Date(2026, 9, 23, 8))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe('2026-10-23')
  })
})
