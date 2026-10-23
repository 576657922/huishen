import { cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PageHead } from './PageHead'

afterEach(cleanup)

describe('PageHead', () => {
  it('一个可以被程序聚焦的 h1 和 folio', () => {
    const ref = createRef<HTMLHeadingElement>()
    render(<PageHead title="练习" folioStart="17 项练习" folioEnd="时长为默认值" titleRef={ref} />)
    const h1 = screen.getByRole('heading', { level: 1, name: '练习' })
    expect(h1).toHaveAttribute('tabindex', '-1')
    ref.current?.focus()
    expect(h1).toHaveFocus()
    expect(screen.getByText('17 项练习')).toBeInTheDocument()
    expect(screen.getByText('时长为默认值')).toBeInTheDocument()
  })

  it('没有 folio 内容时不画 folio', () => {
    const { container } = render(<PageHead title="依据" />)
    expect(container.querySelector('p')).toBeNull()
  })

  it('桌面记录页：subline 和右边的操作', () => {
    render(
      <PageHead
        title="记录"
        variant="subline"
        subline="10月1日–22日 · 29 次练习"
        actions={<button type="button">导出 CSV</button>}
      />,
    )
    expect(screen.getByText('10月1日–22日 · 29 次练习')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出 CSV' })).toBeInTheDocument()
  })
})
