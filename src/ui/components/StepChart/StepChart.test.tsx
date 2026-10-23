import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getScript } from '@/content/scripts'
import { buildTimeline } from '@/engine'
import { stepSections } from '../../figures/stepchart'
import { SectionStrip, StepChart } from './StepChart'

afterEach(cleanup)

/** 设计稿 draw.mjs 的 BODY_SCAN_10（2026-10-23 的 buildTimeline 快照，补上了开头的「开始」） */
const BODY_SCAN_10 = [
  { id: 'opening', title: '开始', t0: 0, t1: 71.5 },
  { id: 'breath', title: '呼吸', t0: 71.5, t1: 138.4 },
  { id: 'left-leg', title: '左腿', t0: 138.4, t1: 218.2 },
  { id: 'right-leg', title: '右腿', t0: 218.2, t1: 271.4 },
  { id: 'lower-torso', title: '臀部、腹部和后腰', t0: 271.4, t1: 327.6 },
  { id: 'upper-torso', title: '胸口、后背和肩膀', t0: 327.6, t1: 384.8 },
  { id: 'arms', title: '双手和手臂', t0: 384.8, t1: 435.7 },
  { id: 'head', title: '脖子、脸和头部', t0: 435.7, t1: 503.0 },
  { id: 'whole', title: '全身', t0: 503.0, t1: 600 },
]

describe('StepChart', () => {
  it('踏步、标签和现在的点与设计稿 player-guided（now = 372）一致', () => {
    const { container } = render(
      <StepChart sections={BODY_SCAN_10} duration={600} now={372} name="身体扫描进度" />,
    )
    const svg = screen.getByRole('img', { name: /^身体扫描进度：开始从 0 分，呼吸从 1 分 12 秒，/ })
    expect(svg).toHaveAttribute('height', '91')
    const d = [...container.querySelectorAll('path')].map(p => p.getAttribute('d'))
    // draw.mjs stepChart({ width: 350, step: 6, now: 372 }) 的前七条
    expect(d.slice(0, 7)).toEqual([
      'M0 63H41.71',
      'M41.71 63V57H80.73',
      'M80.73 57V51H127.28',
      'M127.28 51V45H158.32',
      'M158.32 45V39H191.1',
      'M191.1 39V33H217',
      'M217 33H224.47',
    ])
    const labels = [...container.querySelectorAll('text')].map(t => t.textContent)
    expect(labels.slice(0, 9)).toEqual([
      '开始',
      '呼吸',
      '左腿',
      '右腿',
      '臀部',
      '胸口',
      '双手',
      '脖子',
      '全身',
    ])
    expect(labels.slice(-3)).toEqual(['0', '5', '10 分钟'])
    const dot = container.querySelector('circle')
    expect([dot?.getAttribute('cx'), dot?.getAttribute('cy')]).toEqual(['217', '33'])
  })

  it('stepSections：引擎时间线补上「开始」，最后一段延到结束，各段首尾相接', () => {
    const t = buildTimeline(getScript('body-scan'), 10, { level: 'standard' })
    const s = stepSections(t, '开始')
    expect(s[0]).toMatchObject({ id: 'opening', title: '开始', t0: 0 })
    expect(s.at(-1)?.t1).toBe(600)
    for (let i = 1; i < s.length; i++) expect(s[i]?.t0).toBe(s[i - 1]?.t1)
  })

  it('SectionStrip：所有踏步在同一高度', () => {
    const { container } = render(
      <SectionStrip sections={BODY_SCAN_10.slice(0, 3)} duration={218.2} axis={false} name="段落" />,
    )
    const ys = [...container.querySelectorAll('text')].map(t => t.getAttribute('y'))
    expect(new Set(ys).size).toBe(1)
  })
})
