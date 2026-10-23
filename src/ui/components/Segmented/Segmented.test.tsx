import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Segmented } from './Segmented'

afterEach(cleanup)

function Harness({ onChange = () => {} }: { onChange?: (v: number) => void }) {
  const [value, setValue] = useState(5)
  return (
    <Segmented
      label="时长（分钟）"
      value={value}
      onChange={v => {
        setValue(v)
        onChange(v)
      }}
      options={[3, 5, 10, 15, 20].map(m => ({
        value: m,
        label: String(m),
        sub: m === 15 ? '测量版' : undefined,
      }))}
    />
  )
}

describe('Segmented', () => {
  it('radiogroup 有名字，格子是 radio，只有选中的那格在 Tab 顺序里', () => {
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: '时长（分钟）' })).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(5)
    expect(radios.map(r => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
    ])
    expect(radios.map(r => r.tabIndex)).toEqual([-1, 0, -1, -1, -1])
  })

  it('← → 移动并选中，Home / End 到两端，两头循环', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.tab()
    expect(screen.getByRole('radio', { name: '5' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: '10' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: '10' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('radio', { name: /20/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: '3' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.keyboard('{Home}{ArrowLeft}')
    expect(screen.getByRole('radio', { name: /20/ })).toHaveFocus()
    expect(onChange.mock.calls.map(c => c[0])).toEqual([10, 20, 3, 20])
  })

  it('点一格就选中；第二行小字是名字的一部分', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('radio', { name: '15 测量版' }))
    expect(screen.getByRole('radio', { name: '15 测量版' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '15 测量版' }).tabIndex).toBe(0)
  })
})
