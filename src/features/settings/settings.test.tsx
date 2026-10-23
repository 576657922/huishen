import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPlan } from '@/app/plan'
import { SETTINGS } from '@/content/copy'
import { AFTER_PRACTICE, HEALTH_CHECK } from '@/content/safety'
import { createMemorySessionRepo, downloadFile, prefsStore, setSessionRepo, toJSON } from '@/data'
import { makeRecord } from '@/data/fixtures'
import { ToastHost } from '@/ui'
import { SettingsPage } from './index'

vi.mock('@/data', async original => ({
  ...(await original<typeof import('@/data')>()),
  downloadFile: vi.fn(),
}))
let repo: ReturnType<typeof createMemorySessionRepo>
beforeEach(() => {
  prefsStore.getState().reset()
  repo = createMemorySessionRepo()
  setSessionRepo(repo)
  vi.mocked(downloadFile).mockClear()
})
afterEach(() => {
  cleanup()
  setSessionRepo(null)
})
function show(path = '/settings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastHost>
        <Routes>
          <Route path="/settings/*" element={<SettingsPage />} />
          <Route path="/welcome" element={<h1>Welcome</h1>} />
        </Routes>
      </ToastHost>
    </MemoryRouter>,
  )
}
describe('settings', () => {
  it('persists preferences and applies sound and caption controls to the next plan', () => {
    const page = show()
    fireEvent.click(screen.getByRole('radio', { name: SETTINGS.appearance.theme.dark }))
    for (const name of [
      SETTINGS.sound.bells.label,
      SETTINGS.guidance.captionCue.label,
      SETTINGS.practice.silentEnd.label,
      SETTINGS.practice.checkin.label,
    ])
      fireEvent.click(screen.getByRole('switch', { name }))
    fireEvent.click(screen.getByRole('radio', { name: SETTINGS.sound.cueStyle.options.off.name }))
    const prefs = prefsStore.getState()
    expect(prefs).toMatchObject({
      theme: 'dark',
      bells: false,
      captionCue: false,
      silentEnd: false,
      checkin: { prePost: true },
      cueStyle: 'off',
    })
    const plan = buildPlan('body-scan', 10, prefs, null)
    expect(plan).toMatchObject({ bells: false, captionCue: false, silentEnd: false })
    page.unmount()
    show()
    expect(screen.getByRole('switch', { name: SETTINGS.guidance.captionCue.label })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })
  it('edits the reminder sentence and downloads a real recurring calendar', () => {
    show('/settings/reminders')
    fireEvent.click(screen.getByRole('button', { name: SETTINGS.reminder.fields.cue }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: SETTINGS.reminder.cues[1] }),
    )
    expect(prefsStore.getState().reminders?.cue).toBe(SETTINGS.reminder.cues[1])
    fireEvent.click(screen.getByRole('button', { name: SETTINGS.reminder.calendar.button }))
    expect(downloadFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.ics$/),
      'text/calendar',
      expect.stringContaining('RRULE:FREQ=WEEKLY'),
    )
    expect(vi.mocked(downloadFile).mock.calls[0]?.[2]).toContain('BYDAY=MO,TU,WE,TH,FR')
  })
  it('saves only the local health flags and excludes transient notices', () => {
    show('/settings/safety')
    const item = HEALTH_CHECK.items.find(item => item.id === 'pregnancy')!
    fireEvent.click(screen.getByRole('switch', { name: item.label }))
    fireEvent.click(screen.getByRole('switch', { name: HEALTH_CHECK.notices[0]!.label }))
    expect(document.body).toHaveTextContent(item.adaptation)
    fireEvent.click(screen.getByRole('button', { name: HEALTH_CHECK.save }))
    const flags = prefsStore.getState().safety.screening
    expect(flags?.[item.id]).toBe(true)
    expect(Object.keys(flags ?? {})).toHaveLength(8)
    expect(prefsStore.getState().safety.screening?.pregnancy).toBe(true)
  })
  it('keeps monthly answers transient and saves only the date', () => {
    show('/settings/monthly')
    for (const group of screen.getAllByRole('radiogroup').slice(0, AFTER_PRACTICE.monthly.items.length))
      fireEvent.click(within(group).getAllByRole('radio')[0]!)
    fireEvent.click(screen.getByRole('button', { name: SETTINGS.actions.save }))
    const safety = prefsStore.getState().safety
    expect(safety.monthlyCheckedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(safety).not.toHaveProperty('answers')
  })
  it('imports records without replacing existing ones, skips duplicates and restores weekly ratings', async () => {
    const original = makeRecord({ id: 'original' }),
      incoming = makeRecord({ id: 'incoming' })
    await repo.add(original)
    const { container } = show()
    const payload = {
      ...JSON.parse(toJSON([original, incoming])),
      weeklyStress: [
        { answeredAt: '2026-10-23', score: 3 },
        { answeredAt: 'invalid', score: 2 },
      ],
    }
    const file = new File([''], 'backup.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(JSON.stringify(payload)) })
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [file] } })
    await waitFor(async () => expect(await repo.all()).toHaveLength(2))
    await waitFor(() => expect(document.body).toHaveTextContent(SETTINGS.importWeekly))
    expect(prefsStore.getState().stressRatings).toEqual([{ date: '2026-10-23', score: 3 }])
  })
  it('requires both deletion confirmations and resets preferences with the records', async () => {
    await repo.add(makeRecord({ id: 'keep' }))
    prefsStore.getState().set({ theme: 'dark' })
    show()
    fireEvent.click(screen.getByRole('button', { name: SETTINGS.data.deleteAll.label }))
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: SETTINGS.data.deleteAll.first.confirm,
      }),
    )
    expect(await repo.all()).toHaveLength(1)
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: SETTINGS.data.deleteAll.second.confirm,
      }),
    )
    await screen.findByRole('heading', { name: 'Welcome' })
    expect(await repo.all()).toHaveLength(0)
    expect(prefsStore.getState().theme).toBe('system')
  })
})
