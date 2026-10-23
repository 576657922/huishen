import type { ReactNode } from 'react'
import { cx } from '../../cx'
import styles from './Kbd.module.css'

/** 键帽（DESIGN.md §8.19）：20 高，线框加一道底线，11 号次级墨色；只出现在给精确指针看的文字里（§10.2） */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cx(styles.kbd, className)}>{children}</kbd>
}
