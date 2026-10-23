import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { EffectRows, EvidenceCard } from './EvidenceCard'

afterEach(cleanup)

const FIELDS = [
  { term: '研究类型', content: '随机对照试验的元分析' },
  { term: '局限', content: '把不同做法合在一起算' },
]

function Collapsible() {
  const [open, setOpen] = useState(false)
  return (
    <EvidenceCard
      topic="慢呼吸 · 心率变异性"
      grade="B"
      claim="练慢呼吸时心率变异性增大。"
      meta="元分析 · 223 项研究"
      fields={FIELDS}
      expanded={open}
      onToggle={() => setOpen(o => !o)}
    />
  )
}

describe('EvidenceCard', () => {
  it('完整卡片：由结论命名的 article；kicker 里有带「证据」的等级；各栏是 dl', () => {
    const { container } = render(
      <EvidenceCard
        topic="呼吸练习 · 压力"
        grade="B"
        claim="与不做呼吸练习的对照相比，压力减轻。"
        fields={FIELDS}
      />,
    )
    expect(screen.getByRole('article', { name: '与不做呼吸练习的对照相比，压力减轻。' })).toBeInTheDocument()
    expect(container.textContent).toContain('证据等级 B，中等')
    expect(container.querySelectorAll('dt')).toHaveLength(2)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('字符串结论按 §4.3 排版：最后四个字绑在 .keep 里，不会只剩两三个字一行', () => {
    const claim = '与不做呼吸练习的对照相比，呼吸练习让自评压力小到中等程度减轻。'
    render(<EvidenceCard topic="呼吸练习 · 压力" grade="B" claim={claim} fields={[]} />)
    const article = screen.getByRole('article', { name: claim })
    expect(article.querySelector('p .keep')?.textContent).toBe('度减轻。')
  })

  it('收起的卡片：meta 一行和「展开」，展开后各栏可见', async () => {
    render(<Collapsible />)
    const button = screen.getByRole('button', { name: '展开：慢呼吸 · 心率变异性' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('元分析 · 223 项研究')).toBeInTheDocument()
    await userEvent.click(button)
    expect(screen.getByRole('button', { name: '收起：慢呼吸 · 心率变异性' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})

describe('EffectRows', () => {
  it('有区间才画区间；没有区间时只印统计量，从不画编出来的区间', () => {
    const { container } = render(
      <EffectRows
        domain={[-0.8, 0.2]}
        ticks={[-0.8, -0.5, -0.2, 0]}
        note="小于 0 表示比对照减轻。"
        outcomes={[
          {
            name: '压力',
            detail: '12 项试验 · 785 人',
            value: 'g = −0.35（−0.55 至 −0.14）',
            ci: { g: -0.35, lo: -0.55, hi: -0.14 },
          },
          { name: '幸福感', value: 'ηp² < 0.001，p = 0.765' },
        ]}
      />,
    )
    // 两行结果，一根共用的轴：区间图只有一张（压力），加一张轴
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(2)
    for (const svg of svgs) expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('g = −0.35（−0.55 至 −0.14）')).toBeInTheDocument()
    expect(screen.getByText('ηp² < 0.001，p = 0.765')).toBeInTheDocument()
    expect([...container.querySelectorAll('text')].map(t => t.textContent)).toEqual([
      '−0.8',
      '−0.5',
      '−0.2',
      '0',
    ])
  })
})
