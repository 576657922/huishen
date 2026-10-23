import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

afterEach(cleanup)

describe('EmptyState', () => {
  it('标题、正文和至多一个操作；没有插图', () => {
    const { container } = render(
      <EmptyState
        title="还没有练习记录"
        body="练完一次，这里就会有记录。"
        action={<a href="/practices">去练习</a>}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: '还没有练习记录' })).toBeInTheDocument()
    expect(screen.getByText(/练完一次/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '去练习' })).toBeInTheDocument()
    expect(container.querySelector('svg, img')).toBeNull()
  })

  it('404 页上它就是 h1，可以被程序聚焦', () => {
    render(<EmptyState title="找不到这个页面" level={1} />)
    expect(screen.getByRole('heading', { level: 1, name: '找不到这个页面' })).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })
})
