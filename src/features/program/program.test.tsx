import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROGRAM, RECORDS } from '@/content/copy'
import { createMemorySessionRepo, getSessionRepo, prefsStore, setSessionRepo } from '@/data'
import { makeRecord } from '@/data/fixtures'
import { ToastHost } from '@/ui'
import { ProgramPage } from './index'

const start = vi.fn()
vi.mock('@/app/flows', () => ({ startPractice: (...args: unknown[]) => start(...args) }))
beforeEach(() => {
  prefsStore.getState().reset()
  setSessionRepo(createMemorySessionRepo())
  start.mockClear()
})
afterEach(() => {
  cleanup()
  setSessionRepo(null)
})
const show = (id = 'mindfulness-8w') =>
  render(
    <MemoryRouter initialEntries={[`/program/${id}`]}>
      <ToastHost>
        <Routes>
          <Route path="/program/:id" element={<ProgramPage />} />
        </Routes>
      </ToastHost>
    </MemoryRouter>,
  )
describe('program', () => {
  it('joins a plan and starts the first day with its completion metadata', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: PROGRAM.join }))
    expect(prefsStore.getState().programs['mindfulness-8w']?.done).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: /^开始/ }))
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'program',
        practiceId: 'focus',
        programDay: expect.objectContaining({ day: 'w1d1', countsAsDay: true }),
      }),
    )
  })
  it('advances by completed days, and supports short and long durations', () => {
    const prefs = prefsStore.getState()
    prefs.startProgram('mindfulness-8w', '2026-01-01')
    prefs.completeProgramDay('mindfulness-8w', 'w1d1', '2026-01-01')
    show()
    fireEvent.click(screen.getByRole('radio', { name: PROGRAM.long }))
    fireEvent.click(screen.getByRole('button', { name: /^开始/ }))
    expect(start).toHaveBeenLastCalledWith(
      expect.objectContaining({ minutes: 20, programDay: expect.objectContaining({ day: 'w1d2' }) }),
    )
    fireEvent.click(screen.getByRole('radio', { name: PROGRAM.roles.short }))
    fireEvent.click(screen.getByRole('button', { name: /^开始/ }))
    expect(start).toHaveBeenLastCalledWith(expect.objectContaining({ minutes: 5 }))
  })
  it('requires confirmation before leaving and preserves records', () => {
    prefsStore.getState().startProgram('mindfulness-8w')
    show()
    fireEvent.click(screen.getByRole('button', { name: PROGRAM.leave }))
    expect(prefsStore.getState().programs['mindfulness-8w']).toBeDefined()
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: PROGRAM.leaveDialog.confirm }),
    )
    expect(prefsStore.getState().programs['mindfulness-8w']).toBeUndefined()
  })
  it('asks a weekly stress question without showing the previous answer', () => {
    prefsStore.getState().set({ weeklyStress: true })
    show()
    fireEvent.click(screen.getByRole('button', { name: /本周压力自评/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: '3' }))
    expect(prefsStore.getState().stressRatings.at(-1)?.score).toBe(3)
    expect(screen.getByText(RECORDS.weeklyStress.answered)).toBeInTheDocument()
  })
  it('keeps prescribed breathing rates when starting from a program', () => {
    prefsStore.getState().startProgram('breathing-4w')
    show('breathing-4w')
    fireEvent.click(screen.getByRole('button', { name: /^开始/ }))
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ practiceId: 'slow', overrides: { params: { rate: 7 } } }),
    )
  })
  it('runs both parts of week seven before counting the full day', async () => {
    const done = Array.from({ length: 42 }, (_, i) => `w${Math.floor(i / 7) + 1}d${(i % 7) + 1}`)
    prefsStore.getState().set({ programs: { 'mindfulness-8w': { startedOn: '2026-10-01', done } } })
    show()
    fireEvent.click(screen.getByRole('button', { name: /专注呼吸.*主练习/ }))
    expect(start).toHaveBeenLastCalledWith(
      expect.objectContaining({ programDay: expect.objectContaining({ countsAsDay: false }) }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^开始/ }))
    expect(start).toHaveBeenLastCalledWith(
      expect.objectContaining({
        practiceId: 'focus',
        minutes: 5,
        programDay: expect.objectContaining({ day: 'w7d1', countsAsDay: false }),
      }),
    )
    await act(async () => {
      await getSessionRepo().add(
        makeRecord({
          at: new Date(),
          actualSec: 300,
          params: { program: 'mindfulness-8w', programDay: 'w7d1' },
        }),
      )
    })
    await waitFor(() => expect(screen.getByText(PROGRAM.second)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^开始/ }))
    expect(start).toHaveBeenLastCalledWith(
      expect.objectContaining({
        practiceId: 'self-compassion',
        minutes: 5,
        programDay: expect.objectContaining({ day: 'w7d1', countsAsDay: true }),
      }),
    )
  })
})
