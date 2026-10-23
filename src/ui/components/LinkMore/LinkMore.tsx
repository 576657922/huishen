import type { ReactNode } from 'react'
import { cx } from '../../cx'
import { Icon } from '../../icons'
import { AppLink } from '../../link'
import styles from './LinkMore.module.css'

export interface LinkMoreProps {
  to: string
  children: ReactNode
  /** caption：13 号字，用在小结页底部和面板里 */
  size?: 'body' | 'caption'
  className?: string
}

/** 「全部依据 ›」「求助方式 ›」：次级墨色的文字加一个 16 的箭头，点按区域 44 高 */
export function LinkMore({ to, children, size = 'body', className }: LinkMoreProps) {
  return (
    <AppLink to={to} className={cx(styles.link, size === 'caption' && styles.caption, className)}>
      {children}
      <Icon name="chevron-right" size={16} className={styles.icon} />
    </AppLink>
  )
}
