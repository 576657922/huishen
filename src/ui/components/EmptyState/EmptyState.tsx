import type { ReactNode } from 'react'
import { cx } from '../../cx'
import { typeset } from '../../text'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  /** RECORDS.empty.title 等，宋体 20 / 28 */
  title: string
  body?: string
  /** 至多一个操作：次要按钮或「… ›」链接，16 之下 */
  action?: ReactNode
  /** 页面里它是第几级标题；404 页上它就是 h1 */
  level?: 1 | 2
  className?: string
}

/** 空状态（DESIGN.md §8.14）：左对齐的一块，没有插图、没有图标、从不居中 */
export function EmptyState({ title, body, action, level = 2, className }: EmptyStateProps) {
  const H = level === 1 ? 'h1' : 'h2'
  return (
    <div className={cx(styles.empty, className)}>
      <H className={styles.title} tabIndex={level === 1 ? -1 : undefined}>
        {title}
      </H>
      {body && <p className={styles.body}>{typeset(body)}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
