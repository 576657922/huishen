import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScaleGroup } from './ScaleGroup'

afterEach(cleanup)

describe('ScaleGroup', () => {
  it('0–10：十一个格子，不预选，说明一行「0 一点也不 · 10 非常紧张」描述整组', () => {
    render(
      <ScaleGroup
        label="此刻有多紧张？"
        min={0}
        max={10}
        anchors={{ low: '一点也不', high: '非常紧张' }}
        value={null}
        onChange={() => {}}
      />,
    )
    const group = screen.getByRole('radiogroup', { name: '此刻有多紧张？' })
    expect(group).toHaveAccessibleDescription('0 一点也不 · 10 非常紧张')
    const radios = screen.getAllByRole('radio')
    expect(radios.map(r => r.textContent)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
    expect(radios.every(r => r.getAttribute('aria-checked') === 'false')).toBe(true)
  })

  it('两行：上下键跨行（同一列 n / n + 6），左右键逐格；空格才选', async () => {
    const onChange = vi.fn()
    render(
      <ScaleGroup
        label="此刻有多紧张？"
        min={0}
        max={10}
        anchors={{ low: 'a', high: 'b' }}
        value={null}
        onChange={onChange}
      />,
    )
    await userEvent.tab()
    expect(screen.getByRole('radio', { name: '0' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: '6' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{ArrowUp}')
    expect(screen.getByRole('radio', { name: '1' })).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('1–5 的说明里已经带数字时只印一次（「1 很小」）', () => {
    const { container } = render(
      <ScaleGroup
        label="这些天你的压力有多大？"
        min={1}
        max={5}
        anchors={{ low: '1 很小', high: '5 很大' }}
        value={3}
        onChange={() => {}}
      />,
    )
    expect(container.querySelector('p')?.textContent).toBe('1 很小 · 5 很大')
    expect(screen.getByRole('radio', { name: '3' })).toHaveAttribute('aria-checked', 'true')
  })
})
