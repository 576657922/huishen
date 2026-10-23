import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Chip } from './Chip'

afterEach(cleanup)

describe('Chip', () => {
  it('有点急：按钮，由描述说明它做什么', async () => {
    const onClick = vi.fn()
    render(
      <>
        <Chip aria-describedby="h" onClick={onClick}>
          有点急
        </Chip>
        <span id="h">点一下，每分钟加快 0.5 次</span>
      </>,
    )
    const chip = screen.getByRole('button', { name: '有点急' })
    expect(chip).toHaveAccessibleDescription('点一下，每分钟加快 0.5 次')
    await userEvent.click(chip)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('不舒服？：i-help 图标、aria-haspopup="dialog"', () => {
    const { container } = render(<Chip variant="unwell">不舒服？</Chip>)
    expect(screen.getByRole('button', { name: '不舒服？' })).toHaveAttribute('aria-haspopup', 'dialog')
    expect(container.querySelector('use')).toHaveAttribute('href', '#i-help')
  })

  it('不可用时不响应', async () => {
    const onClick = vi.fn()
    render(
      <Chip disabled icon="skip" onClick={onClick}>
        跳过这一处
      </Chip>,
    )
    await userEvent.click(screen.getByRole('button', { name: '跳过这一处' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
