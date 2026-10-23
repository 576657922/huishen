import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dayKey, dayPart } from '@/lib/date'
import { useRecommendationTime } from './useRecommendationTime'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
describe('recommendation time', () => {
  it('updates an open page when the evening recommendation begins', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 24, 17, 59, 59))
    const { result } = renderHook(useRecommendationTime)
    expect(dayPart(result.current)).toBe('afternoon')
    act(() => vi.advanceTimersByTime(1100))
    expect(dayPart(result.current)).toBe('evening')
  })
  it('refreshes the date at midnight and after a sleeping tab becomes visible', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 24, 23, 59, 59))
    const { result } = renderHook(useRecommendationTime)
    act(() => vi.advanceTimersByTime(1100))
    expect(dayKey(result.current)).toBe('2026-10-25')
    vi.setSystemTime(new Date(2026, 9, 26, 12))
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(dayKey(result.current)).toBe('2026-10-26')
    expect(dayPart(result.current)).toBe('midday')
  })
})
