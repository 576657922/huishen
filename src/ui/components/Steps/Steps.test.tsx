import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Steps } from './Steps'

afterEach(cleanup)

describe('Steps', () => {
  it('有序列表，每一步一项；字符串的最后四个字绑在一起', () => {
    render(<Steps items={['坐直，肩膀放松。', '用鼻子吸气，跟着曲线升高，约 4.5 秒。']} />)
    const items = screen.getAllByRole('listitem')
    expect(screen.getByRole('list').tagName).toBe('OL')
    expect(items).toHaveLength(2)
    // 最后四个看得见的字：「.5 秒。」（空白不算字）
    expect(items[1]?.querySelector('.keep')?.textContent).toBe('.5\u00A0秒。')
    // 数字和单位之间是不换行空格
    expect(items[1]?.textContent).toContain('4.5 秒')
  })
})
