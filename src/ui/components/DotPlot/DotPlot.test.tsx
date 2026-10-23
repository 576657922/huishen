import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DotPlot } from './DotPlot'

afterEach(cleanup)

describe('DotPlot', () => {
  it('每次一个点；没有趋势线；读屏名称由调用方用文字给出', () => {
    const { container } = render(
      <DotPlot
        label="专注呼吸每 10 分钟回神次数：5日 9.0，22日 7.0"
        from="2026-10-05"
        to="2026-10-22"
        points={[
          { date: '2026-10-05', value: 9 },
          { date: '2026-10-22', value: 7, today: true },
        ]}
      />,
    )
    expect(
      screen.getByRole('img', { name: '专注呼吸每 10 分钟回神次数：5日 9.0，22日 7.0' }),
    ).toBeInTheDocument()
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    expect(container.querySelector('polyline')).toBeNull()
    expect([...container.querySelectorAll('text')].map(t => t.textContent)).toEqual([
      '0',
      '5',
      '10',
      '10月5日',
      '12日',
      '19日',
    ])
  })
})
