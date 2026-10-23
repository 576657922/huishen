import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Claims } from './Claims'

afterEach(cleanup)

const CLAIMS = [
  { claim: '与平常呼吸相比，慢呼吸让练习时的心率变异性增大。', grade: 'B' as const, cites: [1, 2] },
  { claim: '练几周后，自评压力小幅减轻。', grade: 'C' as const, cites: [3] },
]

describe('Claims', () => {
  it('一行一条结论，各带自己的等级；注释编号在句末标点之前', () => {
    render(<Claims claims={CLAIMS} scope="等级只针对文案里提到的那个结果。" />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    const first = items[0] as HTMLElement
    expect(within(first).getByText(/证据等级 B/)).toBeInTheDocument()
    expect(within(items[1] as HTMLElement).getByText(/证据等级 C/)).toBeInTheDocument()
    const links = within(first).getAllByRole('link')
    expect(links.map(a => a.getAttribute('href'))).toEqual(['#n1', '#n2'])
    // 最后四个字（编号不算）和编号一起不换行：「增大」+ 编号 + 「。」
    const keep = first.querySelector('.keep')
    expect(keep?.textContent).toBe('性增大12。')
    // 列表下面的说明，最后四个字同样绑在一起
    const scope = screen.getByText(
      (_, el) => el?.tagName === 'P' && el.textContent === '等级只针对文案里提到的那个结果。',
    )
    expect(scope.querySelector('.keep')?.textContent).toBe('个结果。')
  })
})
