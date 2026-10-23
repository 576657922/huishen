import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { EVIDENCE } from '@/content/copy'
import { loadEvidence } from '@/content/evidence'
import { EvidencePage } from './index'

afterEach(cleanup)
const show = (hash = '') =>
  render(
    <MemoryRouter initialEntries={[`/evidence${hash}`]}>
      <EvidencePage />
    </MemoryRouter>,
  )
describe('evidence', () => {
  it('renders the heading immediately and loads the curated cards', async () => {
    show()
    expect(screen.getByRole('heading', { level: 1, name: EVIDENCE.title })).toBeInTheDocument()
    const index = await loadEvidence()
    await waitFor(() =>
      expect(document.getElementById(index.cards[0]!.id)).toHaveTextContent(index.cards[0]!.claim),
    )
    expect(screen.getByRole('heading', { name: EVIDENCE.notAdopted.title })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: EVIDENCE.method.more(3) }))
    expect(screen.getByRole('button', { name: EVIDENCE.card.collapse })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
  it('filters cards and opens the first matching conclusion', async () => {
    show()
    const index = await loadEvidence()
    await waitFor(() => expect(document.getElementById(index.cards[0]!.id)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('radio', { name: EVIDENCE.filters.breathing }))
    expect(document.getElementById(index.cards[0]!.id)).not.toBeInTheDocument()
    const card = index.cards.find(c => c.category === 'breathing')!
    const article = document.getElementById(card.id)!
    expect(within(article).getByRole('button', { name: /收起/ })).toHaveAttribute('aria-expanded', 'true')
    expect(within(article).getByText(EVIDENCE.card.limits)).toBeInTheDocument()
  })
  it('expands and focuses a deep linked card with its comparison, limits and DOI', async () => {
    const index = await loadEvidence()
    const card = index.cards.find(c => c.category === 'breathing' && c.outcomes?.length)!
    show(`#${card.id}`)
    await waitFor(() => expect(document.activeElement).toHaveAttribute('id', card.id))
    expect(screen.getByRole('radio', { name: EVIDENCE.filters.breathing })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    const article = document.getElementById(card.id)!
    expect(article).toHaveTextContent(card.design)
    expect(article).toHaveTextContent(card.limits)
    expect(
      within(article)
        .getAllByRole('link')
        .some(link => link.getAttribute('href')?.startsWith('https://doi.org/')),
    ).toBe(true)
  })
})
