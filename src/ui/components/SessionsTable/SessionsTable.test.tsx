import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionsTable } from './SessionsTable'

afterEach(cleanup)

const ROWS = [
  {
    id: 'a',
    date: '10月22日',
    weekday: '周四',
    start: '07:42',
    practice: '专注呼吸',
    minutes: 10,
    data: '回神 7 次',
    feeling: '更平静',
    before: 6,
    after: 4,
    note: '走神多',
  },
  { id: 'b', date: '10月21日', weekday: '周三', start: '21:05', practice: '慢呼吸', minutes: 5 },
]

describe('SessionsTable', () => {
  it('表头、每次一行；没有的值印「—」', () => {
    render(<SessionsTable rows={ROWS} onOpen={() => {}} onDelete={() => {}} />)
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent)
    expect(headers.slice(0, 4)).toEqual(['日期', '开始', '练习', '时长'])
    const second = screen.getByRole('row', { name: /10月21日/ })
    expect(within(second).getAllByText('—')).toHaveLength(4)
  })

  it('点一行打开详情；「删除」只删除不打开；焦点在行里按 Delete 也删除', async () => {
    const onOpen = vi.fn()
    const onDelete = vi.fn()
    render(<SessionsTable rows={ROWS} onOpen={onOpen} onDelete={onDelete} />)
    const row = screen.getByRole('row', { name: /10月22日/ })
    fireEvent.click(within(row).getByText('专注呼吸'))
    expect(onOpen).toHaveBeenCalledWith('a')
    await userEvent.click(within(row).getByRole('button', { name: '删除' }))
    expect(onDelete).toHaveBeenCalledWith('a')
    expect(onOpen).toHaveBeenCalledTimes(1)
    within(row).getByRole('button', { name: '详情' }).focus()
    await userEvent.keyboard('{Delete}')
    expect(onDelete).toHaveBeenCalledTimes(2)
    await userEvent.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('还有更早的记录时，下面一个安静按钮', async () => {
    const onMore = vi.fn()
    render(
      <SessionsTable
        rows={ROWS}
        onOpen={() => {}}
        onDelete={() => {}}
        more={{ label: '显示更早的 50 次', onMore }}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '显示更早的 50 次' }))
    expect(onMore).toHaveBeenCalled()
  })
})
