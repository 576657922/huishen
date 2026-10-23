import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { buildPlan } from '@/app/plan'
import { prefsStore } from '@/data'
import type { SessionResult } from '@/engine'
import { connectHeartRate, type HeartRateMeasurement } from '@/hrv'
import { useStrap } from './useStrap'

vi.mock('@/hrv', async original => ({
  ...(await original<typeof import('@/hrv')>()),
  isBluetoothAvailable: () => Promise.resolve(true),
  connectHeartRate: vi.fn(),
}))
vi.mock('@/app/services', () => ({
  getController: () => ({
    getState: () => ({ plan: { practiceId: 'pace-finder' }, status: 'running' }),
    time: () => 12,
  }),
}))
let reading: ((m: HeartRateMeasurement) => void) | undefined
const device = {
  name: 'Test strap',
  connected: true,
  onReading: vi.fn((f: (m: HeartRateMeasurement) => void) => {
    reading = f
    return vi.fn()
  }),
  onDisconnect: () => vi.fn(),
  disconnect: vi.fn(),
  reconnect: vi.fn().mockResolvedValue(undefined),
}
beforeEach(() => {
  vi.clearAllMocks()
  reading = undefined
  vi.mocked(connectHeartRate).mockResolvedValue(device)
})
it('uses a heart-rate-only device without inventing RR metrics and disconnects on leave', async () => {
  const { result, unmount } = renderHook(() => useStrap())
  await act(async () => {})
  expect(result.current.available).toBe(true)
  await act(async () => result.current.connect())
  act(() => reading?.({ hr: 72, rr: [], contact: 'detected' }))
  expect(result.current.hr).toBe(72)
  const plan = buildPlan('pace-finder', 1, prefsStore.getState(), null)
  const metric = result.current.summarize({ plan } as SessionResult)
  expect(metric).toEqual({ meanHr: 72 })
  expect(result.current.combined()).toEqual({ meanHr: 72 })
  unmount()
  expect(device.disconnect).toHaveBeenCalledTimes(1)
})
it('disconnects a connection that completes after the page has gone away', async () => {
  let resolve: ((value: typeof device) => void) | undefined
  vi.mocked(connectHeartRate).mockReturnValue(
    new Promise(done => {
      resolve = done
    }),
  )
  const { result, unmount } = renderHook(() => useStrap())
  await act(async () => {})
  act(() => result.current.connect())
  unmount()
  await act(async () => resolve?.(device))
  expect(device.disconnect).toHaveBeenCalledTimes(1)
})
it('releases a reconnection that finishes after unmount', async () => {
  let resolve: (() => void) | undefined
  device.reconnect.mockReturnValueOnce(
    new Promise<void>(done => {
      resolve = done
    }),
  )
  const { result, unmount } = renderHook(() => useStrap())
  await act(async () => result.current.connect())
  act(() => result.current.reconnect())
  unmount()
  await act(async () => resolve?.())
  expect(device.disconnect).toHaveBeenCalledTimes(2)
})
