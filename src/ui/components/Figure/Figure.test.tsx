import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Figure } from './Figure'

afterEach(cleanup)

describe('Figure', () => {
  it('figure 里图在前、图注在后；编号在前，图注按停顿分成不断开的小段', () => {
    const { container } = render(
      <Figure number={1} caption="默认节律的 3 轮，约 33 秒。曲线升高是吸气，降低是呼气。">
        <svg aria-hidden="true" />
      </Figure>,
    )
    const figure = screen.getByRole('figure')
    expect(figure.querySelector('figcaption')?.textContent?.startsWith('图 1默认节律')).toBe(true)
    expect(container.querySelectorAll('figcaption .clause').length).toBeGreaterThan(2)
  })
})
