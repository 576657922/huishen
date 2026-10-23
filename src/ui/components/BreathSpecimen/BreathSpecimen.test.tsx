import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BreathSpecimen } from './BreathSpecimen'

afterEach(cleanup)

describe('BreathSpecimen', () => {
  it('慢呼吸默认节律 3 轮：括号、轴标签和曲线起点与设计稿 detail-slow 一致', () => {
    const { container } = render(<BreathSpecimen params={{ type: 'resonance', rate: 5.5, ratio: 'long' }} />)
    expect(screen.getByRole('img', { name: '吸 4.5 秒，呼 6.5 秒 · 每分钟 5.5 次' })).toBeInTheDocument()
    const texts = [...container.querySelectorAll('text')].map(t => `${t.textContent}@${t.getAttribute('x')}`)
    // draw.mjs breathSpecimen({ p: resonance(5.5, 'long'), cycles: 3, width: 350, height: 140 })
    expect(texts).toEqual([
      '0@0.5',
      '10@106.94',
      '20@213.89',
      '30 秒@327.83',
      '吸 4.5 秒@23.11',
      '呼 6.5 秒@82.2',
    ])
    const d = [...container.querySelectorAll('path')].map(p => p.getAttribute('d') ?? '')
    expect(d).toContain('M0.5 17V12H45.73V17')
    expect(d).toContain('M49.73 17V12H114.67V17')
    expect(d.find(x => x.startsWith('M0 116L0.53'))).toBeDefined()
    // 下面不填色：没有闭合的面积
    expect(d.some(x => x.endsWith('Z'))).toBe(false)
  })
})
