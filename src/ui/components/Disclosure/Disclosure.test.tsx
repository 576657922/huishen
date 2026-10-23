import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Disclosure, Reveal } from './Disclosure'

afterEach(cleanup)

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Disclosure expanded={open} controls="more" onToggle={() => setOpen(o => !o)}>
        展开其余 3 段
      </Disclosure>
      <Reveal id="more" expanded={open}>
        <a href="#n1">注释</a>
      </Reveal>
    </>
  )
}

describe('Disclosure · Reveal', () => {
  it('按钮带 aria-expanded / aria-controls；收起时内容不可聚焦，展开后可以', async () => {
    render(<Harness />)
    const button = screen.getByRole('button', { name: '展开其余 3 段' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-controls', 'more')
    expect(document.getElementById('more')?.firstElementChild).toHaveAttribute('inert')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('more')?.firstElementChild).not.toHaveAttribute('inert')
    await userEvent.tab()
    expect(screen.getByRole('link', { name: '注释' })).toHaveFocus()
  })

  it('读屏名称可以比可见文字多一点', () => {
    render(
      <Disclosure expanded={false} controls="x" onToggle={() => {}} label="展开：慢呼吸 · 心率变异性">
        展开
      </Disclosure>,
    )
    expect(screen.getByRole('button', { name: '展开：慢呼吸 · 心率变异性' })).toBeInTheDocument()
  })
})
