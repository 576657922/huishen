import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TODAY } from '@/content/copy'
import { StartBar } from './StartBar'

afterEach(cleanup)

describe('StartBar', () => {
  it('按钮：「开始」加上真正会练的时长，数字与单位分开排版', async () => {
    const onStart = vi.fn()
    const { container } = render(<StartBar minutes={10} onStart={onStart} />)
    const button = screen.getByRole('button')
    expect(button).toHaveTextContent(TODAY.start)
    expect(button).toHaveTextContent('10 分钟')
    expect(container.querySelector('.pnum')?.textContent).toBe('10')
    await userEvent.click(button)
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('时长不固定时写「约 7 分钟」', () => {
    render(<StartBar minutes={7} approx onStart={() => {}} />)
    expect(screen.getByRole('button')).toHaveTextContent('约 7 分钟')
  })

  it('给了 to 时是链接，跳转前调用 onStart；从不禁用', async () => {
    const onStart = vi.fn()
    render(<StartBar minutes={5} to="/play/slow" onStart={onStart} data-testid="bar" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/play/slow')
    expect(link).toHaveAttribute('data-testid', 'bar')
    expect(link).not.toHaveAttribute('aria-disabled')
    link.addEventListener('click', e => e.preventDefault())
    await userEvent.click(link)
    expect(onStart).toHaveBeenCalledOnce()
  })
})
