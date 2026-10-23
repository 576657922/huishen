import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BreathGlyph } from './BreathGlyph'

afterEach(cleanup)

describe('BreathGlyph', () => {
  it('48 × 24 的装饰图：对读屏隐藏，不可聚焦', () => {
    const { container } = render(<BreathGlyph id="slow" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('viewBox', '0 0 48 24')
    expect(svg).toHaveAttribute('width', '48')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
    expect(svg?.querySelector('path')?.getAttribute('d')).toMatch(/^M0 /)
  })

  it('4 倍大图：形状放大，描边保持 1.25 px（non-scaling-stroke）', () => {
    const { container } = render(<BreathGlyph id="timer" scale={4} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '192')
    expect(svg).toHaveAttribute('height', '96')
    for (const el of container.querySelectorAll('path, circle')) {
      expect(el).toHaveAttribute('vector-effect', 'non-scaling-stroke')
    }
    expect(container.querySelectorAll('circle')).toHaveLength(2)
  })

  it('计划按周数画小方块；什么都没给时不渲染', () => {
    const { container } = render(<BreathGlyph weeks={4} />)
    expect(container.querySelector('svg')).toHaveAttribute('data-glyph', 'program-4')
    expect(render(<BreathGlyph />).container).toBeEmptyDOMElement()
  })
})
