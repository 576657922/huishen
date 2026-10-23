import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { CheckinPoint } from '@/data'
import { CheckinStrips, StressPlot } from './Charts'

afterEach(cleanup)
describe('record plots', () => {
  it('keeps every check-in point inside the figure when many scores are equal', () => {
    const points: CheckinPoint[] = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      date: '2026-10-24',
      startedAt: '2026-10-24T08:00:00Z',
      pre: 5,
      post: 5,
      delta: 0,
    }))
    const { container } = render(<CheckinStrips points={points} pre={5} post={5} />)
    const svg = screen.getByRole('img')
    const height = Number(svg.getAttribute('viewBox')?.split(' ')[3])
    const dots = [...container.querySelectorAll('circle')]
    expect(dots).toHaveLength(200)
    expect(
      dots.every(
        dot => Number(dot.getAttribute('cy')) >= 2.5 && Number(dot.getAttribute('cy')) <= height - 2.5,
      ),
    ).toBe(true)
    expect(svg).toHaveAccessibleName(/各 100 次/)
  })
  it('accommodates older imported weekly scores without drawing outside the scale', () => {
    const { container } = render(
      <StressPlot ratings={[{ date: '2026-10-24', score: 80 }]} today="2026-10-24" />,
    )
    const dot = container.querySelector('circle')!
    expect(Number(dot.getAttribute('cy'))).toBeGreaterThanOrEqual(4)
    expect(screen.getByRole('img')).toHaveAccessibleName(/80/)
    expect(screen.getByText('80')).toBeInTheDocument()
  })
})
