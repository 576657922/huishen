import type { ReactNode } from 'react'
import { Button, cx } from '@/ui'
import styles from './Question.module.css'

export interface QuestionProps {
  /** 标题的 id：选项组用 aria-labelledby 指向它 */
  titleId: string
  title: string
  level: 2 | 3
  /** 「跳过」的文字 */
  skipLabel: string
  onSkip: () => void
  children: ReactNode
  className?: string
}

/**
 * 一道点选题（DESIGN.md §8.16）：宋体 17 / 24 的问题在左、安静的「跳过」在右，上 32 下 8，下面是选项
 */
export function Question({ titleId, title, level, skipLabel, onSkip, children, className }: QuestionProps) {
  const H = level === 2 ? 'h2' : 'h3'
  return (
    <section className={cx(styles.question, className)} aria-labelledby={titleId}>
      <div className={styles.head}>
        <H id={titleId} className={styles.title}>
          {title}
        </H>
        <Button variant="quiet" onClick={onSkip} className={styles.skip}>
          {skipLabel}
        </Button>
      </div>
      {children}
    </section>
  )
}
