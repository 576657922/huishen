import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RECORDS, SETTINGS } from '@/content/copy'
import { createMemorySessionRepo, prefsStore, setSessionRepo } from '@/data'
import { makeRecord } from '@/data/fixtures'
import { ToastHost } from '@/ui'
import { exportRecords } from './export'
import { RecordsPage } from './index'

vi.mock('./export', async importOriginal => ({
  ...(await importOriginal<typeof import('./export')>()),
  exportRecords: vi.fn(),
}))
let repo: ReturnType<typeof createMemorySessionRepo>
beforeEach(() => {
  prefsStore.getState().reset()
  repo = createMemorySessionRepo()
  setSessionRepo(repo)
  vi.mocked(exportRecords).mockClear()
})
afterEach(() => {
  cleanup()
  setSessionRepo(null)
})
const show = () =>
  render(
    <MemoryRouter>
      <ToastHost>
        <RecordsPage />
      </ToastHost>
    </MemoryRouter>,
  )
describe('records', () => {
  it('shows only the empty state and a practice link without data', async () => {
    show()
    expect(await screen.findByText(RECORDS.empty.title)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: RECORDS.goPractice })).toHaveAttribute('href', '/practices')
    expect(screen.queryByText(RECORDS.byPractice.title)).not.toBeInTheDocument()
  })
  it('renders real statistics, thresholds and month navigation', async () => {
    await repo.add(makeRecord({ at: new Date(), marks: [60, 120] }))
    show()
    await screen.findByRole('heading', { name: RECORDS.byPractice.title })
    expect(screen.getByRole('region', { name: RECORDS.count.title })).toHaveTextContent(
      RECORDS.count.notEnough,
    )
    expect(screen.getByRole('region', { name: RECORDS.checkin.title })).toHaveTextContent(
      RECORDS.checkin.notEnough,
    )
    fireEvent.click(screen.getByRole('button', { name: RECORDS.prevMonth }))
    const before = new Date()
    before.setMonth(before.getMonth() - 1)
    expect(
      screen.getByRole('heading', {
        name: RECORDS.yearMonth
          .replace('{year}', String(before.getFullYear()))
          .replace('{month}', String(before.getMonth() + 1)),
      }),
    ).toBeInTheDocument()
  })
  it('confirms deletion and can restore the original record', async () => {
    const record = makeRecord({ at: new Date(), note: '这是一条备注。' })
    await repo.add(record)
    show()
    fireEvent.click((await screen.findAllByRole('button', { name: /专注呼吸/ }))[0]!)
    expect(screen.getByRole('dialog')).toHaveTextContent(record.note ?? '')
    fireEvent.click(screen.getByRole('button', { name: RECORDS.deleteRecord }))
    expect(await repo.all()).toHaveLength(1)
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: RECORDS.list.delete }),
    )
    await waitFor(async () => expect(await repo.all()).toHaveLength(0))
    fireEvent.click(await screen.findByRole('button', { name: RECORDS.undo }))
    await waitFor(async () => expect(await repo.all()).toEqual([record]))
  })
  it('passes complete records and weekly ratings to both export actions', async () => {
    const record = makeRecord({ at: new Date() })
    await repo.add(record)
    prefsStore.getState().addStressRating(3)
    show()
    fireEvent.click((await screen.findAllByRole('button', { name: SETTINGS.data.export.json }))[0]!)
    expect(exportRecords).toHaveBeenCalledWith('json', [record], prefsStore.getState().stressRatings)
    fireEvent.click(screen.getAllByRole('button', { name: SETTINGS.data.export.csv })[0]!)
    expect(exportRecords).toHaveBeenCalledWith('csv', [record], prefsStore.getState().stressRatings)
  })
})
