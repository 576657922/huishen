import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IconButton, IconLink } from './IconButton'

afterEach(cleanup)

describe('IconButton', () => {
  it('只有图标的按钮靠 aria-label 命名；图标 24、对读屏隐藏', async () => {
    const onClick = vi.fn()
    const { container } = render(<IconButton icon="close" label="关闭" onClick={onClick} />)
    const button = screen.getByRole('button', { name: '关闭' })
    expect(button).toHaveAttribute('type', 'button')
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '24')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('不可用时不响应（下个月在本月不可用）', async () => {
    const onClick = vi.fn()
    render(<IconButton icon="chevron-right" label="下个月" disabled onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: '下个月' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('IconLink 是有名字的链接（今日页右上角的设置）', () => {
    render(<IconLink icon="settings" label="设置" to="/settings" />)
    expect(screen.getByRole('link', { name: '设置' })).toHaveAttribute('href', '/settings')
  })
})
