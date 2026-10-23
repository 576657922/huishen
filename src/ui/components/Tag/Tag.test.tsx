import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Tag } from './Tag'

afterEach(cleanup)

describe('Tag', () => {
  it('行内的小标签', () => {
    render(<Tag>自评</Tag>)
    expect(screen.getByText('自评').tagName).toBe('SPAN')
  })
})
