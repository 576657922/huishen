import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChoiceGroup } from './ChoiceGroup'

afterEach(cleanup)

const OPTIONS = [
  { value: 'calmer', label: '更平静' },
  { value: 'same', label: '差不多' },
  { value: 'tenser', label: '更紧张' },
  { value: 'unwell', label: '很不舒服' },
]

describe('ChoiceGroup', () => {
  it('不预选：没有格子被选中，第一格可以 Tab 到', () => {
    render(<ChoiceGroup label="练完感觉怎么样？" value={null} onChange={() => {}} options={OPTIONS} />)
    const radios = screen.getAllByRole('radio')
    expect(radios.every(r => r.getAttribute('aria-checked') === 'false')).toBe(true)
    expect(radios.map(r => r.tabIndex)).toEqual([0, -1, -1, -1])
  })

  it('点一下就提交', async () => {
    const onChange = vi.fn()
    render(<ChoiceGroup label="练完感觉怎么样？" value={null} onChange={onChange} options={OPTIONS} />)
    await userEvent.click(screen.getByRole('radio', { name: '更紧张' }))
    expect(onChange).toHaveBeenCalledWith('tenser')
  })

  it('方向键只移动焦点，经过「很不舒服」不会把它选上；空格才选', async () => {
    const onChange = vi.fn()
    render(<ChoiceGroup label="练完感觉怎么样？" value={null} onChange={onChange} options={OPTIONS} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: '很不舒服' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenCalledWith('tenser')
  })

  it('选中的格子在 Tab 顺序里', () => {
    render(<ChoiceGroup label="练完感觉怎么样？" value="tenser" onChange={() => {}} options={OPTIONS} />)
    expect(screen.getByRole('radio', { name: '更紧张' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '更紧张' }).tabIndex).toBe(0)
  })
})
