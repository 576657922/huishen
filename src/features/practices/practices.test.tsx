import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPlan } from '@/app/plan'
import { CATALOGUE, DETAIL, SETTINGS, TODAY } from '@/content/copy'
import { isOffered, PRACTICES } from '@/content/practices'
import { prefsStore } from '@/data'
import { CataloguePage, PracticeDetailPage } from './index'

const start = vi.fn()
vi.mock('@/app/flows', () => ({
  startPractice: (...args: unknown[]) => start(...args),
  rememberSound: vi.fn(),
}))
beforeEach(() => {
  prefsStore.getState().reset()
  start.mockClear()
})
afterEach(cleanup)
function show(id?: string) {
  return render(
    <MemoryRouter initialEntries={[id ? `/practices/${id}` : '/practices']}>
      <Routes>
        <Route path="/practices" element={<CataloguePage />} />
        <Route path="/practices/:id" element={<PracticeDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}
describe('practices', () => {
  it('filters the catalogue and keeps unavailable practices out', () => {
    show()
    expect(screen.queryByRole('link', { name: /正念行走/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: '呼吸' }))
    expect(screen.queryByRole('link', { name: /专注呼吸/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /慢呼吸/ })).toBeInTheDocument()
  })
  it('explains health screening exclusions', () => {
    prefsStore.getState().set({
      safety: {
        screening: {
          pregnancy: true,
          heart: false,
          respiratory: false,
          psychosis: false,
          bipolar: false,
          epilepsy: false,
          trauma: false,
          panic: false,
        },
      },
    })
    show()
    expect(screen.queryByRole('link', { name: /箱式呼吸/ })).not.toBeInTheDocument()
    expect(screen.getByText(CATALOGUE.hidden(['箱式呼吸']))).toBeInTheDocument()
  })
  it.each(PRACTICES.filter(p => isOffered(p.id) && !['listen', 'sleep', 'pace-finder'].includes(p.id)))(
    'provides a complete detail for $id',
    async practice => {
      show(practice.id)
      expect(screen.getByRole('heading', { level: 1, name: practice.name })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: DETAIL.sections.how })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '求助方式' })).toHaveAttribute('href', '/help')
      expect(screen.getByRole('button', { name: /开始/ })).toBeInTheDocument()
    },
  )
  it('remembers rate, duration and warmup after reopening, and applies them to the next plan', () => {
    const first = show('slow')
    fireEvent.keyDown(screen.getByRole('slider', { name: DETAIL.slow.rate }), { key: 'End' })
    const durations = screen.getByRole('radiogroup', { name: DETAIL.durationLabel })
    fireEvent.click(within(durations).getByRole('radio', { name: '10' }))
    fireEvent.click(screen.getByRole('switch', { name: DETAIL.slow.warmup }))
    fireEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(prefsStore.getState().practice.slow).toMatchObject({ rate: 7, minutes: 10, warmup: false })
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ minutes: 10 }))
    first.unmount()
    show('slow')
    expect(screen.getByRole('switch', { name: DETAIL.slow.warmup })).toHaveAttribute('aria-checked', 'false')
    const plan = buildPlan('slow', 10, prefsStore.getState(), null)
    expect(plan.pattern?.rate).toBe(7)
    expect(plan.pattern?.warmup).toBeUndefined()
  })
  it('does not start an unavailable practice from an old link', () => {
    show('walking')
    expect(screen.getByText(DETAIL.notOffered)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /开始/ })).not.toBeInTheDocument()
  })
  it('applies the box step length to all four phases within its supported range', () => {
    show('box')
    const stepper = screen.getByRole('group', { name: DETAIL.boxPhase })
    const increase = within(stepper).getByRole('button', { name: '增加' })
    fireEvent.click(increase)
    fireEvent.click(increase)
    expect(increase).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(prefsStore.getState().practice.box?.phaseSec).toBe(6)
    const plan = buildPlan('box', 5, prefsStore.getState(), null)
    expect(plan.params).toMatchObject({ inhale: 6, holdIn: 6, exhale: 6, holdOut: 6 })
  })
  it('persists interval bells and applies them to the next timer session', () => {
    show('timer')
    fireEvent.click(
      within(screen.getByRole('group', { name: DETAIL.durationLabel })).getByRole('button', { name: '增加' }),
    )
    fireEvent.click(screen.getByRole('radio', { name: SETTINGS.sound.interval.every(5) }))
    fireEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(start).toHaveBeenLastCalledWith(expect.objectContaining({ minutes: 10 }))
    expect(buildPlan('timer', 10, prefsStore.getState(), null).intervalSec).toBe(300)
    fireEvent.click(screen.getByRole('switch', { name: SETTINGS.sound.bells.label }))
    expect(buildPlan('timer', 10, prefsStore.getState(), null).bells).toBe(false)
  })
  it('reflects the chosen focus duration in its figure and preserves guidance after reopening', () => {
    const first = show('focus')
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: DETAIL.durationLabel })).getByRole('radio', {
        name: '20',
      }),
    )
    fireEvent.click(screen.getByRole('radio', { name: SETTINGS.guidance.level.options.quiet.name }))
    expect(screen.getByRole('img', { name: TODAY.focusCaption })).toHaveTextContent(TODAY.minutes(20))
    first.unmount()
    show('focus')
    expect(screen.getByRole('radio', { name: '20' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: SETTINGS.guidance.level.options.quiet.name })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(buildPlan('focus', 20, prefsStore.getState(), null).params.level).toBe('quiet')
  })
})
