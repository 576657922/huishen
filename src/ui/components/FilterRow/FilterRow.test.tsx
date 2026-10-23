import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { FilterRow } from './FilterRow'

afterEach(cleanup)

const OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'meditation', label: '冥想' },
  { value: 'breathing', label: '呼吸' },
  { value: 'sound', label: '声音' },
]

function Harness({ vertical = false }: { vertical?: boolean }) {
  const [value, setValue] = useState('all')
  return (
    <FilterRow
      label="筛选"
      value={value}
      onChange={setValue}
      options={OPTIONS}
      orientation={vertical ? 'vertical' : 'horizontal'}
    />
  )
}

describe('FilterRow', () => {
  it('单选组语义；每项带 data-label，给 600 字重预留宽度', () => {
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: '筛选' })).toHaveAttribute('aria-orientation', 'horizontal')
    const radios = screen.getAllByRole('radio')
    expect(radios.map(r => r.getAttribute('data-label'))).toEqual(['全部', '冥想', '呼吸', '声音'])
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
  })

  it('方向键移动并选中；竖排时上下键也一样', async () => {
    render(<Harness vertical />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('radio', { name: '呼吸' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '呼吸' })).toHaveFocus()
    await userEvent.click(screen.getByRole('radio', { name: '声音' }))
    expect(screen.getByRole('radio', { name: '声音' })).toHaveAttribute('aria-checked', 'true')
  })
})
