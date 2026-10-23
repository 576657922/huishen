import type { ReactNode } from 'react'
import { cx } from '../../cx'
import styles from './Tag.module.css'

/** 小标签「自评」（DESIGN.md §8.19）：13 号次级墨色，1 px 线框，圆角 2 */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx(styles.tag, className)}>{children}</span>
}
