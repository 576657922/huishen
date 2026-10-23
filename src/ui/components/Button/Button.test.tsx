import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button, ButtonLink } from './Button'

afterEach(cleanup)

describe('Button', () => {
  it('是一个 type="button" 的按钮，点按调用 onClick', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="primary" onClick={onClick}>
        完成
      </Button>,
    )
    const button = screen.getByRole('button', { name: '完成' })
    expect(button).toHaveAttribute('type', 'button')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('键盘可以触发（回车、空格）', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>导出</Button>)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '导出' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('danger 默认带垃圾桶图标，图标对读屏隐藏，名字只有文字', () => {
    const { container } = render(<Button variant="danger">删除</Button>)
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument()
    const icon = container.querySelector('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon?.querySelector('use')).toHaveAttribute('href', '#i-trash')
    expect(icon).toHaveAttribute('width', '20')
  })

  it('图标尺寸：默认 20，安静按钮 18，小按钮 16', () => {
    const { container } = render(
      <>
        <Button icon="download">导出</Button>
        <Button variant="quiet" icon="refresh">
          换一个
        </Button>
        <Button size="sm" icon="upload">
          导入
        </Button>
      </>,
    )
    const sizes = [...container.querySelectorAll('svg')].map(svg => svg.getAttribute('width'))
    expect(sizes).toEqual(['20', '18', '16'])
  })

  it('disabled 时不响应', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="primary" disabled onClick={onClick}>
        完成
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('aria-disabled：保持可聚焦，但点击被忽略（「我已读完」读到底之前）', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="primary" block aria-disabled="true" onClick={onClick}>
        我已读完
      </Button>,
    )
    const button = screen.getByRole('button', { name: '我已读完' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    button.focus()
    expect(button).toHaveFocus()
  })

  it('as="a" 与 ButtonLink 渲染成链接', () => {
    render(
      <>
        <Button as="a" to="/practices">
          去练习
        </Button>
        <ButtonLink to="/" variant="secondary">
          回到今日
        </ButtonLink>
      </>,
    )
    expect(screen.getByRole('link', { name: '去练习' })).toHaveAttribute('href', '/practices')
    expect(screen.getByRole('link', { name: '回到今日' })).toHaveAttribute('href', '/')
  })
})
