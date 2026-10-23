import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toggle } from './Toggle'

afterEach(cleanup)

describe('Toggle', () => {
  it('role="switch"，aria-checked 跟着状态；单独使用时由 label 命名', async () => {
    const onChange = vi.fn()
    render(<Toggle label="钟声" checked={false} onChange={onChange} />)
    const sw = screen.getByRole('switch', { name: '钟声' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('由行标签命名时用 aria-labelledby', () => {
    render(
      <>
        <span id="l">操作提示音</span>
        <Toggle labelledBy="l" checked onChange={() => {}} />
      </>,
    )
    expect(screen.getByRole('switch', { name: '操作提示音' })).toHaveAttribute('aria-checked', 'true')
  })

  it('空格和回车都能切换', async () => {
    const onChange = vi.fn()
    render(<Toggle label="钟声" checked onChange={onChange} />)
    await userEvent.tab()
    await userEvent.keyboard(' ')
    await userEvent.keyboard('{Enter}')
    expect(onChange.mock.calls).toEqual([[false], [false]])
  })
})
