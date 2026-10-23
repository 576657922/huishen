import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CRISIS_RESOURCES } from '@/content/safety'
import { DialGrid } from './DialGrid'

afterEach(cleanup)

const mainland = CRISIS_RESOURCES[0]?.lines ?? []

describe('DialGrid', () => {
  it('四个号码都是 tel: 链接，读作「名称 号码，拨打」', () => {
    render(<DialGrid lines={mainland.slice(0, 4)} />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(4)
    expect(links[0]).toHaveAccessibleName(`${mainland[0]?.name} ${mainland[0]?.display}，拨打`)
    for (const [i, link] of links.entries()) expect(link).toHaveAttribute('href', mainland[i]?.href)
  })
})
