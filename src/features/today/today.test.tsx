import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROGRAM, RECORDS, TODAY } from '@/content/copy'
import { createMemorySessionRepo, prefsStore, setSessionRepo } from '@/data'
import { makeRecord } from '@/data/fixtures'
import { ToastHost } from '@/ui'
import { TodayPage } from './index'

const start = vi.fn()
vi.mock('@/app/flows', () => ({ startPractice: (...args: unknown[]) => start(...args) }))
let repo: ReturnType<typeof createMemorySessionRepo>
beforeEach(() => {
  prefsStore.getState().reset()
  repo = createMemorySessionRepo()
  setSessionRepo(repo)
  start.mockClear()
})
afterEach(() => {
  cleanup()
  setSessionRepo(null)
})
const show = () =>
  render(
    <MemoryRouter>
      <ToastHost>
        <TodayPage />
      </ToastHost>
    </MemoryRouter>,
  )

describe('today', () => {
  it('renders a recommendation and an empty week with one page heading', async () => {
    show()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /开始/ }).closest('section')).toHaveAttribute(
        'aria-busy',
        'false',
      ),
    )
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText(TODAY.week.value(0, 0))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /开始/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: TODAY.change }))
    fireEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ from: 'today' }))
  })
  it('welcomes a returning person with a one minute start', async () => {
    const at = new Date()
    at.setDate(at.getDate() - 4)
    await repo.add(makeRecord({ at }))
    show()
    await screen.findByText(TODAY.welcomeBack)
    fireEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ practiceId: 'pause', minutes: 1 }))
  })
  it('opens short coping choices and dials, then starts from a gesture', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: /现在有点难/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('link', { name: /求助方式/ })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /落地练习/ }))
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ practiceId: 'grounding', from: 'hard-moment' }),
    )
  })
  it('starts the next plan day with completion metadata', async () => {
    prefsStore.getState().startProgram('mindfulness-8w')
    show()
    await screen.findByText(/第 1 周第 1 天/)
    fireEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ programDay: expect.objectContaining({ day: 'w1d1', countsAsDay: true }) }),
    )
  })
  it('continues an unfinished plan when the more recently joined plan is complete', async () => {
    prefsStore.getState().set({
      programs: {
        'breathing-4w': { startedOn: '2026-01-01', done: [] },
        'mindfulness-8w': {
          startedOn: '2026-02-01',
          done: Array.from({ length: 56 }, (_, i) => `w${Math.floor(i / 7) + 1}d${(i % 7) + 1}`),
        },
      },
    })
    show()
    await screen.findByText(/四周呼吸 · 第 1 周第 1 天/)
    fireEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ programDay: expect.objectContaining({ programId: 'breathing-4w' }) }),
    )
  })
  it('keeps both parts of week seven consistent with the program page', async () => {
    const done = Array.from({ length: 42 }, (_, i) => `w${Math.floor(i / 7) + 1}d${(i % 7) + 1}`)
    prefsStore.getState().set({ programs: { 'mindfulness-8w': { startedOn: '2026-10-01', done } } })
    show()
    fireEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(start).toHaveBeenLastCalledWith(
      expect.objectContaining({
        practiceId: 'focus',
        minutes: 5,
        programDay: expect.objectContaining({ day: 'w7d1', countsAsDay: false }),
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: TODAY.change }))
    fireEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(start).toHaveBeenLastCalledWith(
      expect.objectContaining({
        practiceId: 'self-compassion',
        programDay: expect.objectContaining({ role: 'short', countsAsDay: true }),
      }),
    )
    await act(async () => {
      await repo.add(
        makeRecord({
          at: new Date(),
          actualSec: 300,
          params: { program: 'mindfulness-8w', programDay: 'w7d1' },
        }),
      )
    })
    await screen.findByText(PROGRAM.second)
    fireEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(start).toHaveBeenLastCalledWith(
      expect.objectContaining({
        practiceId: 'self-compassion',
        programDay: expect.objectContaining({ countsAsDay: true }),
      }),
    )
  })
  it('links a prescribed pace assessment to its dedicated flow', () => {
    const done = Array.from({ length: 21 }, (_, i) => `w${Math.floor(i / 7) + 1}d${(i % 7) + 1}`)
    prefsStore.getState().set({ programs: { 'breathing-4w': { startedOn: '2026-10-01', done } } })
    show()
    expect(screen.getByRole('link', { name: '舒适节律探索' })).toHaveAttribute('href', '/pace-finder')
    expect(screen.queryByRole('button', { name: /开始/ })).not.toBeInTheDocument()
  })
  it('offers one weekly self-check and saves a single answer', async () => {
    prefsStore.getState().set({ weeklyStress: true })
    show()
    fireEvent.click(screen.getByRole('button', { name: TODAY.weeklyStress }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: '4' }))
    expect(prefsStore.getState().stressRatings.at(-1)?.score).toBe(4)
    expect(screen.queryByRole('button', { name: RECORDS.weeklyStress.prompt })).not.toBeInTheDocument()
  })
})
