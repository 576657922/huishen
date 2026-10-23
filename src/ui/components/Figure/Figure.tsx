import type { ReactNode } from 'react'
import { cx } from '../../cx'
import { figureNumber } from '../../strings'
import { clauses } from '../../text'
import styles from './Figure.module.css'

export interface FigureProps {
  children: ReactNode
  /** 图注：字符串按停顿换行（§4.3，只在 ，；：。？！ 之后断开） */
  caption?: ReactNode
  /** 阅读页（练习详情）上的编号：「图 1」次级墨色 600，跟在前面 */
  number?: number
  className?: string
}

/** 图和图注（DESIGN.md §8.9）：图注在图下面 8，13 号三级墨色 */
export function Figure({ children, caption, number, className }: FigureProps) {
  return (
    <figure className={cx(styles.figure, className)}>
      {children}
      {caption && (
        <figcaption className={styles.caption}>
          {number !== undefined && <b className={styles.number}>{figureNumber(number)}</b>}
          {typeof caption === 'string' ? clauses(caption) : caption}
        </figcaption>
      )}
    </figure>
  )
}
