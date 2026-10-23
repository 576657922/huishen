import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { WeekDay } from '../../figures/calendar'
import { WeekDots } from './WeekDots'

afterEach(cleanup)

const WEEK: WeekDay[] = [
  { date: '2026-10-19', minutes: 15, state: 'past' },
  { date: '2026-10-20', minutes: 0, state: 'past' },
  { date: '2026-10-21', minutes: 21, state: 'past' },
  { date: '2026-10-22', minutes: 10, state: 'today' },
  { date: '2026-10-23', minutes: 0, state: 'future' },
  { date: '2026-10-24', minutes: 0, state: 'future' },
  { date: '2026-10-25', minutes: 0, state: 'future' },
]

describe('WeekDots', () => {
  it('一张有完整读屏名称的图：练过哪几天、今天是周几', () => {
    render(<WeekDots days={WEEK} />)
    expect(
      screen.getByRole('img', { name: '本周，练过 3 天：周一、周三、周四；今天是周四' }),
    ).toBeInTheDocument()
  })

  it('练过的日子三个点，没练的什么都不画；今天一道短线', () => {
    const { container } = render(<WeekDots days={WEEK} size="desk" />)
    expect(container.querySelectorAll('circle')).toHaveLength(3)
    expect([...container.querySelectorAll('circle')].map(c => c.getAttribute('r'))).toEqual(['5', '5', '5'])
    expect(container.querySelectorAll('path')).toHaveLength(1)
    expect([...container.querySelectorAll('text')].map(t => t.textContent).join('')).toBe('一二三四五六日')
  })
})
