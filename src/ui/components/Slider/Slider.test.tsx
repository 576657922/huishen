import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Slider } from './Slider'

afterEach(cleanup)

function Harness({ onChange = () => {} }: { onChange?: (v: number) => void }) {
  const [value, setValue] = useState(5.5)
  return (
    <Slider
      label="节律"
      min={4.5}
      max={6.5}
      step={0.5}
      majorStep={1}
      value={value}
      onChange={v => {
        setValue(v)
        onChange(v)
      }}
      valueText={v => `每分钟 ${v.toFixed(1)} 次`}
      scale={[4.5, 5, 5.5, 6, 6.5]}
    />
  )
}

describe('Slider', () => {
  it('role="slider"，范围、当前值和用文字说的值', () => {
    render(<Harness />)
    const slider = screen.getByRole('slider', { name: '节律' })
    expect(slider).toHaveAttribute('aria-valuemin', '4.5')
    expect(slider).toHaveAttribute('aria-valuemax', '6.5')
    expect(slider).toHaveAttribute('aria-valuenow', '5.5')
    expect(slider).toHaveAttribute('aria-valuetext', '每分钟 5.5 次')
    expect(slider).toHaveAttribute('tabindex', '0')
  })

  it('← → 一步，PageUp / PageDown 一大步，Home / End 到两端，不越界', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.keyboard('{PageUp}')
    await userEvent.keyboard('{Home}')
    await userEvent.keyboard('{ArrowLeft}')
    await userEvent.keyboard('{End}')
    expect(onChange.mock.calls.map(c => c[0])).toEqual([6, 6.5, 4.5, 6.5])
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '每分钟 6.5 次')
  })

  it('刻度标签：一位小数，当前值的那个 aria-current', () => {
    const { container } = render(<Harness />)
    const labels = [...container.querySelectorAll('[aria-hidden="true"] span')]
    expect(labels.map(l => l.textContent)).toEqual(['4.5', '5.0', '5.5', '6.0', '6.5'])
    expect(labels.filter(l => l.getAttribute('aria-current') === 'true').map(l => l.textContent)).toEqual([
      '5.5',
    ])
  })

  it('在带子上任意处按下拖动，取值对齐到步长', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const slider = screen.getByRole('slider')
    // 宽 224：轨道从 12 到 212，共 200
    slider.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 224,
      height: 56,
      right: 224,
      bottom: 56,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    fireEvent.pointerDown(slider, { button: 0, clientX: 12, pointerId: 1 })
    fireEvent.pointerMove(slider, { clientX: 170, pointerId: 1 })
    fireEvent.pointerUp(slider, { clientX: 170, pointerId: 1 })
    fireEvent.pointerMove(slider, { clientX: 212, pointerId: 1 })
    expect(onChange.mock.calls.map(c => c[0])).toEqual([4.5, 6])
  })

  it('不可用时不响应键盘，也不在 Tab 顺序里', async () => {
    const onChange = vi.fn()
    render(<Slider label="语速" min={0.6} max={1.2} step={0.1} value={0.9} onChange={onChange} disabled />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-disabled', 'true')
    expect(slider).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('小数步长不产生浮点误差（0.9 + 0.1 = 1.0）', async () => {
    const onChange = vi.fn()
    render(<Slider label="语速" min={0.6} max={1.2} step={0.1} value={0.9} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(1)
  })
})
