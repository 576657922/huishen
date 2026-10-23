import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Stepper } from './Stepper'

afterEach(cleanup)

function Harness(props: { values?: number[]; start: number; onChange?: (v: number) => void }) {
  const [value, setValue] = useState(props.start)
  return (
    <Stepper
      label="开头倒数"
      values={props.values}
      min={0}
      max={10}
      value={value}
      onChange={v => {
        setValue(v)
        props.onChange?.(v)
      }}
    />
  )
}

describe('Stepper', () => {
  it('一组：「减少」「增加」两个按钮，都由中间的值描述', () => {
    render(<Harness start={5} />)
    expect(screen.getByRole('group', { name: '开头倒数' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '减少' })).toHaveAccessibleDescription('5')
    expect(screen.getByRole('button', { name: '增加' })).toHaveAccessibleDescription('5')
  })

  it('键盘：回车一步；到头的一端 aria-disabled，焦点不丢', async () => {
    const onChange = vi.fn()
    render(<Harness start={9} onChange={onChange} />)
    const plus = screen.getByRole('button', { name: '增加' })
    plus.focus()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(10)
    expect(plus).toHaveAttribute('aria-disabled', 'true')
    expect(plus).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('离散取值（静坐计时）：按列表前后移动', async () => {
    const onChange = vi.fn()
    render(<Harness values={[1, 3, 5, 10, 15, 20, 30, 45, 60]} start={5} onChange={onChange} />)
    screen.getByRole('button', { name: '增加' }).focus()
    await userEvent.keyboard('{Enter}')
    screen.getByRole('button', { name: '减少' }).focus()
    await userEvent.keyboard('{Enter}{Enter}')
    expect(onChange.mock.calls.map(c => c[0])).toEqual([10, 5, 3])
  })

  it('指针按下立刻走一步；按住 400 ms 后每 150 ms 重复', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      render(<Harness start={0} onChange={onChange} />)
      const plus = screen.getByRole('button', { name: '增加' })
      fireEvent.pointerDown(plus, { button: 0 })
      expect(onChange).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(399)
      expect(onChange).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(1 + 150 * 2)
      expect(onChange).toHaveBeenCalledTimes(4)
      fireEvent.pointerUp(plus)
      // 指针松开后随之而来的 click 不再多走一步
      fireEvent.click(plus, { detail: 1 })
      vi.advanceTimersByTime(1000)
      expect(onChange).toHaveBeenCalledTimes(4)
    } finally {
      vi.useRealTimers()
    }
  })
})
