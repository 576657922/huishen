import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PracticeBars } from './PracticeBars'

afterEach(cleanup)

describe('PracticeBars', () => {
  it('每个练习一项：名称、隐藏的横条（按最长的比例）、「150 分钟 · 15 次」', () => {
    const { container } = render(
      <PracticeBars
        rows={[
          { name: '慢呼吸', minutes: 150, sessions: 15 },
          { name: '专注呼吸', minutes: 75, sessions: 7 },
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toBe('慢呼吸150\u00A0分钟 · 15 次')
    // jsdom 不认 max()，直接看 style 属性
    const bars = [...container.querySelectorAll<HTMLElement>('[aria-hidden="true"] > span')]
    expect(bars.map(b => b.getAttribute('style'))).toEqual([
      'width: max(3px, 100%);',
      'width: max(3px, 50%);',
    ])
  })
})
