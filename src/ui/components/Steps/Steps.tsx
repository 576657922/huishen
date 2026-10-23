import type { ReactNode } from 'react'
import { cx } from '../../cx'
import { typeset } from '../../text'
import styles from './Steps.module.css'

export interface StepsProps {
  /** 做法的每一步；字符串在这里排版（数字绑单位、最后一行至少四个字） */
  items: readonly ReactNode[]
  className?: string
}

/**
 * 做法（DESIGN.md §8.10 Steps）：有序列表，每项 1.875em（100% 时 28）| 1fr，上下 12，项与项之间一条细线；
 * 序号 01 02 03 是 13 号 Inter 等宽数字、三级墨色，由 CSS 计数器生成（读屏仍按有序列表读）
 */
export function Steps({ items, className }: StepsProps) {
  return (
    <ol className={cx(styles.steps, className)}>
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 步骤的顺序就是它的身份
        <li key={i} className={styles.step}>
          <span>{typeof item === 'string' ? typeset(item) : item}</span>
        </li>
      ))}
    </ol>
  )
}
