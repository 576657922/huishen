import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ICON_NAMES } from './icon-names'
import { Icon, installIconSprite } from './icons'
import spriteSource from './icons.svg?raw'

afterEach(cleanup)

const spriteIds = [...spriteSource.matchAll(/<symbol\s+id="i-([^"]+)"/g)].map(m => m[1])

describe('图标雪碧图', () => {
  it('IconName 与雪碧图里的 symbol 一一对应、顺序一致', () => {
    // 雪碧图改了而类型没跟上，<Icon name> 就会指向不存在的 #i-*，图标静默消失
    expect(spriteIds).toEqual([...ICON_NAMES])
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length)
  })

  it('雪碧图只用 currentColor：没有写死的颜色', () => {
    expect(spriteSource).not.toMatch(/#[0-9a-f]{3,6}\b/i)
    expect(spriteSource).not.toMatch(/rgb\(/i)
  })

  it('启动时内联一次，重复调用不会再插一份', () => {
    installIconSprite(document)
    installIconSprite(document)
    const sprites = document.querySelectorAll('svg#huishen-icons')
    expect(sprites).toHaveLength(1)
    expect(sprites[0]?.getAttribute('aria-hidden')).toBe('true')
    for (const name of ICON_NAMES) expect(document.getElementById(`i-${name}`)).not.toBeNull()
  })
})

describe('<Icon>', () => {
  it('默认对读屏隐藏，引用同一文档里的 symbol，宽高取 size', () => {
    const { container } = render(<Icon name="play" size={20} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '20')
    expect(svg).toHaveAttribute('height', '20')
    expect(svg?.querySelector('use')).toHaveAttribute('href', '#i-play')
  })

  it('给了 label 时是一张有名字的图', () => {
    render(<Icon name="phone" label="电话" />)
    expect(screen.getByRole('img', { name: '电话' })).toBeInTheDocument()
  })
})
