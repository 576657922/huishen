import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { STOP_GUIDANCE } from '@/content/safety'
import { EmergencyLine } from './EmergencyLine'

afterEach(cleanup)

describe('EmergencyLine', () => {
  it('句子里的中国大陆号码变成 tel: 链接，按标点分句', () => {
    const { container } = render(<EmergencyLine text={STOP_GUIDANCE.emergency} />)
    expect(screen.getByRole('link', { name: '120' })).toHaveAttribute('href', 'tel:120')
    expect(container.querySelector('p')?.textContent).toBe(
      STOP_GUIDANCE.emergency.replace(/(\d) (?=[天周次分秒])/g, '$1 '),
    )
    expect(container.querySelectorAll('.clause').length).toBeGreaterThan(1)
  })
})
