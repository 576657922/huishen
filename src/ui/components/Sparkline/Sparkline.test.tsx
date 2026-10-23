import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Sparkline } from './Sparkline'

afterEach(cleanup)

describe('Sparkline', () => {
  it('一条线、每次一个点，最近一次大一号', () => {
    const { container } = render(<Sparkline values={[0.73, 0.81, 0.83]} label="数息准确率：73%，81%，83%" />)
    expect(screen.getByRole('img', { name: '数息准确率：73%，81%，83%' })).toBeInTheDocument()
    expect([...container.querySelectorAll('circle')].map(c => c.getAttribute('r'))).toEqual(['2', '2', '4'])
  })
})
