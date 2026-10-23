import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_SESSION, sessionStore } from '@/app/flows'
import { setNavigate } from '@/app/navigation'
import { resetServices } from '@/app/services'
import { WELCOME } from '@/content/copy'
import { FIRST_RUN_NOTICE } from '@/content/safety'
import { prefsStore } from '@/data'
import { WelcomePage } from './index'

let observed: IntersectionObserverCallback | null = null
const navigate = vi.fn()
beforeEach(() => {
  prefsStore.getState().reset()
  sessionStore.setState({ ...INITIAL_SESSION })
  resetServices()
  navigate.mockClear()
  setNavigate(navigate)
  observed = null
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observed = callback
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
})
afterEach(() => {
  cleanup()
  resetServices()
  setNavigate(null)
  vi.unstubAllGlobals()
})
const show = () =>
  render(
    <MemoryRouter>
      <WelcomePage />
    </MemoryRouter>,
  )
const readAll = (): void =>
  act(() =>
    observed?.(
      [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  )
describe('welcome', () => {
  it('keeps the introduction brief and allows browsing without acknowledging the notice', () => {
    show()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: WELCOME.browse }))
    expect(navigate).toHaveBeenCalledWith('/practices', {})
    expect(prefsStore.getState().onboarded).toBe(true)
    expect(prefsStore.getState().safety.ackOn).toBeNull()
  })
  it('returns a gated comfort test to its own page with the selected first rate', () => {
    sessionStore.setState({
      gated: {
        practiceId: 'pace-finder',
        from: 'pace-finder',
        overrides: { params: { rate: 6.5, step: 1 } },
      },
      origin: '/pace-finder',
    })
    show()
    readAll()
    fireEvent.click(screen.getByRole('button', { name: FIRST_RUN_NOTICE.confirm }))
    expect(navigate).toHaveBeenLastCalledWith('/pace-finder', {})
    expect(sessionStore.getState().plan?.params).toMatchObject({ rate: 6.5, step: 1 })
  })
  it('does not confirm until the last content is fully visible', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: WELCOME.start }))
    const confirm = screen.getByRole('button', { name: FIRST_RUN_NOTICE.confirm })
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(confirm)
    expect(prefsStore.getState().safety.ackOn).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    readAll()
    expect(confirm).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(confirm)
    expect(prefsStore.getState().safety.ackOn).not.toBeNull()
    expect(sessionStore.getState().start).toMatchObject({ practiceId: 'pause', minutes: 1 })
  })
  it('opens the notice immediately for a gated start and resumes that exact request', () => {
    sessionStore.setState({ gated: { practiceId: 'focus', minutes: 15, from: 'catalogue' } })
    show()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    readAll()
    fireEvent.click(screen.getByRole('button', { name: FIRST_RUN_NOTICE.confirm }))
    expect(sessionStore.getState().gated).toBeNull()
    expect(sessionStore.getState().start).toMatchObject({
      practiceId: 'focus',
      minutes: 15,
      from: 'catalogue',
    })
    expect(navigate).toHaveBeenCalledWith('/play/focus', { replace: false })
  })
  it('also gates a request received while the welcome page is already open', () => {
    show()
    act(() => sessionStore.setState({ gated: { practiceId: 'slow', minutes: 10, from: 'today' } }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    readAll()
    fireEvent.click(screen.getByRole('button', { name: FIRST_RUN_NOTICE.confirm }))
    expect(sessionStore.getState().start).toMatchObject({ practiceId: 'slow', minutes: 10, from: 'today' })
  })
})
