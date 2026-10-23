import type { SVGProps } from 'react'
import { cx } from './cx'
import type { IconName, IconSize } from './icon-names'
import styles from './icons.module.css'
import spriteSource from './icons.svg?raw'

/**
 * 雪碧图在启动时内联进文档一次，<use> 只引用同一文档里的 #i-*：
 * - 不再发一次网络请求：第一次打开、Service Worker 还没装好或缓存被清掉时，图标照样随第一帧出现，
 *   不会先空着再闪出来；
 * - 外部文件的 <use href="/icons.svg#…"> 一旦那个文件没取到，所有图标都会静默消失，而且依赖部署路径；
 *   内联后图标和脚本同生共死，脚本能跑，图标就在；
 * - 测试环境（jsdom）里也能断言图标存在。
 * 代价是约 15 KB 的源码进了主包（gzip 后约 4 KB）。
 */
const SPRITE_ID = 'huishen-icons'

/** 把雪碧图放进 body 开头；已经有了就什么都不做（可重复调用，HMR 时也安全） */
export function installIconSprite(doc: Document = document): void {
  if (doc.getElementById(SPRITE_ID)) return
  const holder = doc.createElement('div')
  holder.innerHTML = spriteSource
  const svg = holder.querySelector('svg')
  if (!svg) return
  svg.id = SPRITE_ID
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  doc.body.prepend(svg)
}

if (typeof document !== 'undefined') {
  if (document.body) installIconSprite(document)
  else document.addEventListener('DOMContentLoaded', () => installIconSprite(document), { once: true })
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'children'> {
  name: IconName
  size?: IconSize
  /** 只有图标本身就是内容时才给（极少）；按钮上的图标由按钮的 aria-label 命名，图标保持隐藏 */
  label?: string
}

/** 回神图标：只用 currentColor 描线，颜色跟随文字（DESIGN.md §9） */
export function Icon({ name, size = 24, label, className, ...rest }: IconProps) {
  if (label) {
    return (
      <svg
        {...rest}
        role="img"
        aria-label={label}
        className={cx(styles.icon, className)}
        width={size}
        height={size}
        data-icon={name}
      >
        <use href={`#i-${name}`} />
      </svg>
    )
  }
  return (
    <svg
      {...rest}
      aria-hidden="true"
      focusable="false"
      className={cx(styles.icon, className)}
      width={size}
      height={size}
      data-icon={name}
    >
      <use href={`#i-${name}`} />
    </svg>
  )
}
