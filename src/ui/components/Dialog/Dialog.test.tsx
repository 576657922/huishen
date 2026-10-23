import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './Dialog'

afterEach(cleanup)

function Harness({
  onConfirm = () => {},
  onCancel = () => {},
}: {
  onConfirm?: () => void
  onCancel?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        删除这条记录
      </button>
      <ConfirmDialog
        open={open}
        title="删除这条记录？"
        body="删除后无法恢复。"
        confirmLabel="删除"
        cancelLabel="取消"
        tone="danger"
        onConfirm={() => {
          onConfirm()
          setOpen(false)
        }}
        onCancel={() => {
          onCancel()
          setOpen(false)
        }}
      />
    </>
  )
}

describe('ConfirmDialog', () => {
  it('alertdialog：由标题命名、由正文描述；焦点先到「取消」', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: '删除这条记录' }))
    const dialog = screen.getByRole('alertdialog', { name: '删除这条记录？' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('删除后无法恢复。')
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus()
    // 「取消」在前，动词在后；危险操作带垃圾桶，从不用红色
    const buttons = screen.getAllByRole('button').filter(b => dialog.contains(b))
    expect(buttons.map(b => b.textContent)).toEqual(['取消', '删除'])
    expect(buttons[1]?.querySelector('use')).toHaveAttribute('href', '#i-trash')
  })

  it('确认、取消、Esc、遮罩', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<Harness onConfirm={onConfirm} onCancel={onCancel} />)
    const trigger = screen.getByRole('button', { name: '删除这条记录' })
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(trigger).toHaveFocus()

    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    await userEvent.click(trigger)
    const scrim = screen.getByRole('alertdialog').previousElementSibling
    if (!scrim) throw new Error('没有遮罩')
    fireEvent.click(scrim)
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
