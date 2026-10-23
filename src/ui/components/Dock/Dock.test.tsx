import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Dock } from './Dock'

afterEach(cleanup)

describe('Dock', () => {
  it('把内容放在底部停靠条里', () => {
    render(
      <Dock>
        <button type="button">完成</button>
      </Dock>,
    )
    expect(screen.getByRole('button', { name: '完成' })).toBeInTheDocument()
  })
})
