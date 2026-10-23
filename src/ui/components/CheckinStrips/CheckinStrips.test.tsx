import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CheckinStrips } from './CheckinStrips'

afterEach(cleanup)

// 设计稿 data.mjs checkins()：19 对，中位数 6 和 4
const BEFORE = [6, 7, 5, 6, 7, 6, 7, 5, 6, 5, 6, 7, 4, 5, 6, 6, 5, 6, 6]
const AFTER = [5, 5, 5, 4, 5, 4, 6, 6, 4, 3, 5, 4, 3, 4, 5, 4, 4, 6, 4]

describe('CheckinStrips', () => {
  it('一个点一次；中位数竖线和点的位置与设计稿一致；读屏听到两个中位数和次数', () => {
    const { container } = render(<CheckinStrips before={BEFORE} after={AFTER} />)
    expect(
      screen.getByRole('img', { name: '练习前后自评（0–10）：练习前中位数 6，练习后中位数 4，各 19 次' }),
    ).toBeInTheDocument()
    expect(container.querySelectorAll('circle')).toHaveLength(38)
    // charts.mjs：练习前的中位数线 M226.4 51V16.5；6 分的第一团点 218.9 / 226.4 / 233.9，y 42
    const medians = [...container.querySelectorAll('path')].map(p => p.getAttribute('d'))
    expect(medians).toContain('M226.4 51V16.5')
    const first = [...container.querySelectorAll('circle')]
      .slice(0, 3)
      .map(c => `${c.getAttribute('cx')} ${c.getAttribute('cy')}`)
    expect(first).toEqual(['218.9 42', '226.4 42', '233.9 42'])
  })
})
