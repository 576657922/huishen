import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, setPlayerOpen, THEME_COLORS } from '../theme'
import { AppFrame } from './AppFrame'
import { railCurrent, tabCurrent } from './nav'
import { PageFrame } from './PageFrame'
import { PlayerFrame } from './PlayerFrame'
import { RootLayout } from './RootLayout'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-bars')
})

describe('导航的当前项（DESIGN.md §8.11、§8.12）', () => {
  it('导航栏', () => {
    expect(railCurrent('/')).toBe('today')
    for (const p of ['/practices', '/practices/slow', '/program/mindfulness-8w', '/pace-finder'])
      expect(railCurrent(p), p).toBe('practices')
    expect(railCurrent('/records')).toBe('records')
    expect(railCurrent('/evidence')).toBe('evidence')
    expect(railCurrent('/help')).toBe('help')
    expect(railCurrent('/settings/reminders')).toBe('settings')
    expect(railCurrent('/nope')).toBeNull()
    expect(railCurrent('/practicesx')).toBeNull()
  })

  it('标签栏：设置从今日进，求助方式不属于任何一项', () => {
    expect(tabCurrent('/settings')).toBe('today')
    expect(tabCurrent('/help')).toBeNull()
    expect(tabCurrent('/records')).toBe('records')
  })
})

describe('页面外框', () => {
  it('PageFrame 设好 <html data-bars> 和浏览器标题，离开时去掉', () => {
    const { unmount } = render(
      <PageFrame title="练习" variant="dock">
        <h1>练习</h1>
      </PageFrame>,
    )
    expect(document.documentElement.dataset.bars).toBe('dock')
    expect(document.title).toBe('练习 · 回神')
    unmount()
    expect(document.documentElement.dataset.bars).toBeUndefined()
  })

  it('没有标题的页面（首次使用）只写「回神」；bare 没有底部的条', () => {
    render(
      <PageFrame title={null} variant="bare">
        <h1>回神</h1>
      </PageFrame>,
    )
    expect(document.title).toBe('回神')
    expect(document.documentElement.dataset.bars).toBe('none')
  })

  it('PlayerFrame：深色的播放器地标，导航收起，浏览器顶栏变深；嵌在外框里时不是第二个 main', () => {
    const { unmount } = render(
      <PlayerFrame name="慢呼吸">
        <div data-region="stage" />
      </PlayerFrame>,
    )
    const main = screen.getByRole('main', { name: '慢呼吸练习' })
    expect(main).toHaveAttribute('data-theme', 'dark')
    expect(main).toHaveAttribute('data-surface', 'player')
    expect(document.documentElement.dataset.bars).toBe('player')
    expect(document.title).toBe('慢呼吸 · 回神')
    unmount()
    render(
      <PlayerFrame name="舒适节律探索" embedded>
        <div data-region="stage" />
      </PlayerFrame>,
    )
    expect(screen.queryByRole('main')).toBeNull()
    expect(screen.getByRole('region', { name: '舒适节律探索练习' })).toHaveAttribute('data-theme', 'dark')
  })
})

describe('外观', () => {
  const metas = (): string[] =>
    [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(m => m.content)

  it('跟随系统不写属性；浅色、深色写在 <html> 上，浏览器顶栏跟着变；播放器开着时总是深色', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(metas()).toEqual([THEME_COLORS.dark, THEME_COLORS.dark])
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(metas()).toEqual([THEME_COLORS.light, THEME_COLORS.light])
    setPlayerOpen(true)
    expect(metas()).toEqual([THEME_COLORS.dark, THEME_COLORS.dark])
    setPlayerOpen(false)
    applyTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})

function Page({ title, to }: { title: string; to: string }) {
  return (
    <PageFrame title={title}>
      <h1>{title}</h1>
      <Link to={to}>去{to}</Link>
    </PageFrame>
  )
}

describe('换页', () => {
  it('第一次打开不抢焦点；之后每次换页焦点落到新页面的 h1 上（不画焦点框），标签栏标出当前项', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <RootLayout />,
          children: [
            {
              element: <AppFrame />,
              children: [
                { index: true, element: <Page title="今日" to="/records" /> },
                { path: 'records', element: <Page title="记录" to="/" /> },
              ],
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)
    const today = await screen.findByRole('heading', { level: 1, name: '今日' })
    await act(() => new Promise(requestAnimationFrame))
    expect(today).not.toHaveFocus()

    await userEvent.click(screen.getByRole('link', { name: '去/records' }))
    const records = await screen.findByRole('heading', { level: 1, name: '记录' })
    await vi.waitFor(() => expect(records).toHaveFocus())
    expect(records).toHaveAttribute('data-focus-target')
    expect(document.title).toBe('记录 · 回神')
    const current = screen
      .getAllByRole('link', { name: '记录' })
      .filter(a => a.getAttribute('aria-current') === 'page')
    expect(current.length).toBeGreaterThan(0)
  })
})
