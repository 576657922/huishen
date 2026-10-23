import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LinkMore } from './LinkMore'

afterEach(cleanup)

describe('LinkMore', () => {
  it('是链接，名字只有文字；箭头 16 对读屏隐藏', () => {
    const { container } = render(<LinkMore to="/help">求助方式</LinkMore>)
    const link = screen.getByRole('link', { name: '求助方式' })
    expect(link).toHaveAttribute('href', '/help')
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '16')
    expect(svg?.querySelector('use')).toHaveAttribute('href', '#i-chevron-right')
  })
})
