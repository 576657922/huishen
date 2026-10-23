import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { TextField } from './TextField'

afterEach(cleanup)

function Harness({ start = '' }: { start?: string }) {
  const [value, setValue] = useState(start)
  return (
    <TextField
      label="备注"
      placeholder="可以写一句"
      value={value}
      onChange={setValue}
      maxLength={200}
      multiline
    />
  )
}

describe('TextField', () => {
  it('可见的标签命名输入框；占位文字', async () => {
    render(<Harness />)
    const box = screen.getByRole('textbox', { name: '备注' })
    expect(box).toHaveAttribute('placeholder', '可以写一句')
    expect(box).toHaveAttribute('maxlength', '200')
    await userEvent.type(box, '走神多')
    expect(box).toHaveValue('走神多')
  })

  it('写到 180 字起显示「180/200」，并描述输入框', () => {
    render(<Harness start={'字'.repeat(180)} />)
    const box = screen.getByRole('textbox', { name: '备注' })
    expect(screen.getByText('180/200')).toBeInTheDocument()
    expect(box).toHaveAccessibleDescription('180/200')
  })

  it('179 字时还没有计数', () => {
    render(<Harness start={'字'.repeat(179)} />)
    expect(screen.queryByText('179/200')).toBeNull()
  })

  it('错误：aria-invalid，并由错误信息描述（墨色，前面 i-info）', () => {
    const { container } = render(
      <>
        <span id="lbl">导入备份</span>
        <TextField labelledBy="lbl" value="backup.csv" onChange={() => {}} error="这个文件无法导入。" />
      </>,
    )
    const box = screen.getByRole('textbox', { name: '导入备份' })
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(box).toHaveAccessibleDescription('这个文件无法导入。')
    expect(container.querySelector('use')).toHaveAttribute('href', '#i-info')
  })
})
