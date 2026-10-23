import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_SESSION, sessionStore } from '@/app/flows'
import { setNavigate } from '@/app/navigation'
import { buildPlan } from '@/app/plan'
import { PLAYER, SUMMARY } from '@/content/copy'
import { AFTER_PRACTICE, STOP_GUIDANCE } from '@/content/safety'
import { createMemorySessionRepo, prefsStore, setSessionRepo } from '@/data'
import { makeRecord } from '@/data/fixtures'
import type { SessionController, SessionState } from '@/engine'
import { ToastHost } from '@/ui'
import { PlayerPage, SummaryPage } from './index'

vi.mock('@/app/services', () => ({
  getController: () => controller,
  getRepo: () => repo,
  getAudio: () => ({ unlock: vi.fn().mockResolvedValue(true) }),
  getTimeScale: () => 1,
}))
vi.mock('@/widgets/SessionStage/Canvas', () => ({ BreathCanvas: () => <div /> }))
let state: SessionState
let time = 0
let repo: ReturnType<typeof createMemorySessionRepo>
const listeners = new Set<() => void>()
const update = (patch: Partial<SessionState>): void => {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}
const controller: SessionController = {
  getState: () => state,
  time: () => time,
  subscribe: listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  breathAt: () => null,
  start: vi.fn(async plan => update({ status: 'running', plan, endSec: plan.plannedSec })),
  pause: vi.fn(() => update({ status: 'paused' })),
  resume: vi.fn(() => update({ status: 'running' })),
  end: vi.fn(() => update({ status: 'done' })),
  reset: vi.fn(() => update({ status: 'idle' })),
  mark: vi.fn(),
  countTap: vi.fn(),
  stepBack: vi.fn(),
  skipSection: vi.fn(),
  setSound: vi.fn(),
  onFinish: () => () => {},
}
const navigate = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  prefsStore.getState().reset()
  listeners.clear()
  time = 0
  repo = createMemorySessionRepo()
  setSessionRepo(repo)
  setNavigate(navigate)
  sessionStore.setState({ ...INITIAL_SESSION })
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
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => {
  cleanup()
  setSessionRepo(null)
  setNavigate(null)
  vi.unstubAllGlobals()
})
const show = (element: React.ReactNode) =>
  render(
    <MemoryRouter>
      <ToastHost>{element}</ToastHost>
    </MemoryRouter>,
  )
function running(id: Parameters<typeof buildPlan>[0]): void {
  const plan = buildPlan(id, id === 'grounding' ? 1 : 5, prefsStore.getState(), null, { leadSec: 0 })
  state = {
    ...state,
    status: 'running',
    plan,
    timeline: plan.timeline,
    endSec: plan.plannedSec,
    startedAt: new Date().toISOString(),
    audio: 'on',
  }
  sessionStore.setState({ phase: 'playing', plan, start: { practiceId: id, from: 'player' } })
}
describe('player', () => {
  it('waits for a gesture when a player URL is opened directly', () => {
    show(<PlayerPage practiceId="slow" />)
    expect(screen.getByRole('button', { name: /开始/ })).toBeInTheDocument()
    expect(controller.start).not.toHaveBeenCalled()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
  it('uses Space for a focus mark even if the pause control has keyboard focus', () => {
    running('focus')
    show(<PlayerPage practiceId="focus" />)
    screen.getByRole('button', { name: PLAYER.pause }).focus()
    fireEvent.keyDown(document.activeElement!, { key: ' ', code: 'Space' })
    expect(controller.mark).toHaveBeenCalledTimes(1)
    expect(controller.pause).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: PLAYER.end }))
    expect(controller.end).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: PLAYER.endDialog.confirm }),
    )
    expect(controller.end).toHaveBeenCalledTimes(1)
  })
  it('opens a pause panel with the complete stop guidance and resumes through its safe exit', () => {
    running('focus')
    show(<PlayerPage practiceId="focus" />)
    fireEvent.keyDown(document, { key: 'Escape' })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(STOP_GUIDANCE.when.lead)
    expect(dialog).toHaveTextContent(STOP_GUIDANCE.breathing)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(controller.resume).toHaveBeenCalledTimes(1)
  })
  it('keeps a dismissed distress sheet paused and offers the pause panel', () => {
    running('focus')
    show(<PlayerPage practiceId="focus" />)
    fireEvent.click(screen.getAllByRole('button', { name: PLAYER.unwell })[0]!)
    expect(controller.pause).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog')).toHaveTextContent(STOP_GUIDANCE.short)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(controller.resume).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: PLAYER.paused })).toBeInTheDocument()
  })
  it('ends directly from distress, without a second confirmation', () => {
    running('grounding')
    show(<PlayerPage practiceId="grounding" />)
    fireEvent.click(screen.getAllByRole('button', { name: PLAYER.unwell })[0]!)
    expect(screen.queryByRole('button', { name: STOP_GUIDANCE.actions.grounding })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: PLAYER.unwellSheet.endPractice }))
    expect(controller.end).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
  it('supports counting keys and reset while keeping live counting data out of the UI', () => {
    running('breath-count')
    state.count = { current: 4, cycles: 3, correct: 2, errors: 1, resets: 2, invalid: 0 }
    show(<PlayerPage practiceId="breath-count" />)
    fireEvent.keyDown(document, { key: 'f' })
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    fireEvent.keyDown(document, { key: 'Backspace' })
    expect(controller.countTap).toHaveBeenNthCalledWith(1, 'breath')
    expect(controller.countTap).toHaveBeenNthCalledWith(2, 'ninth')
    expect(controller.countTap).toHaveBeenNthCalledWith(3, 'reset')
    expect(screen.queryByText(PLAYER.readouts.rounds)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /第 9 口气/ })).toBeInTheDocument()
  })
  it('provides a skippable section and prevents a rapid repeated skip', () => {
    running('body-scan')
    const index = state.plan!.timeline!.sections.findIndex(section => section.skippable)
    const section = state.plan!.timeline!.sections[index]!
    time = section.t0 + 1
    state.section = { ...section, index, skippable: true }
    show(<PlayerPage practiceId="body-scan" />)
    const skip = screen.getByRole('button', { name: PLAYER.guided.skip })
    fireEvent.click(skip)
    fireEvent.click(skip)
    expect(controller.skipSection).toHaveBeenCalledTimes(1)
    expect(skip).toHaveAttribute('aria-disabled', 'true')
  })
  it('uses the ending message without a bell when bells are off', () => {
    running('timer')
    state = { ...state, silentEnding: true, plan: { ...state.plan!, bells: false } }
    show(<PlayerPage practiceId="timer" />)
    expect(screen.getByText(PLAYER.silentEndingNoBell)).toBeInTheDocument()
    expect(screen.queryByText(PLAYER.silentEnding)).not.toBeInTheDocument()
  })
})
describe('summary', () => {
  async function summary(options: { seconds?: number; feeling?: boolean; checkin?: boolean } = {}) {
    running('focus')
    state.status = 'done'
    const seconds = options.seconds ?? 300
    const record =
      seconds >= 60 ? makeRecord({ at: new Date(), actualSec: seconds, checkin: { pre: 9 } }) : null
    if (record) await repo.add(record)
    sessionStore.setState({
      phase: 'summary',
      summary: {
        result: {
          plan: state.plan!,
          startedAt: new Date().toISOString(),
          practicedSec: seconds,
          completed: true,
          marks: [40, 100],
          count: null,
          breaths: null,
          finalRate: null,
          rateSteps: 0,
          skipped: [],
        },
        record,
        questions: { feeling: options.feeling ?? true, checkin: options.checkin ?? true },
        answers: {},
        gentler: false,
        programDayDone: null,
        rememberedRate: null,
      },
    })
    show(<SummaryPage />)
    return record
  }
  it('saves feelings, post-checkin and notes, without displaying the before-score', async () => {
    const record = await summary()
    const question = screen.getByRole('region', { name: SUMMARY.checkin.question })
    expect(
      within(question)
        .getAllByRole('radio')
        .filter(radio => radio.getAttribute('aria-checked') === 'true'),
    ).toHaveLength(0)
    fireEvent.click(screen.getByRole('radio', { name: '更平静' }))
    fireEvent.click(within(question).getByRole('radio', { name: '3' }))
    fireEvent.change(screen.getByRole('textbox', { name: SUMMARY.note.label }), {
      target: { value: '练完的备注。' },
    })
    fireEvent.click(screen.getByRole('button', { name: SUMMARY.done }))
    await waitFor(async () =>
      expect((await repo.all()).find(item => item.id === record!.id)).toMatchObject({
        feeling: 'calmer',
        checkin: { pre: 9, post: 3 },
        note: '练完的备注。',
      }),
    )
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })
  it('opens immediate rest and help when someone selects unwell', async () => {
    await summary()
    fireEvent.click(screen.getByRole('radio', { name: '很不舒服' }))
    expect(screen.getByRole('dialog', { name: AFTER_PRACTICE.unwell.title })).toHaveTextContent(
      AFTER_PRACTICE.unwell.paragraphs[0]!,
    )
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: STOP_GUIDANCE.actions.grounding }),
    ).toBeInTheDocument()
  })
  it('does not ask questions for a practice shorter than one minute', async () => {
    await summary({ seconds: 30, feeling: false, checkin: false })
    expect(document.body).toHaveTextContent(SUMMARY.notRecorded)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
  it('shows gentler alternatives and help after repeated uncomfortable experiences', async () => {
    await summary()
    act(() => sessionStore.setState({ summary: { ...sessionStore.getState().summary!, gentler: true } }))
    const card = screen.getByRole('region', { name: AFTER_PRACTICE.gentler.title })
    expect(card).toHaveTextContent(AFTER_PRACTICE.gentler.paragraphs[0]!)
    expect(within(card).getAllByRole('button')).toHaveLength(2)
    expect(within(card).getByRole('link', { name: AFTER_PRACTICE.gentler.help })).toHaveAttribute(
      'href',
      '/help',
    )
  })
})
