import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bindUnits, clauses, keep, typeset } from './text'

afterEach(cleanup)

const NBSP = ' '

describe('bindUnits', () => {
  it('数字和后面的量词之间换成不换行空格', () => {
    expect(bindUnits('练了 10 分钟')).toBe(`练了 10${NBSP}分钟`)
    expect(bindUnits('3 天 · 46 分钟')).toBe(`3${NBSP}天 · 46${NBSP}分钟`)
    expect(bindUnits('第 3 周第 2 天')).toBe(`第 3${NBSP}周第 2${NBSP}天`)
    expect(bindUnits('5.5 次/分')).toBe(`5.5${NBSP}次/分`)
  })

  it('年月日不绑：日期本来就连写，「2026 年」这样的写法交给内容检查', () => {
    expect(bindUnits('10月22日')).toBe('10月22日')
    expect(bindUnits('2026 年')).toBe('2026 年')
  })

  it('统计量和运算符两边都不断开', () => {
    expect(bindUnits('p = 0.765')).toBe(`p${NBSP}=${NBSP}0.765`)
    expect(bindUnits('g = −0.35')).toBe(`g${NBSP}=${NBSP}−0.35`)
    expect(bindUnits('ηp² < 0.001')).toBe(`ηp²${NBSP}<${NBSP}0.001`)
  })
})

describe('keep', () => {
  it('最后四个字（含标点）放进 .keep', () => {
    const { container } = render(<p>{keep('不舒服就停下，睁开眼睛。')}</p>)
    expect(container.querySelector('.keep')?.textContent).toBe('开眼睛。')
    expect(container.textContent).toBe('不舒服就停下，睁开眼睛。')
  })

  it('空白不算字；不足四个字时原样返回', () => {
    const { container } = render(<p>{keep('五样 东西。')}</p>)
    expect(container.querySelector('.keep')?.textContent).toBe('样 东西。')
    expect(keep('好的。')).toBe('好的。')
  })

  it('typeset 先绑单位再绑结尾', () => {
    const { container } = render(<p>{typeset('每天 5 分钟')}</p>)
    expect(container.textContent).toBe(`每天 5${NBSP}分钟`)
    expect(container.querySelector('.keep')?.textContent).toBe(`天 5${NBSP}分钟`)
  })
})

describe('clauses', () => {
  it('只在 ，；：。？！ 之后断开，每句一个 .clause，最后一句绑住结尾', () => {
    const { container } = render(<p>{clauses('想保持清醒，可以睁开眼睛，或者坐起来。')}</p>)
    const parts = [...container.querySelectorAll('.clause')].map(el => el.textContent)
    expect(parts).toEqual(['想保持清醒，', '可以睁开眼睛，', '或者坐起来。'])
    expect(container.querySelector('.clause:last-child .keep')?.textContent).toBe('坐起来。')
  })

  it('号码变成 tel: 链接，最后一句有号码时结尾仍然绑住', () => {
    const { container } = render(
      <p>{clauses('如出现胸痛，请立即拨打 120。持续气促，请及时就医。', { tel: ['120'] })}</p>,
    )
    const link = container.querySelector('a')
    expect(link).toHaveAttribute('href', 'tel:120')
    expect(link?.textContent).toBe('120')
    expect(container.textContent).toBe('如出现胸痛，请立即拨打 120。持续气促，请及时就医。')

    const last = render(<p>{clauses('打不通时，拨打 400-161-9995 试试。', { tel: ['400-161-9995'] })}</p>)
    expect(last.container.querySelector('a')).toHaveAttribute('href', 'tel:4001619995')
    expect(last.container.querySelector('.clause:last-child .keep')?.textContent).toBe('400-161-9995 试试。')
  })
})
