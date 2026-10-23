import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FocusTimeline } from './FocusTimeline'

afterEach(cleanup)

// 设计稿 data.mjs FOCUS_PLAYER：10 分钟，现在 412 秒
const MARKS = [96, 151, 188, 262, 319, 401]

describe('FocusTimeline', () => {
  it('播放器里：竖线、过去的基线、点线和现在的点与设计稿一致；读屏听到次数和时刻', () => {
    const { container } = render(<FocusTimeline minutes={10} marks={MARKS} t={412} />)
    expect(
      screen.getByRole('img', {
        name: '回神 6 次，分别在 1 分 36 秒、2 分 31 秒、3 分 8 秒、4 分 22 秒、5 分 19 秒、6 分 41 秒',
      }),
    ).toHaveAttribute('height', '52')
    const d = [...container.querySelectorAll('path')].map(p => p.getAttribute('d'))
    // draw.mjs focusTimeline({ width: 350, minutes: 10, marks, t: 412 })
    expect(d.slice(0, 4)).toEqual(['M0 26H240.33', 'M244.33 26H350', 'M56 25V9', 'M88.08 25V9'])
    expect(
      [...container.querySelectorAll('text')].map(t => `${t.textContent}@${t.getAttribute('x')}`),
    ).toEqual(['0@0.5', '5@175', '10 分钟@349.5'])
    expect(container.querySelector('circle')?.getAttribute('cx')).toBe('240.33')
  })

  it('小结里整段都已过去：没有点线和现在的点', () => {
    const { container } = render(<FocusTimeline minutes={10} marks={MARKS} />)
    expect(container.querySelector('circle')).toBeNull()
    expect(container.querySelector('path')?.getAttribute('d')).toBe('M0 26H349')
  })

  it('不是 5 的倍数的时长：结束处总有带单位的标签，不和整 5 分钟的标签挤在一起', () => {
    const { container } = render(<FocusTimeline minutes={11} marks={[]} />)
    expect([...container.querySelectorAll('text')].map(t => t.textContent)).toEqual(['0', '5', '11 分钟'])
  })
})
