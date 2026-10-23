import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastHost, useToast } from './Toast'

afterEach(cleanup)
beforeEach(() => {
  vi.useFakeTimers()
  return () => vi.useRealTimers()
})

function Trigger({
  withAction = false,
  onAction = () => {},
}: {
  withAction?: boolean
  onAction?: () => void
}) {
  const toast = useToast()
  return (
    <button
      type="button"
      onClick={() =>
        toast.show({
          message: withAction ? '已删除这条记录。' : '已删除全部数据。',
          action: withAction ? { label: '撤销', onAction } : undefined,
        })
      }
    >
      show
    </button>
  )
}

const flush = () => act(() => vi.runOnlyPendingTimers())

describe('Toast', () => {
  it('role="status" 的区域一直在；内容出现时读屏用 polite 读出', () => {
    render(
      <ToastHost>
        <Trigger />
      </ToastHost>,
    )
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toBeEmptyDOMElement()
    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    expect(status).toHaveTextContent('已删除全部数据。')
  })

  it('4 秒后消失；带操作的 6 秒', () => {
    render(
      <ToastHost>
        <Trigger />
        <Trigger withAction />
      </ToastHost>,
    )
    const [plain, action] = screen.getAllByRole('button', { name: 'show' })
    fireEvent.click(plain as HTMLElement)
    act(() => vi.advanceTimersByTime(3999))
    expect(screen.getByRole('status')).toHaveTextContent('已删除全部数据。')
    act(() => vi.advanceTimersByTime(1))
    flush()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    fireEvent.click(action as HTMLElement)
    act(() => vi.advanceTimersByTime(5999))
    expect(screen.getByRole('status')).toHaveTextContent('已删除这条记录。')
    act(() => vi.advanceTimersByTime(1))
    flush()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('指针停在上面时暂停计时；点「撤销」调用操作并关闭', () => {
    const onAction = vi.fn()
    render(
      <ToastHost>
        <Trigger withAction onAction={onAction} />
      </ToastHost>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    const undo = screen.getByRole('button', { name: '撤销' })
    const toast = undo.parentElement as HTMLElement
    fireEvent.pointerEnter(toast)
    act(() => vi.advanceTimersByTime(20000))
    expect(screen.getByRole('status')).toHaveTextContent('已删除这条记录。')
    fireEvent.pointerLeave(toast)
    fireEvent.click(undo)
    expect(onAction).toHaveBeenCalledOnce()
    flush()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('同一时间只有一条：新的替换旧的', () => {
    render(
      <ToastHost>
        <Trigger />
        <Trigger withAction />
      </ToastHost>,
    )
    const [plain, action] = screen.getAllByRole('button', { name: 'show' })
    fireEvent.click(plain as HTMLElement)
    fireEvent.click(action as HTMLElement)
    expect(screen.getByRole('status')).toHaveTextContent('已删除这条记录。')
    expect(screen.getByRole('status')).not.toHaveTextContent('已删除全部数据。')
  })

  it('播放器开着时（html[data-bars="player"]）提示条是深色的播放器表面；离开播放器后跟随应用外观', () => {
    render(
      <ToastHost>
        <Trigger />
      </ToastHost>,
    )
    document.documentElement.dataset.bars = 'player'
    try {
      fireEvent.click(screen.getByRole('button', { name: 'show' }))
      const toast = screen.getByRole('status').firstElementChild
      expect(toast).toHaveAttribute('data-theme', 'dark')
      expect(toast).toHaveAttribute('data-surface', 'player')
    } finally {
      delete document.documentElement.dataset.bars
    }
    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    const toast = screen.getByRole('status').firstElementChild
    expect(toast).not.toHaveAttribute('data-theme')
    expect(toast).not.toHaveAttribute('data-surface')
  })

  it('在 ToastHost 外面调用 useToast 会报错', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow(/ToastHost/)
  })
})
