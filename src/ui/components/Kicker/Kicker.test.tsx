import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Kicker, Lead, Unit } from './Kicker'

afterEach(cleanup)

describe('Kicker · Lead · Unit', () => {
  it('Kicker 是一行：左边说明，右边的东西（一般是等级）', () => {
    const { container } = render(
      <Kicker
        start={
          <>
            <b>八周正念</b> · 第 3 周第 2 天
          </>
        }
        end={<span>等级</span>}
      />,
    )
    const p = container.querySelector('p')
    expect(p?.children).toHaveLength(2)
    expect(screen.getByText('八周正念').tagName).toBe('B')
  })

  it('Lead 是段落，Unit 是行内的单位', () => {
    const { container } = render(
      <>
        <Lead>练了 10 分钟</Lead>
        <span>
          7<Unit>次</Unit>
        </span>
      </>,
    )
    // 纯文字的导语会绑住数字和单位（不换行空格）和最后四个字
    expect(container.querySelector('p')?.textContent).toBe('练了 10\u00A0分钟')
    expect(container.querySelector('.keep')).not.toBeNull()
    expect(screen.getByText('次').tagName).toBe('SPAN')
  })
})
