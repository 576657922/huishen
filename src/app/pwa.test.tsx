import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SYSTEM } from '@/content/copy'
import { ToastHost } from '@/ui'
import { INITIAL_SESSION, sessionStore } from './flows/store'
import { UpdatePrompt } from './pwa'
import { resetServices } from './services'

const updateServiceWorker = vi.fn(async () => undefined)

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}))

beforeEach(() => {
  resetServices()
  sessionStore.setState({ ...INITIAL_SESSION })
})

afterEach(() => {
  cleanup()
  resetServices()
  sessionStore.setState({ ...INITIAL_SESSION })
})

const app = () =>
  render(
    <ToastHost>
      <UpdatePrompt />
    </ToastHost>,
  )

describe('新版本提示', () => {
  it('没有练习时安静地提示一次；点「更新」才更新', async () => {
    app()
    expect(await screen.findByText(SYSTEM.update.message)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: SYSTEM.update.action }))
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('练习中、练习前自评和小结开着时不提示，结束以后再提示', async () => {
    sessionStore.setState({ phase: 'playing' })
    app()
    expect(screen.queryByText(SYSTEM.update.message)).toBeNull()
    act(() => sessionStore.setState({ phase: 'summary' }))
    expect(screen.queryByText(SYSTEM.update.message)).toBeNull()
    act(() => sessionStore.setState({ ...INITIAL_SESSION }))
    expect(await screen.findByText(SYSTEM.update.message)).toBeInTheDocument()
  })
})
