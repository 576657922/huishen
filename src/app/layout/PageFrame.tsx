import type { ReactNode } from 'react'
import { cx } from '@/ui'
import { type Bars, useDocumentBars, useDocumentTitle } from './document'
import styles from './PageFrame.module.css'

/**
 * tabs：手机底部有标签栏的页面——四个标签页，以及没有停靠栏的推入页面（设置、求助方式），标签栏照常显示；
 * dock：底部有停靠栏的页面（练习详情、小结、计划、舒适节律探索），标签栏不显示；
 * bare：底部什么都没有的页面（首次使用）
 */
export type PageVariant = 'tabs' | 'dock' | 'bare'

const BARS: Record<PageVariant, Bars> = { tabs: 'tabs', dock: 'dock', bare: 'none' }

export interface PageFrameProps {
  /** 浏览器标签上的名字，写成「标题 · 回神」；null 只写「回神」（DESIGN.md §13.1） */
  title: string | null
  variant?: PageVariant
  children: ReactNode
  className?: string
}

/**
 * 一页的外框（DESIGN.md §8.0 .page / .page--dock / .page--bare）：两侧边距、顶部安全区、
 * 给底部的条留出的空白；在 <html> 上设 data-bars，并设 document.title。页面的 h1 写在里面
 */
export function PageFrame({ title, variant = 'tabs', children, className }: PageFrameProps) {
  useDocumentBars(BARS[variant])
  useDocumentTitle(title)
  return (
    <div
      className={cx(
        styles.page,
        variant === 'dock' && styles.dock,
        variant === 'bare' && styles.bare,
        className,
      )}
    >
      {children}
    </div>
  )
}
