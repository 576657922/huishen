import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Kbd } from './Kbd'

afterEach(cleanup)

describe('Kbd', () => {
  it('键帽用 <kbd>', () => {
    render(<Kbd>空格</Kbd>)
    expect(screen.getByText('空格').tagName).toBe('KBD')
  })
})
