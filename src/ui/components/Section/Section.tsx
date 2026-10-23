import { type ReactNode, useId } from 'react'
import { cx } from '../../cx'
import styles from './Section.module.css'

export interface SectionHeadProps {
  title: ReactNode
  /** 右边的说明（13 号三级墨色：「10 项」「改动会记住」），或一个 LinkMore、几个图标按钮 */
  aside?: ReactNode
  level?: 2 | 3
  id?: string
  className?: string
}

/** 小节头（DESIGN.md §8.2）：上方 1 px 墨线，左边标题（宋体 20 / 28），右边说明；至少 48 高 */
export function SectionHead({ title, aside, level = 2, id, className }: SectionHeadProps) {
  const H = level === 3 ? 'h3' : 'h2'
  return (
    <div className={cx(styles.head, className)}>
      <H id={id} className={level === 3 ? styles.h3 : undefined}>
        {title}
      </H>
      {aside !== undefined &&
        (typeof aside === 'string' ? <span className={styles.aside}>{aside}</span> : aside)}
    </div>
  )
}

export interface SectionProps extends Omit<SectionHeadProps, 'id'> {
  children: ReactNode
  id?: string
}

/** 一个小节：与上一节隔 40，以 1 px 墨线开头；用标题命名这个区域 */
export function Section({ title, aside, level, id, children, className }: SectionProps) {
  const headingId = useId()
  return (
    <section className={cx(styles.section, className)} aria-labelledby={headingId} id={id}>
      <SectionHead title={title} aside={aside} level={level} id={headingId} />
      {children}
    </section>
  )
}
