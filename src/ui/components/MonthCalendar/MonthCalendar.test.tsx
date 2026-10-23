import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MonthCalendar } from './MonthCalendar'

afterEach(cleanup)

describe('MonthCalendar', () => {
  it('读屏名称说清练过几天、今天是哪天；练过的日子有点', () => {
    const practised = new Set(['2026-10-01', '2026-10-02', '2026-10-22'])
    const { container } = render(
      <MonthCalendar year={2026} month={10} practised={practised} today="2026-10-22" />,
    )
    expect(
      screen.getByRole('img', { name: '10月练习日历：练过 3 天，练过的日子有实心点；今天是22日' }),
    ).toBeInTheDocument()
    expect(container.querySelectorAll('circle')).toHaveLength(3)
    // 七个星期名 + 31 个日期
    expect(container.querySelectorAll('text')).toHaveLength(38)
  })
})
