import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Readouts } from './Readouts'

afterEach(cleanup)

describe('Readouts', () => {
  it('术语—数值的定义列表；单位跟在数值后面；不是实时区域', () => {
    const { container } = render(
      <Readouts
        items={[
          { label: '剩余', value: '06:15' },
          { label: '节律', value: '5.5', unit: '次/分' },
          { label: '轮数', value: '23' },
        ]}
      />,
    )
    expect(container.querySelector('dl')).not.toBeNull()
    expect(screen.getAllByRole('term').map(t => t.textContent)).toEqual(['剩余', '节律', '轮数'])
    expect(screen.getAllByRole('definition')[1]).toHaveTextContent('5.5次/分')
    expect(container.querySelector('[aria-live]')).toBeNull()
  })
})
