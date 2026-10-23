import { describe, expect, it } from 'vitest'
import { ciAxisGeometry, ciBarGeometry, dotPlotGeometry, dotPlotMax, signed, sparkGeometry } from './plots'

describe('回神次数点图（设计稿 charts.mjs focusDotPlot）', () => {
  const points = [
    { date: '2026-10-05', value: 9 },
    { date: '2026-10-12', value: 7 },
    { date: '2026-10-22', value: 7, today: true },
  ]

  it('纵轴 0–10；超过 10 时延到下一个 5 的倍数', () => {
    expect(dotPlotMax(points)).toBe(10)
    expect(dotPlotMax([{ date: '2026-10-05', value: 12 }])).toBe(15)
  })

  it('0 / 5 / 10 三条细线；横轴在每个周一标日期，月份只在第一次出现时写', () => {
    const g = dotPlotGeometry(points, '2026-10-05', '2026-10-22')
    expect(g.grid.map(l => l.value)).toEqual([0, 5, 10])
    expect(g.ticks.map(t => t.label)).toEqual(['10月5日', '12日', '19日'])
    // 与设计稿同一公式：左 28、右 10、上 10、下 28，日期两端各留 0.6 天
    const x = (day: number) => 28 + ((day - 5 + 0.6) / (17 + 1.2)) * (350 - 38)
    expect(g.dots[0]?.cx).toBeCloseTo(x(5), 5)
    expect(g.dots[2]?.cx).toBeCloseTo(x(22), 5)
    expect(g.dots[0]?.cy).toBeCloseTo(160 - 28 - 0.9 * (160 - 38), 5)
    expect(g.dots.map(d => d.today)).toEqual([false, false, true])
  })
})

describe('数息走势', () => {
  it('120 × 32，固定 50–100%，每次 4 px 的点，最近一次 8 px', () => {
    const g = sparkGeometry([0.5, 0.75, 1])
    expect(g.d).toBe('M5 27L60 16L115 5')
    expect(g.dots.map(d => d.r)).toEqual([2, 2, 4])
  })

  it('超出刻度的值压在边上，不画到图外', () => {
    const g = sparkGeometry([0.2, 1.4])
    expect(g.dots.map(d => d.cy)).toEqual([27, 5])
  })
})

describe('效应量与置信区间', () => {
  it('一张卡片共用一根轴：与设计稿的坐标一致', () => {
    // 设计稿 evidence.html：domain −0.8…0.2，宽 350 时 0 在 x = 277，区间 −0.55…−0.14 在 90…229.4（左右各留 5）
    const bar = ciBarGeometry({ g: -0.35, lo: -0.55, hi: -0.14 }, [-0.8, 0.2])
    expect(bar.zeroX).toBeCloseTo(277, 5)
    expect(bar.x0).toBeCloseTo(90, 5)
    expect(bar.x1).toBeCloseTo(229.4, 5)
    expect(bar.cx).toBeCloseTo(158, 5)
  })

  it('轴标签用减号 U+2212', () => {
    const axis = ciAxisGeometry([-0.8, 0.2], [-0.8, -0.5, 0])
    expect(axis.ticks.map(t => t.label)).toEqual(['−0.8', '−0.5', '0'])
    expect(signed(0.35)).toBe('0.35')
  })
})
