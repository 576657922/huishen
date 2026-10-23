import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CountRows } from './CountRows'

afterEach(cleanup)

const ROWS = [
  { date: '10月14日', accuracy: 0.73, resets: 2 },
  { date: '10月18日', accuracy: 0.88, resets: 0 },
]

describe('CountRows', () => {
  it('真的表格：表头、每次一行（日期是行标题）、准确率和「数乱了」；点在 50–100% 的轨道上', () => {
    const { container } = render(<CountRows rows={ROWS} />)
    const table = screen.getByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(h => h.textContent),
    ).toEqual(['日期', '准确率', '数乱了'])
    const row = within(table).getByRole('row', { name: /10月14日/ })
    expect(row).toHaveTextContent('73%')
    expect(row).toHaveTextContent('2 次')
    expect([...container.querySelectorAll('circle')].map(c => c.getAttribute('cx'))).toEqual(['46%', '76%'])
  })

  it('手机版没有点', () => {
    const { container } = render(<CountRows rows={ROWS} dots={false} />)
    expect(container.querySelector('svg')).toBeNull()
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })
})
