import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Section, SectionHead } from './Section'

afterEach(cleanup)

describe('Section · SectionHead', () => {
  it('小节由它的 h2 命名；右边的说明是文字', () => {
    render(
      <Section title="冥想" aside="10 项">
        <p>内容</p>
      </Section>,
    )
    expect(screen.getByRole('region', { name: '冥想' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '冥想' })).toBeInTheDocument()
    expect(screen.getByText('10 项')).toBeInTheDocument()
  })

  it('右边也可以是控件（‹ › 月份按钮）；level 3', () => {
    render(
      <SectionHead
        title="10月"
        level={3}
        aside={
          <span>
            <button type="button" aria-label="上个月" />
          </span>
        }
      />,
    )
    expect(screen.getByRole('heading', { level: 3, name: '10月' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上个月' })).toBeInTheDocument()
  })
})
