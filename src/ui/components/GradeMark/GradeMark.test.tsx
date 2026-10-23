import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GradeBox, GradeMark } from './GradeMark'

afterEach(cleanup)

describe('GradeMark', () => {
  it('读屏听到「证据等级 B，中等」；方框本身对读屏隐藏', () => {
    const { container } = render(<GradeMark grade="B" />)
    expect(container.textContent?.replace('B', '')).toContain('证据等级 B，中等')
    const box = container.querySelector('[aria-hidden="true"]')
    expect(box?.textContent).toBe('B')
    expect(screen.getByText('中等')).toBeInTheDocument()
  })

  it('prefix：前面加「证据」，读屏不重复', () => {
    const { container } = render(<GradeMark grade="C" prefix />)
    const hidden = [...container.querySelectorAll('[aria-hidden="true"]')].map(el => el.textContent)
    expect(hidden).toEqual(['证据', 'C'])
    expect(screen.getByText('有限')).toBeInTheDocument()
  })

  it('没有等级时什么都不渲染；表格里需要占位时画「—」框', () => {
    const { container } = render(<GradeMark grade={null} />)
    expect(container).toBeEmptyDOMElement()
    const filled = render(<GradeMark grade={null} fill />)
    expect(filled.container.textContent).toBe('—')
  })

  it('GradeBox：目录行里只有字母，读屏仍听到完整的等级', () => {
    const { container } = render(<GradeBox grade="A" />)
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('A')
    expect(container.querySelector('.vh')?.textContent).toBe('证据等级 A，强')
  })
})
