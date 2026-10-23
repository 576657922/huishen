import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPlan } from '@/app/plan'
import { DETAIL, SETTINGS } from '@/content/copy'
import { LISTEN, UNLIMITED_CONFIRM } from '@/content/sounds'
import { prefsStore } from '@/data'
import { SoundDetailPage } from './index'

const start = vi.fn(),
  preview = vi.fn()
vi.mock('@/app/flows', async original => ({
  ...(await original<typeof import('@/app/flows')>()),
  startPractice: (...args: unknown[]) => start(...args),
}))
vi.mock('@/app/services', () => ({
  getAudio: () => ({ preview }),
  peekAudio: () => ({ stopPreview: vi.fn(), setVolume: vi.fn() }),
}))
beforeEach(() => {
  prefsStore.getState().reset()
  start.mockClear()
  preview.mockClear()
})
afterEach(cleanup)
const show = (id = 'listen') =>
  render(
    <MemoryRouter initialEntries={[`/practices/${id}`]}>
      <Routes>
        <Route path="/practices/:id" element={<SoundDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
describe('sound setup', () => {
  it('remembers the selected sound, music, volume and duration for the next plan', () => {
    show()
    fireEvent.click(screen.getByRole('radio', { name: /溪流/ }))
    fireEvent.click(screen.getByRole('radio', { name: /长音/ }))
    fireEvent.keyDown(screen.getByRole('slider', { name: SETTINGS.sound.volume.music }), { key: 'End' })
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: DETAIL.durationLabel })).getByRole('radio', {
        name: '30 分钟',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^开始/ }))
    const prefs = prefsStore.getState(),
      plan = buildPlan('listen', 30, prefs, null)
    expect(prefs.sounds.relax).toMatchObject({ music: 'drone', musicVolume: 100 })
    expect(plan.sound).toMatchObject({ music: 'drone', musicVolume: 100 })
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ practiceId: 'listen', minutes: 30 }))
    expect(preview).toHaveBeenCalled()
  })
  it('switches modes, hides daytime birds and keeps each mode independent', () => {
    show()
    fireEvent.click(screen.getByRole('radio', { name: /鸟鸣/ }))
    fireEvent.click(screen.getByRole('radio', { name: LISTEN.sleep.name }))
    expect(screen.queryByRole('radio', { name: /鸟鸣/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('听声音')
    expect(prefsStore.getState().sounds.relax.ambience).toBe('birds')
    expect(prefsStore.getState().sounds.sleep.ambience).toBe('rain')
  })
  it('requires confirmation before unlimited listening and retains the old duration on cancellation', async () => {
    show('sleep')
    const group = screen.getByRole('radiogroup', { name: DETAIL.durationLabel })
    fireEvent.click(within(group).getByRole('radio', { name: '不限' }))
    expect(prefsStore.getState().practice.sleep?.minutes).not.toBe(0)
    fireEvent.click(screen.getByRole('button', { name: UNLIMITED_CONFIRM.cancel }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    fireEvent.click(within(group).getByRole('radio', { name: '不限' }))
    fireEvent.click(screen.getByRole('button', { name: UNLIMITED_CONFIRM.confirm }))
    expect(prefsStore.getState().practice.sleep?.minutes).toBe(0)
    expect(buildPlan('sleep', 0, prefsStore.getState(), null).plannedSec).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: /^开始/ }))
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ practiceId: 'sleep', minutes: 0 }))
    expect(screen.getByRole('link', { name: '求助方式' })).toHaveAttribute('href', '/help')
  })
})
