import type { ReactNode } from 'react'
import { cx } from '../../cx'
import styles from './Overview.module.css'

export interface OverviewCell {
  /** 「本周」「10月」 */
  label: string
  /** 大字：「19」 */
  figure: string | number
  /** 大字后面的单位：「天」 */
  unit: string
  /** 下面的小字：「共 238 分钟」 */
  note?: ReactNode
  /** 再下面的图（本周的点） */
  children?: ReactNode
}

export interface OverviewProps {
  cells: readonly OverviewCell[]
  /** 给读屏的区域名（「概览」）；不给时不是一个区域 */
  label?: string
  className?: string
}

/**
 * 记录页的概览（DESIGN.md §12.3 Overview，components.css .overview）：几格等宽的关键数字，格间一条竖的细线；
 * 标签 13 号三级墨色，数字 Inter 300 40 墨色、单位次级墨色，下面一行三级墨色的小字
 */
export function Overview({ cells, label, className }: OverviewProps) {
  const content = cells.map(c => (
    <div key={c.label} className={styles.cell}>
      <p className={styles.label}>{c.label}</p>
      <p className={styles.value}>
        <span className={cx('pnum', styles.figure)}>{c.figure}</span> {c.unit}
      </p>
      {c.note && <p className={styles.note}>{c.note}</p>}
      {c.children}
    </div>
  ))
  return label ? (
    <section className={cx(styles.overview, className)} aria-label={label}>
      {content}
    </section>
  ) : (
    <div className={cx(styles.overview, className)}>{content}</div>
  )
}
