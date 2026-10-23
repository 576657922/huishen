import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { focusables } from '../../layer'
import { ScaleGroup } from '../ScaleGroup/ScaleGroup'
import { Sheet } from './Sheet'

afterEach(cleanup)

function Harness(props: { dismissible?: boolean; surface?: 'app' | 'player'; onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <main>
        <button type="button" onClick={() => setOpen(true)}>
          现在有点难
        </button>
      </main>
      <Sheet
        open={open}
        onClose={() => {
          props.onClose?.()
          setOpen(false)
        }}
        title="现在有点难"
        dismissible={props.dismissible}
        surface={props.surface}
        closeButton={props.dismissible !== false}
        footer={<button type="button">继续</button>}
      >
        <a href="/play/cyclic-sigh">周期性叹息</a>
      </Sheet>
    </>
  )
}

async function openSheet() {
  await userEvent.click(screen.getByRole('button', { name: '现在有点难' }))
  return screen.getByRole('dialog', { name: '现在有点难' })
}

/** 练习前自评那样的面板：标题和 0–10 的量表，没有底部操作区 */
function ScaleSheet() {
  const [value, setValue] = useState<number | null>(4)
  return (
    <>
      <button type="button">外面</button>
      <Sheet open onClose={() => {}} title="此刻有多紧张？" closeButton>
        <ScaleGroup
          min={0}
          max={10}
          anchors={{ low: '一点也不', high: '非常紧张' }}
          value={value}
          onChange={setValue}
          label="此刻有多紧张？"
        />
      </Sheet>
    </>
  )
}

describe('Sheet', () => {
  it('打开：模态对话框，由标题命名，焦点落在标题上', async () => {
    render(<Harness />)
    const dialog = await openSheet()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { level: 2, name: '现在有点难' })).toHaveFocus()
  })

  it('背景 inert、页面不滚动；关闭后复原，焦点回到触发它的按钮', async () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: '现在有点难' })
    await openSheet()
    expect(trigger.closest('[inert]')).not.toBeNull()
    expect(document.documentElement).toHaveAttribute('data-scroll-lock')
    await userEvent.click(screen.getByRole('button', { name: '关闭' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger.closest('[inert]')).toBeNull()
    expect(document.documentElement).not.toHaveAttribute('data-scroll-lock')
    expect(trigger).toHaveFocus()
  })

  it('Tab 困在面板里：从最后一个绕回第一个，Shift+Tab 反过来', async () => {
    render(<Harness />)
    await openSheet()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('link', { name: '周期性叹息' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '继续' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: '继续' })).toHaveFocus()
  })

  it('最后一站是漫游焦点的单选组（练习前自评）：Tab 不会跑出面板，Shift+Tab 从标题回到它', async () => {
    render(<ScaleSheet />)
    const dialog = screen.getByRole('dialog')
    // 漫游焦点里不在 Tab 顺序的格子不算
    expect(focusables(dialog).map(el => el.textContent)).toEqual(['', '4'])
    const four = screen.getByRole('radio', { name: '4' })
    four.focus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus()
    screen.getByRole('heading', { level: 2 }).focus()
    await userEvent.tab({ shift: true })
    expect(four).toHaveFocus()
  })

  it('wide：开始之前在平板和桌面上是 560 宽的对话框（多一个类，其余行为不变）', () => {
    const { rerender } = render(
      <Sheet open onClose={() => {}} title="开始之前" size="full" dismissible={false}>
        <p>须知</p>
      </Sheet>,
    )
    const narrow = screen.getByRole('dialog').className
    rerender(
      <Sheet open onClose={() => {}} title="开始之前" size="full" dismissible={false} wide>
        <p>须知</p>
      </Sheet>,
    )
    const wide = screen.getByRole('dialog').className
    expect(wide).not.toBe(narrow)
    expect(wide.startsWith(narrow)).toBe(true)
  })

  it('Esc 和点遮罩都关闭', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await openSheet()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const dialog = await openSheet()
    const scrim = dialog.previousElementSibling
    if (!scrim) throw new Error('没有遮罩')
    fireEvent.click(scrim)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('必须作出选择的面板：没有拖动条，Esc 和遮罩都不关', async () => {
    const onClose = vi.fn()
    render(<Harness dismissible={false} onClose={onClose} />)
    const dialog = await openSheet()
    await userEvent.keyboard('{Escape}')
    const scrim = dialog.previousElementSibling
    if (scrim) fireEvent.click(scrim)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('播放器里的面板：自己的根上带 data-theme="dark" 和 data-surface="player"', async () => {
    render(<Harness surface="player" />)
    const dialog = await openSheet()
    const layer = dialog.parentElement
    expect(layer).toHaveAttribute('data-theme', 'dark')
    expect(layer).toHaveAttribute('data-surface', 'player')
  })

  it('向下拖动拖动条超过面板高度的 30% 时关闭', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const dialog = await openSheet()
    dialog.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 390,
      height: 400,
      right: 390,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const grab = dialog.firstElementChild
    if (!grab) throw new Error('没有拖动条')
    // 事件的 timeStamp 只读，用 createEvent 造好再改（不能是 0：React 会把 0 换成 Date.now()）
    const at = (ev: Event, t: number) => {
      Object.defineProperty(ev, 'timeStamp', { value: t })
      return ev
    }
    // 慢慢拖 60 px（面板高 400 的 15%）：回弹，不关
    fireEvent(grab, at(createEvent.pointerDown(grab, { button: 0, clientY: 100 }), 10))
    fireEvent(grab, at(createEvent.pointerMove(grab, { clientY: 160 }), 500))
    fireEvent(grab, at(createEvent.pointerUp(grab, { clientY: 160 }), 1000))
    expect(onClose).not.toHaveBeenCalled()
    // 拖过 30%：关
    fireEvent(grab, at(createEvent.pointerDown(grab, { button: 0, clientY: 100 }), 2000))
    fireEvent(grab, at(createEvent.pointerUp(grab, { clientY: 260 }), 3000))
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // 很快地一甩（> 0.5 px/ms）：也关
    const again = await openSheet()
    again.getBoundingClientRect = dialog.getBoundingClientRect
    const grab2 = again.firstElementChild
    if (!grab2) throw new Error('没有拖动条')
    fireEvent(grab2, at(createEvent.pointerDown(grab2, { button: 0, clientY: 100 }), 10))
    fireEvent(grab2, at(createEvent.pointerUp(grab2, { clientY: 140 }), 50))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
