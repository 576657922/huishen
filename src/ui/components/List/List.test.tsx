import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Segmented } from '../Segmented/Segmented'
import { DisclosureRow, GroupTitle, ListGroup, NavRow, Row, StackRow, ToggleRow } from './List'

afterEach(cleanup)

describe('ListGroup · GroupTitle', () => {
  it('有标题的组：标题是标题元素，组由它命名', () => {
    render(
      <ListGroup title="声音">
        <Row label="版本" end="1.0.0" />
      </ListGroup>,
    )
    expect(screen.getByRole('heading', { level: 2, name: '声音' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '声音' })).toBeInTheDocument()
  })

  it('GroupTitle 默认 h3', () => {
    render(<GroupTitle>放松</GroupTitle>)
    expect(screen.getByRole('heading', { level: 3, name: '放松' })).toBeInTheDocument()
  })
})

describe('NavRow', () => {
  it('整行是链接，值在箭头前', () => {
    render(<NavRow label="默认背景声" value="雨 + 长音" to="/settings/sound" />)
    const link = screen.getByRole('link', { name: /默认背景声/ })
    expect(link).toHaveAttribute('href', '/settings/sound')
    expect(link).toHaveTextContent('雨 + 长音')
  })

  it('没有 to 时是打开面板的按钮', async () => {
    const onClick = vi.fn()
    render(<NavRow label="刷牙后" onClick={onClick} opensDialog />)
    const button = screen.getByRole('button', { name: /刷牙后/ })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})

function ToggleHarness({ onChange }: { onChange: (v: boolean) => void }) {
  const [on, setOn] = useState(false)
  return (
    <ToggleRow
      label="钟声"
      hint="开始时响一声"
      checked={on}
      onChange={v => {
        setOn(v)
        onChange(v)
      }}
    />
  )
}

describe('ToggleRow', () => {
  it('开关由行标签命名、由提示描述', () => {
    render(<ToggleHarness onChange={() => {}} />)
    const sw = screen.getByRole('switch', { name: '钟声' })
    expect(sw).toHaveAccessibleDescription('开始时响一声')
    expect(sw).toHaveAttribute('aria-checked', 'false')
  })

  it('点整行切换；点开关本身只切换一次', async () => {
    const onChange = vi.fn()
    render(<ToggleHarness onChange={onChange} />)
    await userEvent.click(screen.getByText('钟声'))
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('switch'))
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(onChange.mock.calls).toEqual([[true], [false]])
  })

  it('键盘：Tab 到开关，空格切换', async () => {
    const onChange = vi.fn()
    render(<ToggleHarness onChange={onChange} />)
    await userEvent.tab()
    expect(screen.getByRole('switch')).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('不可用时整行和开关都不响应', async () => {
    const onChange = vi.fn()
    render(<ToggleRow label="振动" checked={false} onChange={onChange} disabled />)
    await userEvent.click(screen.getByText('振动'))
    expect(screen.getByRole('switch')).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('StackRow', () => {
  it('标签在上，控件由标签命名、由提示描述；滑块行在右边印当前值', () => {
    render(
      <StackRow label="吸与呼" value="5.5 次/分" hint="两种比例差别不大">
        {ids => (
          <Segmented
            options={[
              { value: 'long', label: '吸 4.5 · 呼 6.5' },
              { value: 'equal', label: '等长' },
            ]}
            value="long"
            onChange={() => {}}
            labelledBy={ids.labelId}
            describedBy={ids.hintId}
          />
        )}
      </StackRow>,
    )
    const group = screen.getByRole('radiogroup', { name: '吸与呼' })
    expect(group).toHaveAccessibleDescription('两种比例差别不大')
    expect(screen.getByText('5.5 次/分')).toBeInTheDocument()
  })
})

describe('DisclosureRow', () => {
  it('aria-expanded / aria-controls；收起时内容不可聚焦', async () => {
    render(
      <DisclosureRow label="为什么不显示连续天数">
        <a href="#src">来源</a>
      </DisclosureRow>,
    )
    const button = screen.getByRole('button', { name: '为什么不显示连续天数' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '')
    expect(panel).not.toBeNull()
    expect(panel?.firstElementChild).toHaveAttribute('inert')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panel?.firstElementChild).not.toHaveAttribute('inert')
  })
})

describe('Row', () => {
  it('静态行：标签、提示和行尾的值或按钮', () => {
    render(<Row label="删除全部数据" hint="删除后无法恢复" end={<button type="button">删除</button>} />)
    expect(screen.getByText('删除全部数据')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument()
  })
})
