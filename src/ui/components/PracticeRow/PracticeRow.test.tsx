import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PRACTICE_BY_ID } from '@/content/practices'
import { PracticeList, PracticeRow } from './PracticeRow'

afterEach(cleanup)

const slow = PRACTICE_BY_ID.slow

describe('PracticeRow', () => {
  it('整行是一个链接：字形（隐藏）、名称、说明、时长', () => {
    const { container } = render(<PracticeRow practice={slow} minutes={5} to="/practices/slow" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/practices/slow')
    expect(link).toHaveTextContent(slow.name)
    expect(link).toHaveTextContent(slow.short)
    expect(link).toHaveTextContent('5 分钟')
    expect(container.querySelector('svg[data-glyph="slow"]')).toHaveAttribute('aria-hidden', 'true')
    // 数字和单位之间是不换行空格，「5 分钟」不会拆开
    expect(container.querySelector('.pnum')?.textContent).toBe('5')
    expect(link.textContent).toContain('5 分钟')
  })

  it('目录：名称后跟等级字母，读屏听到完整的等级', () => {
    render(<PracticeRow practice={slow} minutes={5} showGrade to="/practices/slow" />)
    const link = screen.getByRole('link')
    expect(link).toHaveTextContent(`证据等级 ${slow.grade}`)
  })

  it('较长的说明作为 aria-describedby 读出来，不显示', () => {
    render(
      <PracticeRow
        practice={slow}
        description="停 · 吸 · 观 · 行"
        hint="一分钟里停下来"
        minutes={1}
        to="/x"
      />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAccessibleDescription('一分钟里停下来')
    // 只作为描述读一次，不再混进链接的名称
    expect(link).not.toHaveAccessibleName(/一分钟里停下来/)
  })

  it('导航行（现在有点难）：打开面板的按钮，带 aria-haspopup，行尾是箭头', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <PracticeRow
        name="现在有点难"
        description="周期性叹息 · 落地练习 · 求助电话"
        glyph="grounding"
        variant="nav"
        end="chevron"
        opensDialog
        onClick={onClick}
      />,
    )
    const button = screen.getByRole('button', { name: /现在有点难/ })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(container.querySelector('svg[data-glyph="grounding"]')).not.toBeNull()
    expect([...container.querySelectorAll('use')].map(u => u.getAttribute('href'))).toContain(
      '#i-chevron-right',
    )
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('计划行：周数字形和「8 周」', () => {
    const { container } = render(
      <PracticeRow name="八周正念" glyph={{ weeks: 8 }} end="weeks" weeks={8} to="/program/x" />,
    )
    expect(container.querySelector('svg[data-glyph="program-8"]')).not.toBeNull()
    expect(screen.getByRole('link')).toHaveTextContent('8 周')
  })

  it('没有字形时字形栏仍然占位（文字不会挤进 48 px 那一栏）', () => {
    const { container } = render(<PracticeRow name="试试" minutes={3} to="/x" />)
    const link = container.querySelector('a')
    expect(link?.children[0]?.tagName).toBe('SPAN')
    expect(link?.children[0]).toHaveAttribute('aria-hidden', 'true')
    expect(link?.children).toHaveLength(3)
  })

  it('PracticeList 是列表，每行一个 li', () => {
    render(
      <PracticeList>
        <PracticeRow practice={slow} minutes={5} to="/a" />
        <PracticeRow practice={PRACTICE_BY_ID.box} minutes={5} to="/b" />
      </PracticeList>,
    )
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })
})
