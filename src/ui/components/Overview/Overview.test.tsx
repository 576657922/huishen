import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Overview } from './Overview'

afterEach(cleanup)

describe('Overview', () => {
  it('每格：标签、大字和单位、小字；给了 label 时是一个有名字的区域', () => {
    render(
      <Overview
        label="概览"
        cells={[
          { label: '本周', figure: 3, unit: '天', note: '共 46 分钟' },
          { label: '10月', figure: 19, unit: '天', note: '26 次练习' },
        ]}
      />,
    )
    const region = screen.getByRole('region', { name: '概览' })
    expect(region).toHaveTextContent('本周3 天共 46 分钟10月19 天26 次练习')
    expect(region.querySelectorAll('.pnum')).toHaveLength(2)
  })
})
