import type { ReactNode } from 'react'
import { cx } from '../../cx'
import styles from './Dock.module.css'

export interface DockProps {
  children: ReactNode
  className?: string
}

/**
 * 底部停靠条（DESIGN.md §8.4）：手机和平板上固定在底部，放开始条或「完成」；桌面上就地排在内容里。
 * 有它的页面要让 PageFrame 在 <html> 上设 data-bars="dock"，键盘焦点才不会藏到它下面（§11）。
 */
export function Dock({ children, className }: DockProps) {
  return <div className={cx(styles.dock, className)}>{children}</div>
}
