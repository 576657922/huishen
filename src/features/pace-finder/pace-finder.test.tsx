import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_SESSION, sessionStore } from '@/app/flows'
import { PACE_FINDER, PLAYER } from '@/content/copy'
import { createMemorySessionRepo, prefsStore, setSessionRepo } from '@/data'
import type { SessionController, SessionResult, SessionState } from '@/engine'
import { ToastHost } from '@/ui'
import { PaceFinderPage } from './index'

vi.mock('@/app/services', () => ({
  getController: () => controller,
  getRepo: () => repo,
  getTimeScale: () => 1,
}))
vi.mock('@/hrv', async original => ({
  ...(await original<typeof import('@/hrv')>()),
  isBluetoothAvailable: () => Promise.resolve(false),
}))
vi.mock('@/widgets/SessionStage', () => ({ PacedStage: () => <div /> }))
let state: SessionState,
  time = 0,
  repo: ReturnType<typeof createMemorySessionRepo>
const listeners = new Set<() => void>(),
  finished = new Set<(result: SessionResult) => void>()
const update = (patch: Partial<SessionState>): void => {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}
function complete(completed = true, seconds = 60): void {
  const result: SessionResult = {
    plan: state.plan!,
    startedAt: new Date().toISOString(),
    practicedSec: seconds,
    completed,
    marks: [],
    count: null,
    breaths: 6,
    finalRate: state.rate,
    rateSteps: 0,
    skipped: [],
  }
  update({ status: 'done' })
  for (const listener of finished) listener(result)
}
const controller: SessionController = {
  getState: () => state,
  time: () => time,
  subscribe: listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  onFinish: listener => {
    finished.add(listener)
    return () => finished.delete(listener)
  },
  start: vi.fn(async plan => update({ plan, status: 'running', rate: Number(plan.params.rate), endSec: 60 })),
  reset: () => update({ status: 'idle' }),
  pause: () => update({ status: 'paused' }),
  resume: () => update({ status: 'running' }),
  end: vi.fn(() => {
    if (['running', 'paused', 'lead'].includes(state.status)) complete(false, time)
  }),
  breathAt: () => null,
  mark: vi.fn(),
  countTap: vi.fn(),
  stepBack: vi.fn(),
  skipSection: vi.fn(),
  setSound: vi.fn(),
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  prefsStore.getState().reset()
  prefsStore.getState().set({ safety: { ackOn: '2026-10-24' }, personalRate: 4.5 })
  sessionStore.setState({ ...INITIAL_SESSION })
  repo = createMemorySessionRepo()
  setSessionRepo(repo)
  listeners.clear()
  finished.clear()
  time = 0
  state = {
    status: 'idle',
    plan: null,
    startedAt: null,
    marks: [],
    count: null,
    caption: null,
    phaseIndex: -1,
    silentEnding: false,
    endReason: null,
    practicedSec: 0,
    audio: 'off',
    rate: null,
    section: null,
    endSec: null,
  }
})
afterEach(async () => {
  cleanup()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
  setSessionRepo(null)
  vi.useRealTimers()
})
function show() {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={['/pace-finder']}>
        <ToastHost>
          <Routes>
            <Route path="/pace-finder" element={<PaceFinderPage />} />
            <Route path="/practices/*" element={<h1>Catalogue</h1>} />
          </Routes>
        </ToastHost>
      </MemoryRouter>
    </StrictMode>,
  )
}
async function advance() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
}
async function rateAll(values = [3, 3, 3, 3, 3]) {
  fireEvent.click(screen.getByRole('button', { name: /^开始/ }))
  for (const value of values) {
    act(() => complete())
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: PACE_FINDER.rating.question })).getByRole('radio', {
        name: String(value),
      }),
    )
    await advance()
  }
}
describe('pace finder', () => {
  it('runs five rates in order, requires ratings and saves a single completed record', async () => {
    show()
    await act(async () => {})
    expect(screen.queryByRole('button', { name: PACE_FINDER.strap.connect })).not.toBeInTheDocument()
    await rateAll([2, 4, 5, 3, 1])
    expect(vi.mocked(controller.start).mock.calls.map(([plan]) => plan.params.rate)).toEqual([
      6.5, 6, 5.5, 5, 4.5,
    ])
    expect(screen.getByRole('heading', { name: PACE_FINDER.result.title })).toBeInTheDocument()
    const records = await repo.all()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ actualSec: 300, params: { steps: 5, rate: 5.5 } })
    expect(prefsStore.getState().personalRate).toBe(4.5)
    fireEvent.click(screen.getByRole('button', { name: PACE_FINDER.result.apply }))
    await advance()
    expect(prefsStore.getState().practice.slow?.rate).toBe(5.5)
    expect(prefsStore.getState().personalRate).toBe(5.5)
  })
  it('keeps the existing rate when the result is dismissed, including tied ratings', async () => {
    show()
    await rateAll()
    expect(screen.getByRole('row', { name: /5.5/ })).toHaveAttribute('data-chosen', 'true')
    fireEvent.click(screen.getByRole('button', { name: PACE_FINDER.result.dismiss }))
    await advance()
    expect(prefsStore.getState().personalRate).toBe(4.5)
    expect(await repo.all()).toHaveLength(1)
  })
  it('does not dismiss a rating with Escape or submit it twice', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: /^开始/ }))
    act(() => complete())
    fireEvent.keyDown(document, { key: 'Escape' })
    const group = screen.getByRole('radiogroup', { name: PACE_FINDER.rating.question })
    expect(group).toBeInTheDocument()
    fireEvent.click(within(group).getByRole('radio', { name: '4' }))
    fireEvent.click(within(group).getByRole('radio', { name: '4' }))
    expect(controller.start).toHaveBeenCalledTimes(2)
  })
  it('merges a partly completed run into one record after confirming its end', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: /^开始/ }))
    act(() => complete())
    fireEvent.click(screen.getByRole('radio', { name: '3' }))
    await advance()
    time = 30
    fireEvent.click(screen.getAllByRole('button', { name: PLAYER.end })[0]!)
    expect(await repo.all()).toHaveLength(0)
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: PLAYER.endDialog.confirm }),
    )
    await advance()
    expect(await repo.all()).toMatchObject([{ actualSec: 90, completed: false, params: { steps: 2 } }])
  })
  it('preserves an inherited first step through StrictMode and saves it once on actual unmount', async () => {
    state = {
      ...state,
      status: 'running',
      plan: {
        ...(await import('@/app/plan')).buildPlan('pace-finder', 1, prefsStore.getState(), null, {
          params: { rate: 6.5, step: 1 },
        }),
      },
    }
    const page = show()
    await advance()
    expect(controller.end).not.toHaveBeenCalled()
    time = 65
    page.unmount()
    await advance()
    expect(await repo.all()).toHaveLength(1)
  })
})
